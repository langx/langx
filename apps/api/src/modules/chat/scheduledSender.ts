import type { FastifyInstance } from 'fastify'
import { ApiError } from '../../lib/ApiError'
import { fanOutMessage } from '../../ws/fanOut'
import { withJobHealth } from '../admin/jobHealth'
import { sendTextMessage } from './messages'
import {
  alreadySentMessageId,
  claimDueScheduledMessage,
  markScheduledFailed,
  markScheduledSent,
  releaseStaleClaims,
  scheduledMessageClientId,
  senderRefusal,
  type ScheduledMessage,
} from './scheduled'

/** Once a minute: a message picked for 09:00 should not arrive at 09:05. */
export const SCHEDULED_MESSAGE_INTERVAL_MS = 60 * 1000

/**
 * The most rows one pass sends. A backlog — the API was down over a popular
 * morning — drains over a few minutes rather than in one pass that outlives
 * its own interval.
 */
const MAX_PER_PASS = 200

/**
 * Sends one claimed row, or records why it could not be.
 *
 * **Through `sendTextMessage` and `fanOutMessage`**, the two functions every
 * live text send goes through, so a scheduled message is refused by exactly
 * what would refuse it if typed at this moment — a block placed overnight, a
 * suspended or deleted partner, a conversation that is gone — and is charged,
 * awarded, delivered and pushed exactly as one. The sender's own standing is
 * the one thing a live send checks elsewhere, so it is asked here.
 *
 * An `ApiError` is an answer, and the row fails with its code for the author
 * to see. Anything else is the database or the process, and the row is left
 * in `sending` for `releaseStaleClaims` to try once more.
 */
async function sendClaimed(
  app: FastifyInstance,
  row: ScheduledMessage,
  now: Date,
): Promise<boolean> {
  const db = app.mongo.db

  if (row.attempts > 1) {
    const written = await alreadySentMessageId(db, row)
    if (written) {
      // The first claim wrote it and died before saying so. Recorded, and not
      // announced again: the recipient may already have been buzzed once.
      await markScheduledSent(db, row._id, written, now)
      return true
    }
  }

  const refusal = await senderRefusal(db, row.senderId)
  if (refusal) {
    await markScheduledFailed(db, row._id, refusal)
    return false
  }

  let sent: Awaited<ReturnType<typeof sendTextMessage>>
  try {
    sent = await sendTextMessage(db, row.senderId, {
      conversationId: row.conversationId.toHexString(),
      body: row.body,
      clientId: scheduledMessageClientId(row),
    })
  } catch (error) {
    if (!(error instanceof ApiError)) throw error
    await markScheduledFailed(db, row._id, error.code)
    return false
  }

  // Marked before the fan-out: the message exists now, and a fan-out that
  // throws must not leave the row looking unsent to the next pass.
  await markScheduledSent(db, row._id, sent.message._id, now)
  await fanOutMessage(app, app.io, sent.conversation, sent.message, { pushWhenAway: true })
  return true
}

/**
 * One pass: put back claims that died, then claim and send what is due.
 *
 * Split from the timer so a test can drive a pass at a chosen `now`, and run
 * two at once to show a row is sent once.
 */
export async function runScheduledMessageTick(
  app: FastifyInstance,
  now: Date = new Date(),
): Promise<{ sent: number; failed: number }> {
  const db = app.mongo.db
  await releaseStaleClaims(db, now)

  let sent = 0
  let failed = 0
  for (let i = 0; i < MAX_PER_PASS; i++) {
    const row = await claimDueScheduledMessage(db, now)
    if (!row) break
    try {
      if (await sendClaimed(app, row, now)) sent++
      else failed++
    } catch (error) {
      // One row's trouble is not the next row's. It stays claimed and comes
      // back through `releaseStaleClaims`.
      app.log.error({ err: error, scheduledId: row._id.toHexString() }, 'scheduled send failed')
    }
  }
  return { sent, failed }
}

export function startScheduledMessageScheduler(
  app: FastifyInstance,
  options: { intervalMs?: number } = {},
): { stop: () => void } {
  const intervalMs = options.intervalMs ?? SCHEDULED_MESSAGE_INTERVAL_MS
  let running = false

  async function tick(): Promise<void> {
    if (running) return
    running = true
    try {
      const result = await withJobHealth(app.mongo.db, 'scheduled messages', () =>
        runScheduledMessageTick(app, new Date()),
      )
      if (result.sent > 0 || result.failed > 0) app.log.info(result, 'scheduled messages sent')
    } catch (error) {
      app.log.error({ err: error }, 'scheduled message run failed')
    } finally {
      running = false
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), intervalMs)
  timer.unref?.()
  return {
    stop: () => {
      clearInterval(timer)
    },
  }
}
