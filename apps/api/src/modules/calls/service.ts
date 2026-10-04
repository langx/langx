import {
  CALL_EVENTS,
  CALL_LIMITS,
  ERROR_CODES,
  type CallEnded,
  type CallIncoming,
  type CallSession,
  type CallState,
  type CallView,
  type CurrentCall,
  type EndCallInput,
  type ResumeCallInput,
  type StartCallInput,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { ApiError } from '../../lib/ApiError'
import { fanOutMessage } from '../../ws/fanOut'
import { callRoom, callsRoom, type AppSocket } from '../../ws/types'
import { getAppConfig } from '../appConfig/appConfig'
import { assertConversationAccess } from '../chat/access'
import { assertCallAllowed, assertCallLimits, callPeer, toCallPeer } from './access'
import { leavesUnread, recordCallLog } from './callLog'
import {
  abandonLog,
  callsOwingLog,
  claimAccept,
  claimConnected,
  claimEnd,
  durationSecondsOf,
  expiredCalls,
  findCall,
  liveCallsOf,
  markLogged,
  newResumeKey,
  outcomeOf,
  reachedMaxDuration,
  recordUnplacedCall,
  renewLease,
  reserveCall,
  toCallView,
  wireReason,
  type Call,
  type CallEndCause,
} from './calls'
import { hasRingTargets, loadRingTargets, ringPhones, stopRinging } from './ring'

/**
 * Everything a call does that needs more than the database: the sockets, the
 * phones, the relay and the thread.
 *
 * `calls.ts` is the record and the claims on it; this is what happens around
 * each claim. The rule that holds the two together is that **nothing here
 * announces a transition it did not win**. Every function reads, claims with a
 * conditional write, and only then emits — so two machines, a device and a
 * timer can all reach for the same call at once and exactly one of them tells
 * anybody anything.
 */

/** Who is asking, when it is a socket: the thing that gets put in the call's room. */
export interface CallOrigin {
  socket?: AppSocket
  deviceId?: string
}

type LiveState = Exclude<CallState, 'ended'>

/** A little past the deadline, so the timer finds it expired rather than about to. */
const TIMER_SLACK_MS = 250

/**
 * The timers this process is holding, one per call it saw start or be
 * answered — `app.callTimers`, decorated in `buildApp`.
 *
 * On the app rather than in this module because a test, and a blue-green
 * deploy, run more than one instance in a process's lifetime, and one's timers
 * must not outlive it. A decorator rather than a `WeakMap` keyed on the app
 * because Fastify hands every route plugin its own child instance: keyed on
 * the object, a call placed over the socket and ended over REST would have
 * been looked up in two different maps. A decorator is inherited, so there is
 * one.
 *
 * They are an optimisation and nothing more: a ring that ends on the second
 * rather than up to a sweep later. A machine that dies takes its timers with
 * it and loses nothing, because the deadline is on the document and
 * `runCallSweepTick` reads it from there.
 */
function unwatch(app: FastifyInstance, callId: string): void {
  const timer = app.callTimers.get(callId)
  if (timer) clearTimeout(timer)
  app.callTimers.delete(callId)
}

function watch(app: FastifyInstance, callId: string, deadline: Date): void {
  unwatch(app, callId)
  const timer = setTimeout(
    () => {
      app.callTimers.delete(callId)
      void expireCall(app, callId).catch((error: unknown) =>
        app.log.warn({ err: error, callId }, 'call deadline handling failed'),
      )
    },
    Math.max(0, deadline.getTime() - Date.now()) + TIMER_SLACK_MS,
  )
  timer.unref()
  app.callTimers.set(callId, timer)
}

/** What ran out, said as a cause. */
function causeOfExpiry(call: Call): CallEndCause {
  if (call.state === 'ringing') return 'timeout'
  if (call.state === 'connecting') return 'connectFailed'
  return reachedMaxDuration(call) ? 'maxDuration' : 'lost'
}

function endedPayload(call: Call): CallEnded {
  const outcome = outcomeOf(call)
  const durationSeconds = outcome === 'completed' ? (durationSecondsOf(call) ?? 0) : undefined
  return {
    callId: call._id,
    reason: wireReason(call.endCause),
    outcome,
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
  }
}

/** A cause that ends a call without anybody being told why, or pushed about it. */
function isQuiet(cause: CallEndCause | undefined): boolean {
  return cause === 'blocked' || cause === 'suspended' || cause === 'deleted'
}

/**
 * The thread's row, and the knock that goes with it.
 *
 * Its own function because two callers reach it: the transition that just
 * ended the call, and the sweeper finding a call whose process died between
 * ending it and getting here. `recordCallLog` is idempotent by index, so the
 * second of two writers creates nothing and tells nobody.
 */
async function writeCallLog(app: FastifyInstance, call: Call): Promise<void> {
  const logged = await recordCallLog(app.mongo.db, call)
  if (!logged) {
    await abandonLog(app.mongo.db, call._id)
    return
  }
  await markLogged(app.mongo.db, call._id, logged.message._id)
  if (!logged.created) return

  /*
   * A call that a block or a suspension ended leaves its row and makes no
   * sound. The two can no longer read the thread together, and "you missed a
   * call" from somebody who has just been cut off is exactly the message
   * cutting them off was meant to stop.
   */
  if (isQuiet(call.endCause)) return

  await fanOutMessage(app, app.io, logged.conversation, logged.message, {
    pushWhenAway: leavesUnread(outcomeOf(call)),
  })
}

/**
 * Everything that follows a call ending, for the one caller that won the
 * claim: every screen showing it is told, the room is emptied, phones still
 * ringing are stopped, and the thread gets its row.
 */
async function finishCall(app: FastifyInstance, call: Call): Promise<void> {
  unwatch(app, call._id)

  /*
   * The two sockets in the call, and every other device of both people that
   * can draw one: the callee's other phones are ringing, and the caller may
   * have this thread open in a second tab. A device that never knew about the
   * call ignores an id it does not recognise.
   */
  app.io
    .to([callRoom(call._id), callsRoom(call.callerId), callsRoom(call.calleeId)])
    .emit(CALL_EVENTS.ended, endedPayload(call))
  // Membership is what authorises a relay, so it ends with the call.
  app.io.in(callRoom(call._id)).socketsLeave(callRoom(call._id))

  if (call.endedFrom === 'ringing') void stopRinging(app, call, wireReason(call.endCause))

  try {
    await writeCallLog(app, call)
  } catch (error) {
    // `logPending` is still set, so the sweeper writes it. The call itself is
    // over either way, and failing the hang-up over a row would be backwards.
    app.log.warn({ err: error, callId: call._id }, 'writing a call to its thread failed')
  }
}

/**
 * A deadline came due — a timer on this machine, or the sweeper on either.
 * Looks again before acting: the document, not the timer, says whether the
 * call is still in the state the deadline was set for.
 */
export async function expireCall(
  app: FastifyInstance,
  callId: string,
  now: Date = new Date(),
): Promise<void> {
  const call = await findCall(app.mongo.db, callId)
  if (!call?.live) return
  if (call.deadline.getTime() > now.getTime()) {
    // Answered, or its lease renewed, since the timer was set.
    if (call.state !== 'active') watch(app, call._id, call.deadline)
    return
  }
  const ended = await claimEnd(
    app.mongo.db,
    call._id,
    call.state as LiveState,
    causeOfExpiry(call),
    now,
  )
  if (ended) await finishCall(app, ended)
}

/**
 * Whether calls can be placed here at all: a relay to carry them, and the
 * operator's switch left on. `/app-config` reports the same answer as
 * `callService`, so the app normally never gets far enough to be told.
 */
export async function callServiceAvailable(app: FastifyInstance): Promise<boolean> {
  if (!app.ice.configured) return false
  return (await getAppConfig(app.mongo.db)).flags.callsEnabled !== false
}

/**
 * Whether any open app of theirs could draw an incoming call right now.
 *
 * Asked only when no phone can be rung by push, so most starts never reach
 * it. It is a question to every machine (`fanOut.ts` says what that costs),
 * and it can time out when one of them has just died mid-deploy — which is
 * read as "yes". A call that rings for nobody ends as a missed call forty-five
 * seconds later; a call refused because a machine was restarting is a call
 * that should have gone through.
 */
async function anyoneListening(app: FastifyInstance, userId: string): Promise<boolean> {
  try {
    return (await app.io.in(callsRoom(userId)).fetchSockets()).length > 0
  } catch {
    return true
  }
}

/**
 * A call that could not ring: write it, give the thread its row, and let the
 * usual fan-out tell the person they were called.
 */
async function recordUnplaced(
  app: FastifyInstance,
  call: Parameters<typeof recordUnplacedCall>[1],
  cause: 'busy' | 'unreachable',
  now: Date,
): Promise<void> {
  const recorded = await recordUnplacedCall(app.mongo.db, call, cause, now)
  if (!recorded) return
  try {
    await writeCallLog(app, recorded)
  } catch (error) {
    app.log.warn({ err: error, callId: recorded._id }, 'writing a call to its thread failed')
  }
}

/** The same call id, sent again by the device that owns it: hand back what it had. */
async function resumeStart(
  app: FastifyInstance,
  existing: Call,
  callerId: string,
  origin: CallOrigin,
  now: Date,
): Promise<CallSession> {
  // Somebody else's id. Not "not found": they chose it, and it is taken.
  if (existing.callerId !== callerId) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That call id is already in use')
  }
  if (!existing.live) {
    throw new ApiError(ERROR_CODES.CALL_ENDED, 'That call has ended', {
      reason: wireReason(existing.endCause),
    })
  }
  const ice = await app.ice.mint()
  await origin.socket?.join(callRoom(existing._id))
  return { call: toCallView(existing, now), ice, resumeKey: existing.caller.resumeKey }
}

