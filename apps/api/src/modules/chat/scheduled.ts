import {
  ERROR_CODES,
  MAX_SCHEDULE_AHEAD_DAYS,
  MAX_SCHEDULED_PER_CONVERSATION,
  nextMorningIn,
  type ScheduleMessageInput,
  type ScheduledMessageDto,
  type ScheduledMessageStatus,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { isSuspended } from '../moderation/suspension'
import { acceptsMessages } from '../official/accounts'
import type { Profile } from '../profiles/profiles'
import { assertConversationAccess } from './access'
import type { Message } from './conversations'

export interface ScheduledMessage {
  _id: ObjectId
  conversationId: ObjectId
  senderId: string
  body: string
  /** The author's id for the create, which makes a retried create a no-op. */
  clientId: string
  sendAt: Date
  status: ScheduledMessageStatus
  /** Claims taken so far. A stuck claim is retried once and then given up. */
  attempts: number
  /** When the current claim was taken, for spotting one that never finished. */
  claimedAt?: Date
  /** The message this became, once it has. */
  messageId?: ObjectId
  /** Only on `sent`; the TTL in `indexes.ts` runs from it. */
  sentAt?: Date
  failureReason?: string
  createdAt: Date
}

/**
 * The earliest a message may be scheduled for. A minute: anything sooner is a
 * send, and the scheduler only looks once a minute anyway.
 */
const MIN_LEAD_MS = 60 * 1000

/** The rows its author still has something to do with. `sent` is in the thread. */
const VISIBLE: ScheduledMessageStatus[] = ['pending', 'sending', 'failed']

function collection(db: Db) {
  return db.collection<ScheduledMessage>(COLLECTIONS.scheduledMessages)
}

export function toScheduledMessageDto(row: ScheduledMessage): ScheduledMessageDto {
  return {
    _id: row._id.toHexString(),
    conversationId: row.conversationId.toHexString(),
    body: row.body,
    sendAt: row.sendAt.toISOString(),
    status: row.status,
    ...(row.failureReason ? { failureReason: row.failureReason } : {}),
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * The partner's morning, from the timezone their public profile shows.
 *
 * Only from what is public: `hideCity` withholds the zone from every other
 * reader (see `toPublicProfile`), and working it out here for somebody who
 * hid it would tell the sender the one thing the setting is for — "they are
 * asleep now" is where they are.
 */
async function theirMorning(db: Db, partnerId: string, now: Date): Promise<Date> {
  const partner = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: partnerId }, { projection: { timezone: 1, privacy: 1 } })
  const zone = partner?.privacy?.hideCity === true ? undefined : partner?.timezone
  const at = zone ? nextMorningIn(zone, now) : null
  if (!at) throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Their timezone is not known')
  return at
}

/**
 * Queue a text message to go out later in a conversation that already exists.
 *
 * Only an existing one, and only text: the first message of a thread spends
 * the initiation quota and an attachment spends storage, and a send that
 * charges at 09:00 tomorrow for something decided now would be a charge the
 * sender can no longer see coming. Nothing here is charged — `sendTextMessage`
 * does its usual accounting when the row is sent.
 *
 * The checks here are for the sender's benefit, so a message that could never
 * be sent is refused now rather than failing overnight. They are not the rule:
 * the scheduler sends through `sendTextMessage`, which asks everything again.
 */
export async function createScheduledMessage(
  db: Db,
  senderId: string,
  conversationId: string,
  input: ScheduleMessageInput,
  now: Date = new Date(),
): Promise<ScheduledMessage> {
  const conversation = await assertConversationAccess(db, conversationId, senderId)
  const partnerId = conversation.participants.find((id) => id !== senderId)
  if (partnerId === undefined || !acceptsMessages(partnerId)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, 'This account does not take messages')
  }

  const already = await collection(db).findOne({ senderId, clientId: input.clientId })
  if (already) return already

  const sendAt = input.sendAt ? new Date(input.sendAt) : await theirMorning(db, partnerId, now)
  if (sendAt.getTime() < now.getTime() + MIN_LEAD_MS) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That time is too soon')
  }
  if (sendAt.getTime() > now.getTime() + MAX_SCHEDULE_AHEAD_DAYS * 24 * 60 * 60 * 1000) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `Messages can be scheduled up to ${MAX_SCHEDULE_AHEAD_DAYS} days ahead`,
    )
  }

  /*
   * Counted, then inserted: two creates racing past the count can leave one
   * more than the cap. That is harmless — the cap keeps a thread from filling
   * with monologue, not a resource from running out — and closing it would
   * take a counter document for a limit nobody can profit from exceeding.
   */
  const waiting = await collection(db).countDocuments({
    senderId,
    conversationId: conversation._id,
    status: { $in: ['pending', 'sending'] },
  })
  if (waiting >= MAX_SCHEDULED_PER_CONVERSATION) {
    throw new ApiError(
      ERROR_CODES.QUOTA_EXCEEDED,
      `Up to ${MAX_SCHEDULED_PER_CONVERSATION} messages can wait in one conversation`,
      { max: MAX_SCHEDULED_PER_CONVERSATION },
    )
  }

  const row: ScheduledMessage = {
    _id: new ObjectId(),
    conversationId: conversation._id,
    senderId,
    body: input.body,
    clientId: input.clientId,
    sendAt,
    status: 'pending',
    attempts: 0,
    createdAt: now,
  }
  try {
    await collection(db).insertOne(row)
  } catch (caught) {
    // The retry that lost the race to its own first attempt.
    if (!(caught instanceof MongoServerError) || caught.code !== 11000) throw caught
    const winner = await collection(db).findOne({ senderId, clientId: input.clientId })
    if (!winner) throw caught
    return winner
  }
  return row
}

