import {
  CALL_LIMITS,
  ERROR_CODES,
  MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES,
  isUnansweredOutcome,
  type CallPeer,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { messagesReceivedFrom } from '../chat/access'
import type { Conversation, Message } from '../chat/conversations'
import { isSuspended } from '../moderation/suspension'
import { isOfficialId } from '../official/accounts'
import type { Profile } from '../profiles/profiles'
import { callsBetweenSince, countStartedSince, outcomeOf } from './calls'

type CallProfile = Pick<
  Profile,
  | '_id'
  | 'handle'
  | 'displayName'
  | 'avatarUrl'
  | 'official'
  | 'guest'
  | 'suspension'
  | 'deletedAt'
  | 'privacy'
>

const CALL_PROFILE_FIELDS = {
  handle: 1,
  displayName: 1,
  avatarUrl: 1,
  official: 1,
  guest: 1,
  suspension: 1,
  deletedAt: 1,
  privacy: 1,
} as const

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** As much of somebody as a ringing screen draws. */
export function toCallPeer(profile: Pick<Profile, '_id' | 'handle' | 'displayName' | 'avatarUrl'>) {
  const peer: CallPeer = {
    _id: profile._id,
    handle: profile.handle,
    displayName: profile.displayName ?? profile.handle,
  }
  if (profile.avatarUrl !== undefined) peer.avatarUrl = profile.avatarUrl
  return peer
}

export async function callPeer(db: Db, userId: string): Promise<CallPeer | null> {
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: userId }, { projection: { handle: 1, displayName: 1, avatarUrl: 1 } })
  return profile ? toCallPeer(profile) : null
}

/** Whether this account can be on either end of a call at all. */
export function takesCalls(
  profile: Pick<Profile, '_id' | 'official' | 'guest' | 'privacy'>,
): boolean {
  if (profile.official || profile.guest || isOfficialId(profile._id)) return false
  return profile.privacy?.refuseCalls !== true
}

/**
 * Who may call whom. Everything here is about the two people and the thread
 * between them; whether the deployment can place a call at all, and whether
 * the person is free right now, are asked afterwards by the caller of this.
 *
 * The conversation has already been through `assertConversationAccess`, which
 * is where "these two share a thread" and "neither has blocked the other" are
 * settled — the same gate a message passes, so a call cannot reach anybody a
 * message could not.
 *
 * The rule that matters most is the one in the middle. A call is the most
 * intrusive thing one account can do to another: it makes a stranger's phone
 * ring. So it is gated on the other person's participation exactly as a photo
 * is, with the same number and for the same reason — what they have sent you
 * is the only thing that can stand in for their consent. No plan buys a way
 * past it. See `MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES`.
 */
export async function assertCallAllowed(
  db: Db,
  conversation: Conversation,
  callerId: string,
): Promise<{ caller: CallProfile; callee: CallProfile }> {
  const calleeId = conversation.participants.find((id) => id !== callerId)
  if (!calleeId) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Conversation not found')

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const [caller, callee] = await Promise.all([
    profiles.findOne<CallProfile>({ _id: callerId }, { projection: CALL_PROFILE_FIELDS }),
    profiles.findOne<CallProfile>({ _id: calleeId }, { projection: CALL_PROFILE_FIELDS }),
  ])
  if (!caller) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
  // A purged account leaves its threads behind; a soft-deleted one is on its
  // way out. Neither has anything left to ring.
  if (!callee || callee.deletedAt) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Recipient not found')

  // An official account is a channel or an assistant, and a guest has no
  // account: there is nobody at either to pick up. The same refusal a message
  // to a channel gets.
  if (callee.official || callee.guest || isOfficialId(callee._id)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, 'This account does not take calls')
  }
  if (caller.official || caller.guest) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, 'This account cannot place calls')
  }

  // The caller's own suspension is `requireAuth`'s and the socket handshake's
  // to refuse; this is the other end, for `recordMessage`'s reason — the
  // person calling is owed "this account is suspended" rather than a ring
  // that nobody can answer.
  if (isSuspended(callee)) {
    throw new ApiError(ERROR_CODES.RECIPIENT_SUSPENDED, 'This account is suspended')
  }

  /*
   * The switch, in both directions. Theirs first: if both have it off, "they
   * do not take calls" is the answer that is true whatever the caller does
   * about their own setting.
   */
  if (callee.privacy?.refuseCalls === true) {
    throw new ApiError(ERROR_CODES.CALLS_REFUSED, 'They have calls switched off', {
      reason: 'them',
    })
  }
  if (caller.privacy?.refuseCalls === true) {
    throw new ApiError(ERROR_CODES.CALLS_REFUSED, 'You have calls switched off', {
      reason: 'you',
    })
  }

  const received = await messagesReceivedFrom(db, conversation, callerId)
  if (received < MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES) {
    throw new ApiError(
      ERROR_CODES.CALLS_LOCKED,
      `Calls unlock after ${MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES} messages from them`,
      { max: MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES },
    )
  }

  return { caller, callee }
}