/**
 * Places a call.
 *
 * The order is deliberate, and each step is before the next for a reason:
 *
 * 1. **The thread and the two people** — `assertConversationAccess`, then
 *    `assertCallAllowed`. Refusals that are about who is asking come before
 *    anything that costs something or could ring a phone.
 * 2. **The service**, then **the limits**. Whether calls exist here at all is
 *    said before a cooldown is: the first is the truer answer when both apply.
 * 3. **Whether anything of theirs can be rung.** If nothing can, the thread
 *    records the attempt and the caller is told at once, instead of listening
 *    to forty-five seconds of a ring that is reaching nobody.
 * 4. **The relay credential**, before the call is written. Minting can fail,
 *    and a ringing call the caller's own device then cannot join would be a
 *    phantom on somebody else's phone.
 * 5. **The reservation** — one insert, which is also what says "busy".
 * 6. Only then does anything ring.
 */
export async function startCall(
  app: FastifyInstance,
  callerId: string,
  input: StartCallInput,
  origin: CallOrigin = {},
  now: Date = new Date(),
): Promise<CallSession> {
  const db = app.mongo.db

  // A start whose ack was lost is retried with the same id, and must find the
  // call it already made rather than be told its own line is busy.
  const existing = await findCall(db, input.callId)
  if (existing) return resumeStart(app, existing, callerId, origin, now)

  const conversation = await assertConversationAccess(db, input.conversationId, callerId)
  const { caller, callee } = await assertCallAllowed(db, conversation, callerId)
  if (!(await callServiceAvailable(app))) {
    throw new ApiError(ERROR_CODES.CALLS_UNAVAILABLE, 'Calls are not available on this server')
  }
  await assertCallLimits(db, conversation, callerId, callee._id, now)

  const ringDeadline = new Date(now.getTime() + CALL_LIMITS.ringSeconds * 1000)
  const draft = {
    _id: input.callId,
    conversationId: conversation._id,
    callerId,
    calleeId: callee._id,
    parties: [callerId, callee._id] as [string, string],
    media: input.media,
    ringDeadline,
    deadline: ringDeadline,
    createdAt: now,
    caller: {
      ...(origin.deviceId ? { deviceId: origin.deviceId } : {}),
      resumeKey: newResumeKey(),
    },
  }

  const targets = await loadRingTargets(app, callee._id)
  if (!hasRingTargets(targets) && !(await anyoneListening(app, callee._id))) {
    await recordUnplaced(app, draft, 'unreachable', now)
    throw new ApiError(ERROR_CODES.CALL_UNREACHABLE, 'They cannot be reached for a call right now')
  }

  const ice = await app.ice.mint()

  const call: Call = { ...draft, state: 'ringing', live: true }
  let reserved = await reserveCall(db, call)

  if (!reserved.ok && reserved.reason === 'engaged') {
    /*
     * Somebody in this call is already in one. Before believing it: a call
     * whose deadline has passed is only still `live` because no sweep has got
     * to it yet, and it must not make anyone busy. End those and try once
     * more — once, because the retry can only lose to a call that is real.
     */
    const inTheWay = await liveCallsOf(db, call.parties)
    const stale = inTheWay.filter((other) => other.deadline.getTime() < now.getTime())
    if (stale.length > 0) {
      for (const other of stale) await expireCall(app, other._id, now)
      reserved = await reserveCall(db, call)
    }
  }

  if (!reserved.ok) {
    if (reserved.reason === 'duplicateId') {
      // The same start, twice at once. The other one wrote the call.
      const written = await findCall(db, input.callId)
      if (written) return resumeStart(app, written, callerId, origin, now)
      throw new ApiError(ERROR_CODES.CALL_ENDED, 'That call has ended')
    }

    const engaged = await liveCallsOf(db, call.parties)
    /*
     * They are ringing *us*, right now. The client has that call on screen —
     * or will in a moment — and answers it instead; a second call the other
     * way would be two people each listening to the other's ring.
     */
    if (
      engaged.some(
        (other) =>
          other.state === 'ringing' && other.callerId === callee._id && other.calleeId === callerId,
      )
    ) {
      throw new ApiError(ERROR_CODES.CALL_GLARE, 'They are calling you')
    }
    if (engaged.some((other) => other.parties.includes(callerId))) {
      throw new ApiError(ERROR_CODES.CALL_IN_PROGRESS, 'You are already in a call')
    }
    await recordUnplaced(app, draft, 'busy', now)
    throw new ApiError(ERROR_CODES.CALL_BUSY, 'They cannot take a call right now')
  }

  await origin.socket?.join(callRoom(call._id))
  const view = toCallView(call, now)
  const incoming: CallIncoming = { call: view, caller: toCallPeer(caller) }
  app.io.to(callsRoom(callee._id)).emit(CALL_EVENTS.incoming, incoming)
  // Not awaited: the caller's ack must not wait on Apple or Expo, and
  // `ringPhones` swallows its own failures.
  void ringPhones(app, call, incoming.caller, targets, now)
  watch(app, call._id, call.ringDeadline)

  return { call: view, ice, resumeKey: call.caller.resumeKey }
}

