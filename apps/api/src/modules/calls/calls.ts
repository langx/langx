import {
  CALL_LIMITS,
  type CallEndReason,
  type CallMedia,
  type CallOutcome,
  type CallState,
  type CallView,
} from '@langx/shared'
import { randomBytes } from 'node:crypto'
import { MongoServerError, type Db, type ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * Why a call ended, as the server knows it.
 *
 * Wider than what either person is told (`wireReason`) and wider than what the
 * thread remembers (`outcomeOf`): this is the fact, and the other two are what
 * each audience is entitled to of it.
 */
export type CallEndCause =
  /** The caller gave up while it was still ringing. */
  | 'cancelled'
  /** The person being called said no. */
  | 'declined'
  /** It rang until `ringDeadline` and nobody answered. */
  | 'timeout'
  /** Nothing of theirs could be rung. The call was never live. */
  | 'unreachable'
  /** They were in another call. The call was never live. */
  | 'busy'
  /** Either of them ended it after the answer. */
  | 'hangup'
  /** Answered, and then the two devices never reached each other. */
  | 'connectFailed'
  /** A device said the media path was gone and would not come back. */
  | 'connectionLost'
  /** Both devices went quiet and the lease ran out. */
  | 'lost'
  | 'maxDuration'
  /** One blocked the other, or one of the accounts stopped being one. */
  | 'blocked'
  | 'suspended'
  | 'deleted'

/** One side of a call: which device, and the key that lets it come back. */
export interface CallParty {
  /** Absent for a client too old to name its device, and for a browser tab's twin. */
  deviceId?: string
  /** See `resumeCallSchema`. Handed out once, in the ack that made this device a party. */
  resumeKey: string
}

export interface Call {
  /** The UUID the caller's device minted — also what a phone's call screen keys on. */
  _id: string
  conversationId: ObjectId
  callerId: string
  calleeId: string
  /**
   * The two of them again, as an array, because that is the shape the
   * one-live-call index needs: see `live_party_unique`.
   */
  parties: [string, string]
  media: CallMedia
  state: CallState
  /**
   * Present for as long as the call is not over, and **removed** rather than
   * set false when it ends. Its presence is what holds both people in the
   * unique index, so unsetting it is the whole of "hanging up the line".
   */
  live?: true
  /** When ringing gives up. Fixed at the start; the client's timer counts to it. */
  ringDeadline: Date
  /**
   * When the state the call is in now runs out: the ring, then the time
   * allowed to connect, then a lease the two devices keep renewing. The
   * sweeper ends whatever is past it, which is the only way a call whose
   * devices have both vanished ever ends.
   */
  deadline: Date
  createdAt: Date
  acceptedAt?: Date
  connectedAt?: Date
  endedAt?: Date
  caller: CallParty
  /** Written by the answer; a call nobody picked up never has one. */
  callee?: CallParty
  /** The state it was in when it ended, which is half of what `outcomeOf` needs. */
  endedFrom?: Exclude<CallState, 'ended'>
  endCause?: CallEndCause
  /**
   * Set by the write that ends the call and cleared by the one that records
   * the thread's row. Two writes, and a process can die between them: this is
   * what lets the sweeper find a call that ended and never reached the thread.
   */
  logPending?: true
  logMessageId?: ObjectId
}

const calls = (db: Db) => db.collection<Call>(COLLECTIONS.calls)

/**
 * Twenty-four random bytes: long enough that it cannot be guessed, short
 * enough to send in every reconnect.
 */
export function newResumeKey(): string {
  return randomBytes(24).toString('base64url')
}

/**
 * What the thread will remember of a call that has ended.
 *
 * Decided from the state it ended *in*, not from why: a caller hanging up on a
 * ringing call and a ring timing out are the same thing to the person who was
 * called — a call they did not take — and the same row.
 *
 * `connecting` is where the two halves part. Hanging up before the media path
 * came up is still a call both people agreed to; the path never coming up is a
 * failure of ours, and the row should not word it as somebody's choice.
 */
export function outcomeOf(call: Pick<Call, 'endedFrom' | 'endCause'>): CallOutcome {
  if (call.endCause === 'busy') return 'busy'
  if (call.endCause === 'unreachable') return 'missed'
  if (call.endedFrom === 'active') return 'completed'
  if (call.endedFrom === 'connecting') {
    return call.endCause === 'connectFailed' ||
      call.endCause === 'connectionLost' ||
      call.endCause === 'lost'
      ? 'failed'
      : 'completed'
  }
  return call.endCause === 'declined' ? 'declined' : 'missed'
}

/**
 * How long they talked, in whole seconds, on the server's clock.
 *
 * From the moment media first flowed to the moment the call ended. Measured
 * here rather than reported by a device because it is the number the thread
 * shows both people, and two phones' clocks would give two answers.
 */
export function durationSecondsOf(call: Pick<Call, 'connectedAt' | 'endedAt'>): number | undefined {
  if (!call.connectedAt || !call.endedAt) return undefined
  return Math.max(0, Math.round((call.endedAt.getTime() - call.connectedAt.getTime()) / 1000))
}

/**
 * The reason a client is given. See `CALL_END_REASONS` for why three of the
 * server's causes collapse into one word.
 */
export function wireReason(cause: CallEndCause | undefined): CallEndReason {
  switch (cause) {
    case 'cancelled':
    case 'declined':
    case 'timeout':
    case 'busy':
    case 'hangup':
    case 'connectFailed':
    case 'maxDuration':
      return cause
    case 'connectionLost':
    case 'lost':
      return 'connectionLost'
    default:
      return 'ended'
  }
}

export function toCallView(call: Call, now: Date = new Date()): CallView {
  return {
    callId: call._id,
    conversationId: call.conversationId.toHexString(),
    media: call.media,
    state: call.state,
    callerId: call.callerId,
    calleeId: call.calleeId,
    ringDeadline: call.ringDeadline.toISOString(),
    createdAt: call.createdAt.toISOString(),
    ...(call.connectedAt ? { connectedAt: call.connectedAt.toISOString() } : {}),
    serverNow: now.toISOString(),
  }
}

export async function findCall(db: Db, callId: string): Promise<Call | null> {
  return calls(db).findOne({ _id: callId })
}

/** Every call still up that names any of these people. At most one each, by the index. */
export async function liveCallsOf(db: Db, userIds: readonly string[]): Promise<Call[]> {
  return calls(db)
    .find({ live: true, parties: { $in: [...userIds] } })
    .toArray()
}

export type ReserveResult = { ok: true } | { ok: false; reason: 'duplicateId' | 'engaged' }

/**
 * Writes a ringing call, which is also what reserves both people.
 *
 * One insert and no read before it: the unique index over `parties` is what
 * says whether either of them is already in a call, and it says so under a
 * race, which a read cannot. `engaged` does not say which of the two it was —
 * the caller reads the calls that are in the way and decides.
 */
export async function reserveCall(db: Db, call: Call): Promise<ReserveResult> {
  try {
    await calls(db).insertOne(call)
    return { ok: true }
  } catch (error) {
    if (!(error instanceof MongoServerError) || error.code !== 11000) throw error
    // Two things are unique here: the id, and the people in a live call. The
    // error names the index that refused, which is the only way to tell a
    // retried start from a busy line.
    return {
      ok: false,
      reason: error.message.includes('live_party_unique') ? 'engaged' : 'duplicateId',
    }
  }
}

/**
 * A call that never rang, written for the row it leaves and nothing else:
 * the person was busy, or had nothing that could be rung.
 *
 * Never `live`, so it reserves nobody and the sweeper never sees it. It still
 * goes through the collection rather than straight to the thread, so the
 * cooldown counts it and the log is written by the one function that writes
 * every other call's.
 */
export async function recordUnplacedCall(
  db: Db,
  call: Omit<Call, 'state' | 'live' | 'endedAt' | 'endedFrom' | 'endCause' | 'logPending'>,
  cause: 'busy' | 'unreachable',
  now: Date,
): Promise<Call | null> {
  const ended: Call = {
    ...call,
    state: 'ended',
    endedAt: now,
    endedFrom: 'ringing',
    endCause: cause,
    logPending: true,
  }
  try {
    await calls(db).insertOne(ended)
    return ended
  } catch (error) {
    // The same call id, retried: the first attempt already wrote it.
    if (error instanceof MongoServerError && error.code === 11000) return null
    throw error
  }
}

/**
 * The answer, claimed.
 *
 * `state: 'ringing'` in the filter is what makes one device win: a second
 * phone answering the same call a moment later matches nothing and is told the
 * call was answered elsewhere. The winner is written down — its device and a
 * fresh key — in the same write, so there is never a call that is answered by
 * nobody in particular.
 */
export async function claimAccept(
  db: Db,
  callId: string,
  calleeId: string,
  party: CallParty,
  now: Date,
): Promise<Call | null> {
  return calls(db).findOneAndUpdate(
    { _id: callId, calleeId, live: true, state: 'ringing' },
    {
      $set: {
        state: 'connecting',
        acceptedAt: now,
        deadline: new Date(now.getTime() + CALL_LIMITS.connectTimeoutSeconds * 1000),
        callee: party,
      },
    },
    { returnDocument: 'after' },
  )
}

/** The furthest a lease may reach: the end of the longest call allowed. */
function hardStop(connectedAt: Date): Date {
  return new Date(connectedAt.getTime() + CALL_LIMITS.maxDurationMinutes * 60 * 1000)
}

function leaseFrom(now: Date, connectedAt: Date): Date {
  const lease = new Date(now.getTime() + CALL_LIMITS.leaseSeconds * 1000)
  const stop = hardStop(connectedAt)
  return lease < stop ? lease : stop
}

/**
 * Media is flowing. The first of the two devices to say so moves the call to
 * `active` and starts the clock the thread's row is measured on; the second
 * finds nothing to change, which is success.
 */
export async function claimConnected(
  db: Db,
  callId: string,
  userId: string,
  now: Date,
): Promise<Call | null> {
  return calls(db).findOneAndUpdate(
    { _id: callId, parties: userId, live: true, state: 'connecting' },
    { $set: { state: 'active', connectedAt: now, deadline: leaseFrom(now, now) } },
    { returnDocument: 'after' },
  )
}

/**
 * "Still here." Pushes the lease out, never past the longest call allowed.
 *
 * A pipeline update because the cap is read off the document's own
 * `connectedAt`: reading it first and writing second would be two round trips
 * for a heartbeat, and this runs every half minute for every call in progress.
 * Only an `active` call has a lease — a ringing or connecting one runs to a
 * fixed deadline that no heartbeat should be able to extend.
 */
export async function renewLease(
  db: Db,
  callId: string,
  userId: string,
  now: Date,
): Promise<boolean> {
  const lease = new Date(now.getTime() + CALL_LIMITS.leaseSeconds * 1000)
  const result = await calls(db).updateOne(
    { _id: callId, parties: userId, live: true, state: 'active' },
    [
      {
        $set: {
          deadline: {
            $min: [lease, { $add: ['$connectedAt', CALL_LIMITS.maxDurationMinutes * 60 * 1000] }],
          },
        },
      },
    ],
  )
  return result.matchedCount > 0
}

/** Whether a deadline that has passed was the hard stop rather than a lapsed lease. */
export function reachedMaxDuration(call: Pick<Call, 'connectedAt' | 'deadline'>): boolean {
  return (
    call.connectedAt !== undefined &&
    call.deadline.getTime() >= hardStop(call.connectedAt).getTime()
  )
}

/**
 * The end, claimed.
 *
 * A call can be ended from four directions at once — either device, the
 * sweeper on either machine, a block — and exactly one of them may write the
 * row and tell everybody. `live: true` in the filter is that: the first write
 * removes the flag and every later one matches nothing.
 *
 * `from` pins the state the caller of this function read. If the call moved on
 * in between — answered, in the instant somebody else cancelled it — the claim
 * fails rather than recording a cause that no longer describes what happened,
 * and the caller looks again.
 */
export async function claimEnd(
  db: Db,
  callId: string,
  from: Exclude<CallState, 'ended'>,
  cause: CallEndCause,
  now: Date,
): Promise<Call | null> {
  return calls(db).findOneAndUpdate(
    { _id: callId, live: true, state: from },
    {
      $set: { state: 'ended', endedAt: now, endedFrom: from, endCause: cause, logPending: true },
      $unset: { live: '' },
    },
    { returnDocument: 'after' },
  )
}

/** Live calls whose deadline has passed, oldest first. The sweeper's whole input. */
export async function expiredCalls(db: Db, now: Date, limit: number): Promise<Call[]> {
  return calls(db)
    .find({ live: true, deadline: { $lt: now } })
    .sort({ deadline: 1 })
    .limit(limit)
    .toArray()
}

/** Calls that ended a while ago and still owe the thread a row. */
export async function callsOwingLog(db: Db, endedBefore: Date, limit: number): Promise<Call[]> {
  return calls(db)
    .find({ logPending: true, endedAt: { $lt: endedBefore } })
    .sort({ endedAt: 1 })
    .limit(limit)
    .toArray()
}

/** The row is written: stop owing it. */
export async function markLogged(db: Db, callId: string, messageId: ObjectId): Promise<void> {
  await calls(db).updateOne(
    { _id: callId },
    { $set: { logMessageId: messageId }, $unset: { logPending: '' } },
  )
}

/**
 * There is no thread left to write the row into. Stop owing it, or the
 * sweeper would come back for this call on every pass until it expired.
 */
export async function abandonLog(db: Db, callId: string): Promise<void> {
  await calls(db).updateOne({ _id: callId }, { $unset: { logPending: '' } })
}

/** How many calls this account has started since `since`, of any outcome. */
export async function countStartedSince(db: Db, callerId: string, since: Date): Promise<number> {
  return calls(db).countDocuments({ callerId, createdAt: { $gt: since } })
}

/** This caller's calls to this person since `since`, newest first. */
export async function callsBetweenSince(
  db: Db,
  callerId: string,
  calleeId: string,
  since: Date,
): Promise<Call[]> {
  return calls(db)
    .find({ callerId, calleeId, createdAt: { $gt: since } })
    .sort({ createdAt: -1 })
    .toArray()
}

/** Everything about one account's calls, for the purge and the export. */
export async function callsInvolving(db: Db, userId: string): Promise<Call[]> {
  return calls(db)
    .find({ $or: [{ callerId: userId }, { calleeId: userId }] })
    .toArray()
}

export async function deleteCallsInvolving(db: Db, userId: string): Promise<void> {
  await calls(db).deleteMany({ $or: [{ callerId: userId }, { calleeId: userId }] })
}