/**
 * The two brakes on somebody who will not stop calling.
 *
 * **Per hour**, across everybody: a ceiling on how fast one account can make
 * phones ring, and on how many relay allocations it can open. Far above any
 * honest use.
 *
 * **Per person, per day**: after `unansweredPerPerson24h` calls in a row that
 * nobody picked up, the caller waits. Not for a day — for the other person.
 * A message from them, or a call back, is them turning to face the caller
 * again, and it clears the count at once; only silence leaves it standing,
 * until the calls age out of the day. That is the difference between a
 * rate limit and a rule about consent: this one is released by the person it
 * protects.
 *
 * Read from the calls themselves rather than kept as a counter. A counter
 * would have to be reset from the message path, and `recordMessage` is the
 * hottest write in the app; these are two indexed reads on the cold path of
 * starting a call.
 */
export async function assertCallLimits(
  db: Db,
  conversation: Conversation,
  callerId: string,
  calleeId: string,
  now: Date,
): Promise<void> {
  const started = await countStartedSince(db, callerId, new Date(now.getTime() - HOUR_MS))
  if (started >= CALL_LIMITS.startsPerHour) {
    throw new ApiError(ERROR_CODES.RATE_LIMITED, 'Too many calls. Try again later.', {
      retryAt: new Date(now.getTime() + HOUR_MS).toISOString(),
    })
  }

  const recent = await callsBetweenSince(db, callerId, calleeId, new Date(now.getTime() - DAY_MS))
  // Newest first: the run of unanswered calls that ends at the most recent
  // one. A call they did pick up breaks it, however long ago in the day.
  const unanswered = []
  for (const call of recent) {
    if (call.state !== 'ended' || !isUnansweredOutcome(outcomeOf(call))) break
    unanswered.push(call)
  }
  if (unanswered.length < CALL_LIMITS.unansweredPerPerson24h) return

  /*
   * The third most recent of them is the one that decides. If they have
   * written or called since *that* call, fewer than three have gone out into
   * silence and the caller may try again; if not, all three did. Asking about
   * the newest instead would lift the limit only for a reply that came after
   * the very last ring, and asking about the oldest would let one old reply
   * excuse everything after it.
   */
  const third = unanswered[CALL_LIMITS.unansweredPerPerson24h - 1]
  if (!third) return
  const since = third.createdAt

  const [calledBack, wroteBack] = await Promise.all([
    db
      .collection(COLLECTIONS.calls)
      .findOne(
        { callerId: calleeId, calleeId: callerId, createdAt: { $gt: since } },
        { projection: { _id: 1 } },
      ),
    // Bounded by `conversation_created` to what was sent in this one thread
    // since then — a few messages at most, never the thread's history. A
    // call's own row is not them writing.
    db.collection<Message>(COLLECTIONS.messages).findOne(
      {
        conversationId: conversation._id,
        createdAt: { $gt: since },
        senderId: calleeId,
        type: { $ne: 'call' },
      },
      { projection: { _id: 1 } },
    ),
  ])
  if (calledBack || wroteBack) return

  throw new ApiError(
    ERROR_CODES.CALL_COOLDOWN,
    'They have not answered. Wait for them to write or call back.',
    // When that third call stops counting, which is when a fourth is allowed
    // even if they never answer.
    { retryAt: new Date(third.createdAt.getTime() + DAY_MS).toISOString() },
  )
}