/**
 * Answers a call, on the socket that will carry it.
 *
 * Socket-only, unlike ending one: answering is the start of an exchange that
 * needs the socket for every step after it, so there is nothing a REST answer
 * could go on to do.
 */
export async function acceptCall(
  app: FastifyInstance,
  calleeId: string,
  callId: string,
  origin: CallOrigin & { socket: AppSocket },
  now: Date = new Date(),
): Promise<CallSession> {
  const db = app.mongo.db
  const call = await findCall(db, callId)
  // Not theirs to answer reads the same as not existing.
  if (!call || call.calleeId !== calleeId) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Call not found')
  }
  if (!call.live || call.state !== 'ringing') {
    throw new ApiError(ERROR_CODES.CALL_ENDED, 'That call is no longer ringing', {
      reason: call.live ? 'answeredElsewhere' : wireReason(call.endCause),
    })
  }

  // The gate again, at the moment it matters: a block placed while it rang
  // normally ended the call already, and this is for the instant in between.
  await assertConversationAccess(db, call.conversationId.toHexString(), calleeId)

  const ice = await app.ice.mint()
  const party = {
    ...(origin.deviceId ? { deviceId: origin.deviceId } : {}),
    resumeKey: newResumeKey(),
  }
  const accepted = await claimAccept(db, callId, calleeId, party, now)
  if (!accepted) {
    // Another of their devices got there first, or the caller gave up.
    const current = await findCall(db, callId)
    throw new ApiError(ERROR_CODES.CALL_ENDED, 'That call is no longer ringing', {
      reason: current?.live ? 'answeredElsewhere' : wireReason(current?.endCause),
    })
  }

  await origin.socket.join(callRoom(callId))
  // The caller: the one other socket in the room.
  origin.socket.to(callRoom(callId)).emit(CALL_EVENTS.accepted, { callId })
  // Their own other devices, which are still ringing. Not the caller's — the
  // room is excluded, and the caller is told above in better words.
  const elsewhere: CallEnded = { callId, reason: 'answeredElsewhere' }
  app.io.to(callsRoom(calleeId)).except(callRoom(callId)).emit(CALL_EVENTS.ended, elsewhere)
  void stopRinging(app, accepted, 'answeredElsewhere', party.deviceId)
  watch(app, callId, accepted.deadline)

  return { call: toCallView(accepted, now), ice, resumeKey: party.resumeKey }
}

