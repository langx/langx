import {
  BROADCAST_PER_TICK,
  broadcastTickShare,
  notificationsAllowed,
  utcDayKey,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import {
  bodyFor,
  broadcastAudience,
  broadcasts,
  interactiveFor,
  mediaFor,
  revOf,
  type BroadcastJob,
} from './broadcast'
import { officialIds } from '../official/accounts'
import { deliverOfficialMessage } from '../official/deliver'
import { profilesInLocalHour } from '../profiles/localHour'
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

  // A local-hour broadcast has no UTC window: its hour is the window, asked
  // per person below.
  const share = job.localHour === undefined ? broadcastTickShare(now) : BROADCAST_PER_TICK
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

  if (job.localHour !== undefined && localRoundIsOver(job, now)) {
    await broadcasts(db).updateOne({ _id: job._id }, { $set: { status: 'done', finishedAt: now } })
    options.logger?.info({ broadcast: job._id, sent: job.sent }, 'broadcast finished')
    return { sent: 0 }
  }

  const recipients =
    job.localHour === undefined
      ? await db
          .collection<Profile>(COLLECTIONS.profiles)
          .find(
            {
              ...broadcastAudience(now),
              ...(job.cursorUserId ? { _id: { $gt: job.cursorUserId } } : {}),
            },
            { projection: { _id: 1 }, sort: { _id: 1 }, limit: share },
          )
          .toArray()
      : await dueInLocalHour(db, job, job.localHour, now, share)

  // Nobody due this hour is not the end of a local-hour broadcast — the next
  // zone's evening is half an hour away. Only the day running out is.
  if (recipients.length === 0 && job.localHour !== undefined) return { sent: 0 }
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
  const last = job.localHour === undefined ? recipients.at(-1)?._id : undefined
  await broadcasts(db).updateOne(
    { _id: job._id },
    {
      $inc: { sent, failed },
      ...(last ? { $set: { cursorUserId: last } } : {}),
    },
  )
  return { sent, ...(failed > 0 ? { failed } : {}) }
}

/**
 * How long a local-hour broadcast stays open: every zone's hour comes round
 * once in 24, and the extra one covers a zone whose hour ended just before the
 * broadcast was armed, plus a missed tick.
 */
const LOCAL_ROUND_MS = 25 * 60 * 60 * 1000

function localRoundIsOver(job: BroadcastJob, now: Date): boolean {
  return job.startedAt !== undefined && now.getTime() - job.startedAt.getTime() >= LOCAL_ROUND_MS
}

/**
 * Who is in `hour` on their own clock right now and has no copy yet.
 *
 * "No copy yet" is asked of the messages themselves, by the clientId every
 * copy carries — the same `{senderId, clientId}` index that makes the send
 * exactly once. It has to be asked rather than left to that index: the hour
 * spans two ticks, and a duplicate refused at the write is still handed back
 * by `deliverOfficialMessage` as if it were new, which here would push it a
 * second time.
 *
 * Only accounts that existed when the broadcast was written. Someone who
 * signs up during the day it takes to go round was not in the count, and
 * whatever it says, the welcome has just said to them.
 */
async function dueInLocalHour(
  db: Db,
  job: BroadcastJob,
  hour: number,
  now: Date,
  share: number,
): Promise<Pick<Profile, '_id'>[]> {
  const due = await profilesInLocalHour(db, hour, now, {
    ...broadcastAudience(now),
    createdAt: { $lte: job.createdAt },
  })
  if (due.length === 0) return []

  const senderId = officialIds().get('langx')
  const clientIds = due.map((profile) => `broadcast:${job._id}:${profile._id}`)
  const already = senderId
    ? new Set(
        (
          await db
            .collection(COLLECTIONS.messages)
            .find(
              { senderId, clientId: { $in: clientIds } },
              { projection: { _id: 0, clientId: 1 } },
            )
            .toArray()
        ).map((message) => message.clientId as string),
      )
    : new Set<string>()

  return due
    .filter((profile) => !already.has(`broadcast:${job._id}:${profile._id}`))
    .sort((a, b) => (a._id < b._id ? -1 : 1))
    .slice(0, share)
    .map((profile) => ({ _id: profile._id }))
}

async function deliver(
  db: Db,
  push: PushSender,
  job: BroadcastJob,
  userId: string,
): Promise<boolean> {
  const locale = await localeFor(db, userId)
  const body = bodyFor(job, locale)
  const attachment = mediaFor(job, locale)
  const interactive = interactiveFor(job, locale)
  const delivered = await deliverOfficialMessage(db, {
    fromHandle: 'langx',
    toUserId: userId,
    body,
    ...(attachment ? { attachment } : {}),
    ...(interactive ? { interactive } : {}),
    clientId: `broadcast:${job._id}:${userId}`,
  })
  if (!delivered) return false

  /*
   * Somebody who muted @langx still gets the message — the thread is where a
   * broadcast lives — and only the knock is withheld, which is the line the
   * chat fan-out draws. `sendBroadcastTest` below does not ask: the operator
   * pressed a button to see the push.
   */
  if (delivered.conversation.mutedBy?.[userId]) return true

  /*
   * The same for the messages switch. The knock is a `message` push, and every
   * other push @langx makes — a note, a Pro gift, a suspension ending — goes
   * through the fan-out, which asks it. Without this a reader who turned
   * message pushes off was still buzzed by every broadcast.
   */
  const reader = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: userId }, { projection: { settings: 1 } })
  if (!notificationsAllowed(reader?.settings?.notifications, 'messages', 'push')) return true

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
 * copy when the broadcast goes out for real — and the `rev` in it so that the
 * test after an edit is a new message rather than a duplicate of the body that
 * was just fixed.
 *
 * `createdAt` is in it for the case `rev` cannot cover: a draft deleted and
 * written again under the same slug starts at `rev` 1, so its test send
 * collided with the test of the draft before it. The message row outlives the
 * job row — deleting a broadcast does not unsay what it already said — so
 * `deliverOfficialMessage` found the old one, handed it back, and this
 * returned `true` to a panel that then showed the draft as tested. Nothing
 * arrived, nothing failed, and the picture nobody had seen was one tap from
 * going out to everybody. Which is how it was found.
 */
export async function sendBroadcastTest(
  db: Db,
  push: PushSender,
  job: BroadcastJob,
  toUserId: string,
): Promise<boolean> {
  const locale = await localeFor(db, toUserId)
  const body = bodyFor(job, locale)
  const attachment = mediaFor(job, locale)
  const interactive = interactiveFor(job, locale)
  const delivered = await deliverOfficialMessage(db, {
    fromHandle: 'langx',
    toUserId,
    body,
    ...(attachment ? { attachment } : {}),
    ...(interactive ? { interactive } : {}),
    clientId: `broadcast:${job._id}:test:${job.createdAt.getTime()}:${revOf(job)}:${toUserId}`,
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
