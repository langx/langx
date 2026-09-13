import { broadcastTickShare, utcDayKey } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { bodyFor, broadcastAudience, broadcasts, type BroadcastJob } from './broadcast'
import { deliverOfficialMessage } from '../official/deliver'
import { localeFor } from '../profiles/localeFor'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensFor, type PushSender } from '../push/devices'
import type { SchedulerLogger } from '../tokens/poolScheduler'
import type { JobRun } from '../tokens/pool'

/**
 * One tick of the in-app broadcast queue.
 *
 * The loop is `scripts/send-announcement.ts`'s, comments and all, with three
 * things the script could not have: a pace, a cursor, and somewhere to stop.
 *
 * **The idempotency is the clientId and nothing else.** Each recipient's
 * message carries `broadcast:<slug>:<userId>`, and
 * `messages.sender_client_id_unique` is on `{senderId, clientId}` — so a
 * second write for that person is refused while everybody else's goes
 * through. The id has to carry the recipient: without it the first person is
 * messaged and every other write is refused as a duplicate, which looks like
 * success from here because `deliverOfficialMessage` hands back the message it
 * found. It did that once, to 25 people.
 */
export async function runBroadcastQueuePass(
  db: Db,
  push: PushSender,
  now: Date = new Date(),
  options: { logger?: SchedulerLogger } = {},
): Promise<{ sent: number; failed?: number }> {
  // Whatever is already going, before whatever is waiting: two half-sent
  // broadcasts would each take half the pace and both arrive late.
  const job =
    (await broadcasts(db).findOne({ status: 'sending' }, { sort: { createdAt: 1 } })) ??
    (await broadcasts(db).findOne({ status: 'queued' }, { sort: { createdAt: 1 } }))
  if (!job) return { sent: 0 }

  const share = broadcastTickShare(now)
  if (share <= 0) return { sent: 0 } // outside the sending window

  /*
   * The tick lock, on the collection that already is one. Two API instances
   * reach this at the same moment; the first to insert owns the tick and the
   * second returns having done nothing. Note that this is a *pace* lock, not a
   * correctness one — correctness is the clientId index, which is why a lost
   * lock costs nothing but a slower minute.
   */
  const tickKey = `${job._id}:${utcDayKey(now)}:${now.getUTCHours()}:${now.getUTCMinutes() < 30 ? '00' : '30'}`
  try {
    await db
      .collection<JobRun>(COLLECTIONS.jobRuns)
      .insertOne({ job: 'broadcastQueue', periodKey: tickKey, startedAt: now })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return { sent: 0 }
    throw error
  }

  if (job.status !== 'sending') {
    await broadcasts(db).updateOne(
      { _id: job._id, status: 'queued' },
      { $set: { status: 'sending', startedAt: job.startedAt ?? now } },
    )
  }

  const recipients = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      {
        ...broadcastAudience(now),
        ...(job.cursorUserId ? { _id: { $gt: job.cursorUserId } } : {}),
      },
      { projection: { _id: 1 }, sort: { _id: 1 }, limit: share },
    )
    .toArray()

  if (recipients.length === 0) {
    await broadcasts(db).updateOne({ _id: job._id }, { $set: { status: 'done', finishedAt: now } })
    options.logger?.info({ broadcast: job._id, sent: job.sent }, 'broadcast finished')
    return { sent: 0 }
  }

  let sent = 0
  let failed = 0
  for (const recipient of recipients) {
    try {
      if (await deliver(db, push, job, recipient._id)) sent += 1
    } catch (error) {
      failed += 1
      options.logger?.warn(
        { err: error, broadcast: job._id, userId: recipient._id },
        'broadcast delivery failed',
      )
    }
  }

  /*
   * The cursor moves once the batch is done rather than per recipient. A crash
   * mid-batch therefore re-sends that batch on the next tick, and every
   * message in it is refused as a duplicate — which is the cheap half of the
   * trade, and the reason there is no ledger here.
   */
  const last = recipients.at(-1)?._id
  await broadcasts(db).updateOne(
    { _id: job._id },
    {
      $inc: { sent, failed },
      ...(last ? { $set: { cursorUserId: last } } : {}),
    },
  )
  return { sent, ...(failed > 0 ? { failed } : {}) }
}

async function deliver(
  db: Db,
  push: PushSender,
  job: BroadcastJob,
  userId: string,
): Promise<boolean> {
  const body = bodyFor(job, await localeFor(db, userId))
  const delivered = await deliverOfficialMessage(db, {
    fromHandle: 'langx',
    toUserId: userId,
    body,
    clientId: `broadcast:${job._id}:${userId}`,
  })
  if (!delivered) return false

  /*
   * The knock, not the message. Deliberately not `fanOutMessage`: that calls
   * `respondAsOfficial` — which would hand @langx its own announcement to
   * reply to — and does a cross-instance `fetchSockets` per recipient, five
   * hundred of those a tick with a five-second adapter timeout each. Whoever
   * has the app open sees the thread on the next focus, which is what the
   * script did too.
   *
   * **One language for both**, and it is the reader's native one rather than
   * the phone's: a Turkish notification opening a Russian message reads like
   * two different senders.
   *
   * Best-effort — a phone that cannot be reached does not undo a message that
   * is already in the thread.
   */
  const tokens = await tokensFor(db, userId)
  if (tokens.length > 0) {
    await sendPush(db, push, {
      to: tokens,
      title: job.pushTitle,
      body: body.slice(0, 120),
      data: {
        kind: 'message',
        conversationId: delivered.conversation._id.toHexString(),
        senderId: delivered.message.senderId,
      },
    })
  }
  return true
}

/**
 * Sends one broadcast to one person — the operator, before arming it.
 *
 * The only preview that catches a broken line break in the Turkish body
 * before five thousand people get it: the real font, the real thread, the real
 * push. Its own clientId, so testing does not consume the recipient's real
 * copy when the broadcast goes out for real.
 */
export async function sendBroadcastTest(
  db: Db,
  push: PushSender,
  job: BroadcastJob,
  toUserId: string,
): Promise<boolean> {
  const body = bodyFor(job, await localeFor(db, toUserId))
  const delivered = await deliverOfficialMessage(db, {
    fromHandle: 'langx',
    toUserId,
    body,
    clientId: `broadcast:${job._id}:test:${toUserId}`,
  })
  if (!delivered) return false

  const tokens = await tokensFor(db, toUserId)
  if (tokens.length > 0) {
    await sendPush(db, push, {
      to: tokens,
      title: job.pushTitle,
      body: body.slice(0, 120),
      data: {
        kind: 'message',
        conversationId: delivered.conversation._id.toHexString(),
        senderId: delivered.message.senderId,
      },
    })
  }
  return true
}