/** A call that is over, said to the device that asked about it. */
function alreadyEnded(call: Call): ApiError {
  return new ApiError(ERROR_CODES.CALL_ENDED, 'That call has ended', {
    reason: wireReason(call.endCause),
  })
}

async function participantCall(
  app: FastifyInstance,
  userId: string,
  callId: string,
): Promise<Call> {
  const call = await findCall(app.mongo.db, callId)
  if (!call || !call.parties.includes(userId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Call not found')
  }
  return call
}

/** Media is flowing on this device. See `claimConnected`. */
export async function markCallConnected(
  app: FastifyInstance,
  userId: string,
  callId: string,
  now: Date = new Date(),
): Promise<CallView> {
  const connected = await claimConnected(app.mongo.db, callId, userId, now)
  if (connected) {
    // From here the lease is what ends a silent call, and the sweeper reads it.
    unwatch(app, callId)
    return toCallView(connected, now)
  }
  const call = await participantCall(app, userId, callId)
  if (!call.live) throw alreadyEnded(call)
  // The other device said so first, or this is still ringing and the claim
  // did not apply. Either way there is nothing to change.
  return toCallView(call, now)
}

/** "Still here." See `renewLease`. */
export async function heartbeatCall(
  app: FastifyInstance,
  userId: string,
  callId: string,
  now: Date = new Date(),
): Promise<void> {
  if (await renewLease(app.mongo.db, callId, userId, now)) return
  const call = await participantCall(app, userId, callId)
  if (!call.live) throw alreadyEnded(call)
}

/**
 * Whether this request comes from a device that is in the call, rather than
 * merely from an account that is.
 */
function isPartyDevice(call: Call, userId: string, proof: { inRoom: boolean; resumeKey?: string }) {
  if (proof.inRoom) return true
  const party = userId === call.callerId ? call.caller : call.callee
  return proof.resumeKey !== undefined && party?.resumeKey === proof.resumeKey
}

/**
 * Ends a call at one of the two people's request.
 *
 * What it *means* depends on who asks and when, and the server works that out
 * rather than being told — see `endCallSchema`. While it rings, either
 * person's any device may end it: the caller cancels, the other declines, and
 * a phone in a pocket has as much right to decline as the one in a hand. Once
 * it is answered, only the two devices in it may: a second phone of the
 * callee's, late to learn the call was answered elsewhere, must not be able to
 * hang up on a conversation it is not part of.
 *
 * Idempotent. Asking to end a call that is already over is answered with how
 * it ended, not with an error.
 */
export async function endCallByParty(
  app: FastifyInstance,
  userId: string,
  input: EndCallInput,
  proof: { inRoom: boolean },
  now: Date = new Date(),
): Promise<CallEnded> {
  const db = app.mongo.db
  // A claim can lose to another transition — the answer landing as the caller
  // cancels. Look again and decide again; twice is enough for any real race.
  for (let attempt = 0; attempt < 3; attempt++) {
    const call = await participantCall(app, userId, input.callId)
    if (!call.live) return endedPayload(call)

    let cause: CallEndCause
    if (call.state === 'ringing') {
      cause = userId === call.callerId ? 'cancelled' : 'declined'
    } else {
      if (!isPartyDevice(call, userId, { ...proof, ...pickKey(input.resumeKey) })) {
        throw new ApiError(ERROR_CODES.CALL_ENDED, 'That call was answered on another device', {
          reason: 'answeredElsewhere',
        })
      }
      cause =
        input.reason === 'connectFailed' && call.state === 'connecting'
          ? 'connectFailed'
          : input.reason === 'connectionLost'
            ? 'connectionLost'
            : 'hangup'
    }

    const ended = await claimEnd(db, call._id, call.state as LiveState, cause, now)
    if (ended) {
      await finishCall(app, ended)
      return endedPayload(ended)
    }
  }
  throw new ApiError(ERROR_CODES.INTERNAL, 'Could not end the call')
}

function pickKey(resumeKey: string | undefined): { resumeKey?: string } {
  return resumeKey === undefined ? {} : { resumeKey }
}

/**
 * A device coming back to a call after its socket dropped — a tunnel, a
 * network change, a deploy. See `resumeCallSchema` for what the key proves.
 */
export async function resumeCall(
  app: FastifyInstance,
  userId: string,
  input: ResumeCallInput,
  socket: AppSocket,
  now: Date = new Date(),
): Promise<CallView> {
  const call = await participantCall(app, userId, input.callId)
  if (!call.live) throw alreadyEnded(call)
  if (!isPartyDevice(call, userId, { inRoom: false, resumeKey: input.resumeKey })) {
    // The right account and the wrong device. Said as "not found" so the key
    // cannot be tested one guess at a time against a known call id.
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Call not found')
  }
  await socket.join(callRoom(call._id))
  return toCallView(call, now)
}

/**
 * What a call is doing now, for either of the two people in it.
 *
 * Asked by a phone that was woken to ring and wants to know whether to keep
 * ringing, and by an app that was told about a call by a notification it
 * cannot trust to be current.
 */
export async function callStatus(
  app: FastifyInstance,
  userId: string,
  callId: string,
  now: Date = new Date(),
): Promise<{ call: CallView; ended?: CallEnded }> {
  const call = await participantCall(app, userId, callId)
  return {
    call: toCallView(call, now),
    ...(call.live ? {} : { ended: endedPayload(call) }),
  }
}

/** The live call this account is in or being rung for, if there is one. */
export async function currentCall(
  app: FastifyInstance,
  userId: string,
  now: Date = new Date(),
): Promise<CurrentCall | null> {
  const [call] = await liveCallsOf(app.mongo.db, [userId])
  if (!call) return null
  const role = call.callerId === userId ? 'caller' : 'callee'
  const peer = await callPeer(app.mongo.db, role === 'caller' ? call.calleeId : call.callerId)
  if (!peer) return null
  return { call: toCallView(call, now), peer, role }
}

/**
 * Tells the caller that a phone is actually ringing, as opposed to the call
 * merely having been placed.
 *
 * A read, because the socket saying so is not in the call's room yet — it has
 * not answered — and so has nothing but its account to prove it is the one
 * being called. One per device that rings, never per frame.
 */
export async function relayRinging(
  app: FastifyInstance,
  userId: string,
  callId: string,
): Promise<void> {
  const call = await findCall(app.mongo.db, callId)
  if (!call?.live || call.state !== 'ringing' || call.calleeId !== userId) return
  app.io.to(callRoom(callId)).emit(CALL_EVENTS.ringing, { callId })
}

async function endLive(
  app: FastifyInstance,
  calls: readonly Call[],
  cause: CallEndCause,
  now: Date,
): Promise<number> {
  let ended = 0
  for (const call of calls) {
    const claimed = await claimEnd(app.mongo.db, call._id, call.state as LiveState, cause, now)
    if (!claimed) continue
    await finishCall(app, claimed)
    ended++
  }
  return ended
}

/**
 * One of two people blocked the other. If they are in a call, it is over.
 *
 * `assertConversationAccess` already refuses everything between them from the
 * moment the block is written — but a call in progress asks the server for
 * nothing, so nothing would ever have refused it.
 */
export async function endCallsBetween(
  app: FastifyInstance,
  a: string,
  b: string,
  cause: CallEndCause,
  now: Date = new Date(),
): Promise<number> {
  const live = await liveCallsOf(app.mongo.db, [a])
  return endLive(
    app,
    live.filter((call) => call.parties.includes(b)),
    cause,
    now,
  )
}

/** An account was suspended or asked to be deleted. Whatever call it was in is over. */
export async function endCallsOf(
  app: FastifyInstance,
  userId: string,
  cause: CallEndCause,
  now: Date = new Date(),
): Promise<number> {
  return endLive(app, await liveCallsOf(app.mongo.db, [userId]), cause, now)
}

/** How many calls one sweep handles. Far above anything real; a bound all the same. */
const SWEEP_BATCH = 50

/** How long an ended call may owe the thread its row before the sweeper writes it. */
const LOG_REPAIR_AFTER_MS = 30_000

/**
 * One pass over what time has ended.
 *
 * Two questions, both answered by an index that holds only the calls they are
 * about: which live calls are past their deadline, and which ended calls never
 * reached their thread. The first is how a call ends when both devices have
 * vanished and the machine that was timing it is gone too; the second is the
 * repair for a process that died between ending a call and recording it.
 *
 * Safe to run on every machine at once. Every end is a claim, and the row is
 * unique by index.
 */
export async function runCallSweepTick(
  app: FastifyInstance,
  now: Date = new Date(),
): Promise<{ ended: number; logged: number }> {
  const db = app.mongo.db
  let ended = 0
  for (const call of await expiredCalls(db, now, SWEEP_BATCH)) {
    const claimed = await claimEnd(db, call._id, call.state as LiveState, causeOfExpiry(call), now)
    if (!claimed) continue
    await finishCall(app, claimed)
    ended++
  }

  let logged = 0
  const owed = await callsOwingLog(db, new Date(now.getTime() - LOG_REPAIR_AFTER_MS), SWEEP_BATCH)
  for (const call of owed) {
    try {
      await writeCallLog(app, call)
      logged++
    } catch (error) {
      app.log.warn({ err: error, callId: call._id }, 'writing a call to its thread failed')
    }
  }
  return { ended, logged }
}