/**
 * The author's own rows under one thread, soonest first. Filtered on
 * `senderId`, so there is nothing of anybody else's to guard — and no block
 * check, deliberately: a row that failed *because* of a block is exactly what
 * its author needs to be able to see.
 */
export async function listScheduledMessages(
  db: Db,
  senderId: string,
  conversationId: string,
): Promise<ScheduledMessage[]> {
  if (!ObjectId.isValid(conversationId)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed conversation id')
  }
  return collection(db)
    .find({
      senderId,
      conversationId: new ObjectId(conversationId),
      status: { $in: VISIBLE },
    })
    .sort({ sendAt: 1 })
    .toArray()
}

/**
 * Cancel a pending row, or dismiss a failed one. Deleted rather than marked:
 * the words were never sent, and keeping them would be keeping a draft the
 * author threw away.
 *
 * A row already claimed is not cancellable — it is being sent, and a cancel
 * that reported success while the message arrived anyway would be a lie.
 */
export async function cancelScheduledMessage(db: Db, senderId: string, id: string): Promise<void> {
  if (!ObjectId.isValid(id)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Not found')
  const result = await collection(db).deleteOne({
    _id: new ObjectId(id),
    senderId,
    status: { $in: ['pending', 'failed'] },
  })
  if (result.deletedCount === 0) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Not found')
}

/**
 * How long a claim may sit in `sending` before it is presumed dead — the
 * process that took it restarted between the claim and the send.
 */
export const SCHEDULED_CLAIM_STALE_MS = 5 * 60 * 1000

/** A stuck claim is tried once more, and then given up on. */
export const SCHEDULED_MAX_ATTEMPTS = 2

/**
 * Puts stuck claims back, once. The retry cannot double-send: the message's
 * `clientId` is derived from the row, so if the first attempt did write it,
 * `sender_client_id_unique` — and the lookup in front of it — hands back that
 * message rather than a second one.
 */
export async function releaseStaleClaims(db: Db, now: Date): Promise<void> {
  const stale = new Date(now.getTime() - SCHEDULED_CLAIM_STALE_MS)
  await collection(db).updateMany(
    { status: 'sending', claimedAt: { $lt: stale }, attempts: { $lt: SCHEDULED_MAX_ATTEMPTS } },
    { $set: { status: 'pending' }, $unset: { claimedAt: '' } },
  )
  await collection(db).updateMany(
    { status: 'sending', claimedAt: { $lt: stale }, attempts: { $gte: SCHEDULED_MAX_ATTEMPTS } },
    { $set: { status: 'failed', failureReason: ERROR_CODES.INTERNAL } },
  )
}

/**
 * Takes the next due row, atomically. Two passes — two machines, or a slow
 * tick overlapping the next — can ask at once; `findOneAndUpdate` from
 * `pending` hands any one row to exactly one of them.
 */
export async function claimDueScheduledMessage(
  db: Db,
  now: Date,
): Promise<ScheduledMessage | null> {
  return collection(db).findOneAndUpdate(
    { status: 'pending', sendAt: { $lte: now } },
    { $set: { status: 'sending', claimedAt: now }, $inc: { attempts: 1 } },
    { sort: { sendAt: 1 }, returnDocument: 'after' },
  )
}

export async function markScheduledSent(
  db: Db,
  id: ObjectId,
  messageId: ObjectId,
  now: Date,
): Promise<void> {
  await collection(db).updateOne(
    { _id: id, status: 'sending' },
    { $set: { status: 'sent', messageId, sentAt: now }, $unset: { claimedAt: '' } },
  )
}

export async function markScheduledFailed(db: Db, id: ObjectId, reason: string): Promise<void> {
  await collection(db).updateOne(
    { _id: id, status: 'sending' },
    { $set: { status: 'failed', failureReason: reason }, $unset: { claimedAt: '' } },
  )
}

/** The `clientId` the sent message carries — one per row, so one message per row. */
export function scheduledMessageClientId(row: Pick<ScheduledMessage, '_id'>): string {
  return `scheduled:${row._id.toHexString()}`
}

/**
 * The message an earlier claim on this row already wrote, if one did — asked
 * only on a retry, so the retry can record it without announcing it twice.
 */
export async function alreadySentMessageId(
  db: Db,
  row: Pick<ScheduledMessage, '_id' | 'senderId'>,
): Promise<ObjectId | null> {
  const message = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOne(
      { senderId: row.senderId, clientId: scheduledMessageClientId(row) },
      { projection: { _id: 1 } },
    )
  return message?._id ?? null
}

/**
 * Why the author can no longer send anything, if they cannot.
 *
 * `sendTextMessage` does not ask this — on a live send `requireAuth` and the
 * socket handshake already have — and a row written days ago has neither in
 * front of it. The same two refusals `revocationFor` makes on an open socket.
 */
export async function senderRefusal(db: Db, senderId: string): Promise<string | null> {
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: senderId }, { projection: { suspension: 1, deletedAt: 1 } })
  if (!profile || profile.deletedAt) return ERROR_CODES.FORBIDDEN
  return isSuspended(profile) ? ERROR_CODES.ACCOUNT_SUSPENDED : null
}
