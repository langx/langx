import {
  CALL_END_REASONS,
  CALL_EVENTS,
  CALL_LIMITS,
  SOCKET_ACK_TIMEOUT_MS,
  type CallEnded,
  type CallEndReason,
  type CallIncoming,
  type CallMedia,
  type CallMediaState,
  type CallPeer,
  type CallSession,
  type CallSignal,
  type CallView,
  type CurrentCall,
} from '@langx/shared'
import type { Socket } from 'socket.io-client'
import { api } from '../../api/client'
import { track } from '../analytics'
import { newCallId } from './callId'
import { candidateBatcher } from './candidateBatcher'
import { MediaAccessError, type EngineSession, type LocalMedia } from './engine'
import { showsClosingLine, type CallClosing } from './machine'
import { startRinging, stopRinging } from './ringtone'
import { engine } from './rtc'
import { callState, dispatchCall } from './store'
import { resetCallStreams, setCallStreams } from './streams'

/**
 * A call, from this device's side: everything that has to *happen* for the
 * state in `store.ts` to be true.
 *
 * One module and one call at a time, held at module scope like the socket it
 * rides on — a call outlives every screen it is shown over, and nothing about
 * it belongs to a component. The screens read `store.ts` and call the
 * functions exported here; nothing else touches the engine or the socket's
 * call events.
 *
 * The shape of every flow is the same and worth saying once. The **server
 * owns the call**: this device asks, the server answers, and the screen
 * follows the answer rather than the tap. The two places that is bent are the
 * two where waiting would feel broken — the outgoing screen appears the moment
 * the button is pressed, and a hang-up closes the screen without waiting to be
 * told it may.
 */

/** A refusal with everything the server said beside the code. */
export class CallRefusal extends Error {
  readonly code: string
  readonly reason?: string
  readonly retryAt?: string
  readonly max?: number

  constructor(code: string, extra: { reason?: string; retryAt?: string; max?: number } = {}) {
    super(code)
    this.name = 'CallRefusal'
    this.code = code
    if (extra.reason !== undefined) this.reason = extra.reason
    if (extra.retryAt !== undefined) this.retryAt = extra.retryAt
    if (extra.max !== undefined) this.max = extra.max
  }
}

type Timer = ReturnType<typeof setTimeout>

/** What this device holds for the call on screen, beyond what the screen draws. */
interface Live {
  callId: string
  role: 'caller' | 'callee'
  media: CallMedia
  /** The key that lets this device back into the call after its socket drops. */
  resumeKey: string | null
  local: LocalMedia | null
  session: EngineSession | null
  batcher: ReturnType<typeof candidateBatcher> | null
  /** Signals that arrived before there was an engine session to hand them to. */
  waiting: CallSignal[]
  /** Signals are applied one at a time, in the order they arrived. */
  chain: Promise<void>
  heartbeat: ReturnType<typeof setInterval> | null
  ringTimer: Timer | null
  restartTimer: ReturnType<typeof setInterval> | null
  giveUpTimer: Timer | null
  /** Media has flowed at least once. The difference between "failed" and "dropped". */
  connectedOnce: boolean
  mediaUp: boolean
  startedAt: number
  /** This device asked for the call to end, so nothing needs explaining. */
  endedByMe: boolean
  /**
   * When the caller last sent an offer that has not been answered. A second
   * offer inside that window would cross the first — see `rebuildPath`.
   */
  offerSentAt: number | null
}

/** How long the closing line stays up before the screen goes by itself. */
const CLOSING_LINE_MS = 2800
/** How long a dropped path is given to recover before it is asked to rebuild. */
const RESTART_AFTER_MS = 3000
const RESTART_EVERY_MS = 5000
/** How long a call that cannot rebuild its path is kept before it is hung up. */
const GIVE_UP_AFTER_MS = 30_000
/** Past the ring's own deadline, in case the server's word never arrives. */
const RING_GRACE_MS = 4000
/** How long "they are calling you" waits for the call it is about. */
const GLARE_WINDOW_MS = 4000

let socket: Socket | null = null
let live: Live | null = null
let clearTimer: Timer | null = null
/** A ring that arrived while another call was on screen. */
let pendingIncoming: CallIncoming | null = null
/** Set when the server said "they are calling you" and that call is not here yet. */
let answerNextFrom: { peerId: string; until: number; camera: boolean } | null = null
/**
 * A call is being placed and is still waiting for the microphone. The state
 * says nothing yet — the screen appears after the permission prompt — so a
 * second press needs its own guard, or it takes the devices a second time.
 */
let placing = false

export function engineSupported(): boolean {
  return engine.supported()
}

function isEndReason(value: unknown): value is CallEndReason {
  return typeof value === 'string' && (CALL_END_REASONS as readonly string[]).includes(value)
}

/**
 * The socket's ack, with the server's whole refusal kept.
 *
 * Not `emitWithAck` from `socket.ts`, which reduces a refusal to its code.
 * Three of a call's refusals cannot be worded from the code alone — a
 * cooldown is a date, a locked gate is a number, a refused call is whose
 * switch it was.
 */
function ask<T>(event: string, payload: unknown, timeoutMs = SOCKET_ACK_TIMEOUT_MS): Promise<T> {
  const target = socket
  if (!target) return Promise.reject(new CallRefusal('CALLS_UNAVAILABLE'))
  return new Promise((resolve, reject) => {
    target.timeout(timeoutMs).emit(
      event,
      payload,
      (
        timedOut: Error | null,
        response?: {
          ok: boolean
          data?: T
          error?: { code?: string; reason?: string; retryAt?: string; max?: number }
        },
      ) => {
        if (timedOut || !response) {
          reject(new CallRefusal('ACK_TIMEOUT'))
          return
        }
        if (response.ok) {
          resolve(response.data as T)
          return
        }
        const { code, ...extra } = response.error ?? {}
        reject(new CallRefusal(code ?? 'INTERNAL', extra))
      },
    )
  })
}

/** Fire and forget: for the notices whose loss costs a word on a screen. */
function tell(event: string, payload: unknown): void {
  void ask(event, payload).catch(() => undefined)
}

/**
 * The server's deadline for the ring, moved onto this device's clock.
 *
 * The view carries both the deadline and the server's own "now", so the
 * difference between them is the time left — whatever this phone thinks the
 * time is.
 */
function ringUntilFrom(view: CallView): number {
  return Date.now() + Math.max(0, Date.parse(view.ringDeadline) - Date.parse(view.serverNow))
}

function newLive(callId: string, role: Live['role'], media: CallMedia): Live {
  return {
    callId,
    role,
    media,
    resumeKey: null,
    local: null,
    session: null,
    batcher: null,
    waiting: [],
    chain: Promise.resolve(),
    heartbeat: null,
    ringTimer: null,
    restartTimer: null,
    giveUpTimer: null,
    connectedOnce: false,
    mediaUp: false,
    startedAt: Date.now(),
    endedByMe: false,
    offerSentAt: null,
  }
}

/** Lets go of everything a call holds: the sound, the timers, the devices. */
function release(): void {
  stopRinging()
  const held = live
  live = null
  if (!held) return
  if (held.heartbeat) clearInterval(held.heartbeat)
  if (held.ringTimer) clearTimeout(held.ringTimer)
  if (held.restartTimer) clearInterval(held.restartTimer)
  if (held.giveUpTimer) clearTimeout(held.giveUpTimer)
  held.batcher?.dispose()
  // The session owns the devices once it exists; before that they are loose.
  if (held.session) held.session.close()
  else held.local?.release()
  resetCallStreams()
}

/**
 * Takes the call off the screen — at once, or after its closing line has had
 * a moment to be read — and then turns to a ring that was waiting behind it.
 */
function settle(endedByMe: boolean, now = false): void {
  if (clearTimer) clearTimeout(clearTimer)
  clearTimer = null
  const state = callState()
  if (!state) return

  const finish = (): void => {
    clearTimer = null
    dispatchCall({ type: 'cleared' })
    const waiting = pendingIncoming
    pendingIncoming = null
    // Only if it is still ringing: a call that waited behind another one may
    // well have been given up on by now.
    if (waiting && ringUntilFrom(waiting.call) > Date.now()) showIncoming(waiting)
  }

  if (!now && state.phase === 'ended' && showsClosingLine(state, endedByMe)) {
    clearTimer = setTimeout(finish, CLOSING_LINE_MS)
  } else finish()
}

/** The call on screen is over, for a reason this device learned or decided. */
function close(callId: string, closing: CallClosing, endedByMe: boolean): void {
  const state = callState()
  if (!state || state.callId !== callId || state.phase === 'ended') return
  const seconds = state.connectedAt === null ? 0 : (Date.now() - state.connectedAt) / 1000
  track({
    name: 'call_ended',
    properties: {
      media: state.media,
      role: state.role,
      reason: closing.kind === 'ended' ? closing.reason : closing.code,
      connected: state.connectedAt !== null,
      seconds: Math.round(seconds),
    },
  })
  release()
  dispatchCall({ type: 'closed', callId, closing })
  settle(endedByMe)
}

function sendSignal(callId: string, signal: Omit<CallSignal, 'callId'>): void {
  tell(CALL_EVENTS.signal, { callId, ...signal })
}

function sendMediaState(): void {
  const state = callState()
  if (!state || !live || live.callId !== state.callId) return
  const notice: CallMediaState = {
    callId: state.callId,
    audio: state.micOn,
    video: state.cameraOn,
  }
  tell(CALL_EVENTS.media, notice)
}

/**
 * Asks for the media path to be rebuilt.
 *
 * Only the caller ever offers — that is what keeps two offers from crossing —
 * so the other side asks, and the caller does.
 */
async function rebuildPath(): Promise<void> {
  const held = live
  if (!held?.session) return
  if (held.role === 'caller') {
    // One offer at a time. The caller's own timer and the other side asking
    // fire together when a network drops under both of them, and the answer
    // to the first offer would land on the second.
    if (held.offerSentAt !== null && Date.now() - held.offerSentAt < RESTART_EVERY_MS - 500) return
    try {
      held.offerSentAt = Date.now()
      const offer = await held.session.createOffer({ iceRestart: true })
      if (live === held) sendSignal(held.callId, { description: offer })
    } catch {
      // The next attempt, or the give-up timer, deals with it.
    }
  } else sendSignal(held.callId, { restart: true })
}

function mediaConnected(): void {
  const held = live
  if (!held) return
  held.mediaUp = true
  if (held.restartTimer) clearInterval(held.restartTimer)
  held.restartTimer = null
  if (held.giveUpTimer) clearTimeout(held.giveUpTimer)
  held.giveUpTimer = null

  if (!held.connectedOnce) {
    held.connectedOnce = true
    tell(CALL_EVENTS.connected, { callId: held.callId })
    track({
      name: 'call_connected',
      properties: {
        media: held.media,
        role: held.role,
        setup_seconds: Math.round((Date.now() - held.startedAt) / 1000),
      },
    })
  }
  dispatchCall({ type: 'connected', callId: held.callId, at: Date.now() })
  // Now that there is somebody to tell: what this side's microphone and
  // camera are doing. It may have been answered without one.
  sendMediaState()
}

/**
 * The path dropped. Not the end of the call: a phone walking from wifi to
 * mobile data does this, and the path comes back by itself or by being asked.
 * Only a call that cannot rebuild it in half a minute is hung up.
 */
function mediaTrouble(failed: boolean): void {
  const held = live
  if (!held) return
  held.mediaUp = false
  dispatchCall({ type: 'reconnecting', callId: held.callId, value: true })
  if (held.restartTimer) return

  const begin = (): void => {
    if (live !== held || held.mediaUp) return
    void rebuildPath()
  }
  // A path that says "failed" will not recover without help; one that says
  // "disconnected" often does, so it is given a moment first.
  const first = setTimeout(begin, failed ? 0 : RESTART_AFTER_MS)
  held.restartTimer = setInterval(begin, RESTART_EVERY_MS)
  held.giveUpTimer ??= setTimeout(() => {
    clearTimeout(first)
    if (live !== held || held.mediaUp) return
    endOnServer(held, held.connectedOnce ? 'connectionLost' : 'connectFailed')
    close(
      held.callId,
      { kind: 'ended', reason: held.connectedOnce ? 'connectionLost' : 'connectFailed' },
      false,
    )
  }, GIVE_UP_AFTER_MS)
}

function openEngine(held: Live, session: CallSession): void {
  if (!held.local) return
  const batcher = candidateBatcher((signal) => sendSignal(held.callId, signal))
  held.batcher = batcher
  held.session = engine.open(session.ice, held.local, {
    onCandidate: (candidate) => {
      if (candidate) batcher.add(candidate)
      else batcher.end()
    },
    onConnection: (state) => {
      if (live !== held) return
      if (state === 'connected') mediaConnected()
      else mediaTrouble(state === 'failed')
    },
    onRemoteStream: (stream) => {
      if (live === held) setCallStreams({ remote: stream })
    },
  })
  const waiting = held.waiting
  held.waiting = []
  for (const signal of waiting) applySignal(held, signal)
}

function applySignal(held: Live, signal: CallSignal): void {
  const session = held.session
  if (!session) {
    held.waiting.push(signal)
    return
  }
  held.chain = held.chain
    .then(async () => {
      if (live !== held) return
      if (signal.description?.type === 'offer') {
        const answer = await session.acceptOffer(signal.description)
        if (live === held) sendSignal(held.callId, { description: answer })
      } else if (signal.description?.type === 'answer') {
        await session.acceptAnswer(signal.description)
        held.offerSentAt = null
      }
      if (signal.candidates) await session.addCandidates(signal.candidates)
      if (signal.restart && held.role === 'caller') await rebuildPath()
    })
    .catch(() => undefined)
}

function startHeartbeat(held: Live): void {
  if (held.heartbeat) return
  held.heartbeat = setInterval(() => {
    ask(CALL_EVENTS.heartbeat, { callId: held.callId }).catch((error: unknown) => {
      /*
       * A heartbeat that timed out is a socket having a bad moment, and the
       * lease allows for two of those. A refusal is not proof either: the
       * server says the same thing to a socket that has not got back into the
       * call's room yet — which a reconnect's buffered heartbeat, sent ahead
       * of the resume, always is. So the answer is to rejoin, and only a
       * refused rejoin ends the call.
       */
      if (error instanceof CallRefusal && error.code === 'CALL_ENDED') void rejoin(held)
    })
  }, CALL_LIMITS.heartbeatSeconds * 1000)
}

/**
 * Gets this device's socket back into the call's room with the key it was
 * handed, and catches up on what it missed while it was out — the answer, for
 * a caller whose socket dropped while it rang.
 */
async function rejoin(held: Live): Promise<void> {
  if (!held.resumeKey) return
  let view: CallView
  try {
    view = await ask<CallView>(CALL_EVENTS.resume, {
      callId: held.callId,
      resumeKey: held.resumeKey,
    })
  } catch (error) {
    // Timed out: the next heartbeat asks again.
    if (live === held && error instanceof CallRefusal && error.code !== 'ACK_TIMEOUT') {
      close(held.callId, { kind: 'ended', reason: 'ended' }, false)
    }
    return
  }
  if (live !== held) return
  const phase = callState()?.phase
  if (held.role === 'caller' && phase === 'outgoing' && view.state !== 'ringing') {
    onAccepted({ callId: held.callId })
  } else if (held.session && !held.mediaUp && phase !== 'outgoing') {
    void rebuildPath()
  }
}

/**
 * Tells the server the call is over, over whichever road is open.
 *
 * The socket first, and REST if that does not answer — hanging up is the one
 * thing that has to work precisely when the connection is what broke. The
 * key proves this is the device that was in the call.
 */
function endOnServer(held: Live, reason?: 'connectFailed' | 'connectionLost'): void {
  const payload = {
    callId: held.callId,
    ...(reason ? { reason } : {}),
    ...(held.resumeKey ? { resumeKey: held.resumeKey } : {}),
  }
  ask(CALL_EVENTS.end, payload, 4000).catch((error: unknown) => {
    if (error instanceof CallRefusal && error.code !== 'ACK_TIMEOUT' && socket?.connected) return
    const { callId, ...body } = payload
    void api.post(`/calls/${callId}/end`, body).catch(() => undefined)
  })
}

function showIncoming(incoming: CallIncoming): void {
  if (clearTimer) clearTimeout(clearTimer)
  clearTimer = null
  dispatchCall({ type: 'cleared' })

  const { call, caller } = incoming
  const held = newLive(call.callId, 'callee', call.media)
  live = held
  const ringUntil = ringUntilFrom(call)
  dispatchCall({
    type: 'incoming',
    callId: call.callId,
    conversationId: call.conversationId,
    peer: caller,
    media: call.media,
    ringUntil,
  })
  startRinging('incoming', `📞 ${caller.displayName}`)
  // So the caller's screen can say "ringing" rather than "calling".
  tell(CALL_EVENTS.ringing, { callId: call.callId })

  // The server ends a ring that nobody answers and says so. This is for the
  // case where that word never arrives: a screen must not ring for ever.
  held.ringTimer = setTimeout(
    () => {
      const state = callState()
      if (live === held && state?.callId === call.callId && state.phase === 'incoming') {
        close(call.callId, { kind: 'ended', reason: 'timeout' }, false)
      }
    },
    Math.max(0, ringUntil - Date.now()) + RING_GRACE_MS,
  )
}

/**
 * Places a call. Resolves once it is ringing; rejects with a `CallRefusal`
 * only for the two things the screen has to ask the person about — a
 * microphone or a camera that could not be had. Everything the server refuses
 * is shown on the call screen itself, as the line it closes with.
 */
export async function placeCall(input: {
  conversationId: string
  peer: CallPeer
  media: CallMedia
  source: 'header' | 'row' | 'meeting'
}): Promise<void> {
  const current = callState()
  if (current && current.phase !== 'ended') throw new CallRefusal('CALL_IN_PROGRESS')
  // A second press while the first is still at the permission prompt.
  if (placing) return

  // Before anything rings: see `CallEngine.acquire`.
  let local: LocalMedia
  placing = true
  try {
    local = await engine.acquire({ video: input.media === 'video' })
  } catch (error) {
    const code =
      error instanceof MediaAccessError && error.device === 'camera'
        ? 'CAMERA_DENIED'
        : 'MIC_DENIED'
    track({ name: 'call_refused', properties: { code } })
    throw new CallRefusal(code)
  } finally {
    placing = false
  }

  /*
   * A ring arrived while the permission prompt was up. From the person being
   * called, it is the call this one was about to be, so it is answered. From
   * anybody else, it is ringing on screen now, and this call is simply not
   * placed: the screen already says what is happening.
   */
  const meanwhile = callState()
  if (meanwhile && meanwhile.phase !== 'ended') {
    local.release()
    if (meanwhile.phase === 'incoming' && meanwhile.peer._id === input.peer._id) {
      await answerCall({ camera: input.media === 'video' })
    }
    return
  }

  if (clearTimer) clearTimeout(clearTimer)
  clearTimer = null
  dispatchCall({ type: 'cleared' })

  const callId = newCallId()
  const held = newLive(callId, 'caller', input.media)
  held.local = local
  live = held
  dispatchCall({
    type: 'placed',
    callId,
    conversationId: input.conversationId,
    peer: input.peer,
    media: input.media,
    // Until the server says exactly: the ring's own length, from now.
    ringUntil: Date.now() + CALL_LIMITS.ringSeconds * 1000,
  })
  setCallStreams({ local: local.stream })
  startRinging('outgoing')
  track({ name: 'call_started', properties: { media: input.media, source: input.source } })

  const start = { callId, conversationId: input.conversationId, media: input.media }
  let session: CallSession
  try {
    session = await ask<CallSession>(CALL_EVENTS.start, start).catch((error: unknown) => {
      /*
       * No answer is not "no". The server may have placed the call and be
       * ringing them while the ack was lost, so the same start is sent again:
       * with the same id it is that call handed back, not a second one.
       */
      if (error instanceof CallRefusal && error.code === 'ACK_TIMEOUT' && live === held) {
        return ask<CallSession>(CALL_EVENTS.start, start)
      }
      throw error
    })
  } catch (error) {
    const refusal = error instanceof CallRefusal ? error : new CallRefusal('INTERNAL')
    // Twice without an answer: whatever the server did, it is cancelled, so
    // nobody is left ringing for a screen that has already closed.
    if (refusal.code === 'ACK_TIMEOUT') {
      void api.post(`/calls/${callId}/end`, {}).catch(() => undefined)
    }
    track({ name: 'call_refused', properties: { code: refusal.code } })
    if (live !== held) return
    if (refusal.code === 'CALL_GLARE') {
      answerInstead(input.peer._id, input.media === 'video')
      return
    }
    close(
      callId,
      {
        kind: 'refused',
        code: refusal.code,
        ...(refusal.reason === undefined ? {} : { reason: refusal.reason }),
      },
      false,
    )
    return
  }

  // Cancelled while the request was on its way: the call exists now, so it
  // has to be ended rather than merely forgotten.
  if (live !== held) {
    tell(CALL_EVENTS.end, { callId })
    return
  }

  held.resumeKey = session.resumeKey
  const ringUntil = ringUntilFrom(session.call)
  dispatchCall({ type: 'ringUntil', callId, ringUntil })
  openEngine(held, session)
  held.ringTimer = setTimeout(
    () => {
      if (live !== held || callState()?.phase !== 'outgoing') return
      // The server should have said so by now. Ask rather than assume.
      void refreshFromServer(callId)
    },
    Math.max(0, ringUntil - Date.now()) + RING_GRACE_MS,
  )
}

/**
 * "They are calling you": the two of them pressed call at the same moment.
 * This device's own call is dropped and theirs is answered, which is what
 * both of them wanted. If their ring has not reached this device yet, it is
 * answered when it does.
 */
function answerInstead(peerId: string, camera: boolean): void {
  release()
  dispatchCall({ type: 'cleared' })
  const waiting = pendingIncoming
  if (waiting?.caller._id === peerId) {
    pendingIncoming = null
    showIncoming(waiting)
    void answerCall({ camera }).catch(() => undefined)
    return
  }
  answerNextFrom = { peerId, until: Date.now() + GLARE_WINDOW_MS, camera }
}

/**
 * Answers the call that is ringing. Rejects with a `CallRefusal` when the
 * microphone or the camera could not be had, and leaves the call ringing —
 * the person can allow it and try again, or answer without the camera.
 */
export async function answerCall(options: { camera: boolean }): Promise<void> {
  const state = callState()
  const held = live
  if (!state || !held || state.phase !== 'incoming' || held.callId !== state.callId) return
  // A second tap while the first is still asking for the microphone.
  if (held.local) return

  let local: LocalMedia
  try {
    local = await engine.acquire({ video: options.camera && state.media === 'video' })
  } catch (error) {
    throw new CallRefusal(
      error instanceof MediaAccessError && error.device === 'camera'
        ? 'CAMERA_DENIED'
        : 'MIC_DENIED',
    )
  }
  // It stopped ringing while the permission prompt was up.
  if (live !== held || callState()?.phase !== 'incoming') {
    local.release()
    return
  }

  held.local = local
  held.startedAt = Date.now()
  stopRinging()
  if (held.ringTimer) clearTimeout(held.ringTimer)
  held.ringTimer = null
  dispatchCall({ type: 'answering', callId: held.callId, cameraOn: local.hasVideo })
  setCallStreams({ local: local.stream })
  track({
    name: 'call_answered',
    properties: { media: state.media, with_camera: local.hasVideo },
  })

  let session: CallSession
  try {
    session = await ask<CallSession>(CALL_EVENTS.accept, { callId: held.callId })
  } catch (error) {
    /*
     * No answer to the answer: the server may have taken it and put this
     * socket in the call. Ending it from here lands either way — as a hang-up
     * if it was accepted, as a decline if it is still ringing — so the caller
     * is not left on "connecting" for a call nobody is going to join.
     */
    if (error instanceof CallRefusal && error.code === 'ACK_TIMEOUT') {
      tell(CALL_EVENTS.end, { callId: held.callId })
    }
    if (live !== held) return
    const reason = error instanceof CallRefusal ? error.reason : undefined
    close(held.callId, { kind: 'ended', reason: isEndReason(reason) ? reason : 'ended' }, false)
    return
  }
  // Hung up while the answer was on its way. The server took it, so it has
  // to be ended — with the key it just handed over, the only proof it takes.
  if (live !== held) {
    tell(CALL_EVENTS.end, { callId: held.callId, resumeKey: session.resumeKey })
    return
  }

  held.resumeKey = session.resumeKey
  openEngine(held, session)
  startHeartbeat(held)
  // If the two devices never find each other, this is what says so.
  held.giveUpTimer = setTimeout(
    () => {
      if (live !== held || held.connectedOnce) return
      endOnServer(held, 'connectFailed')
      close(held.callId, { kind: 'ended', reason: 'connectFailed' }, false)
    },
    (CALL_LIMITS.connectTimeoutSeconds + 5) * 1000,
  )
}

/** Turns down the call that is ringing. No closing line: they know. */
export function declineCall(): void {
  const state = callState()
  const held = live
  if (!state || !held || state.phase !== 'incoming') return
  endOnServer(held)
  close(held.callId, { kind: 'ended', reason: 'declined' }, true)
}

/** Ends the call from this side — cancelling one that rings, or hanging up. */
export function hangUp(): void {
  const state = callState()
  const held = live
  if (!state || !held || state.phase === 'ended' || state.phase === 'incoming') return
  held.endedByMe = true
  endOnServer(held)
  close(
    held.callId,
    { kind: 'ended', reason: state.phase === 'outgoing' ? 'cancelled' : 'hangup' },
    true,
  )
}

export function toggleMicrophone(): void {
  const state = callState()
  if (!state || !live?.session) return
  const micOn = !state.micOn
  live.session.setMicrophone(micOn)
  dispatchCall({ type: 'localMedia', callId: state.callId, micOn })
  sendMediaState()
}

/**
 * Resolves to whether the camera is on afterwards. `false` after asking for
 * it on means the camera could not be had, and the screen says so.
 */
export async function toggleCamera(): Promise<boolean> {
  const state = callState()
  const held = live
  if (!state || !held?.session) return false
  const cameraOn = await held.session.setCamera(!state.cameraOn)
  if (live !== held) return false
  dispatchCall({ type: 'localMedia', callId: state.callId, cameraOn })
  if (held.local) setCallStreams({ local: held.local.stream })
  sendMediaState()
  return cameraOn
}

export async function flipCamera(): Promise<void> {
  const held = live
  if (!held?.session) return
  await held.session.flipCamera()
  if (live === held && held.local) setCallStreams({ local: held.local.stream })
}

export function setCallMinimized(value: boolean): void {
  dispatchCall({ type: 'minimized', value })
}

/** Closes the closing line early. */
export function dismissCall(): void {
  if (callState()?.phase === 'ended') settle(true, true)
}

/**
 * Asks the server what a call is doing, when this device has reason to doubt
 * what it believes — a deadline passed with no word, a socket came back.
 */
async function refreshFromServer(callId: string): Promise<void> {
  try {
    const status = await ask<{ call: CallView; ended?: CallEnded }>(CALL_EVENTS.status, { callId })
    if (status.ended) close(callId, { kind: 'ended', reason: status.ended.reason }, false)
  } catch (error) {
    // "Not found" about a call this device is showing means it is gone.
    if (error instanceof CallRefusal && error.code === 'NOT_FOUND') {
      close(callId, { kind: 'ended', reason: 'ended' }, false)
    }
  }
}

/**
 * Brings this device back in step with the server after a gap — the app coming
 * forward, a socket reconnecting. Two things can have been missed: a call that
 * started ringing while nobody was listening, and a call that ended.
 */
export async function resyncCalls(): Promise<void> {
  if (!engine.supported()) return
  const state = callState()
  const held = live

  if (state && held && state.phase !== 'ended') {
    // In a call, with a key: get back into its room. Without one the server
    // has not acknowledged this call yet, and there is nothing to rejoin.
    if (held.resumeKey) await rejoin(held)
    else if (state.phase === 'incoming') void refreshFromServer(held.callId)
    return
  }

  try {
    const { current } = await api.get<{ current: CurrentCall | null }>('/calls/current')
    if (!current || callState()) return
    if (current.role === 'callee' && current.call.state === 'ringing') {
      showIncoming({ call: current.call, caller: current.peer })
    }
  } catch {
    // Offline, or signed out mid-flight. The next resume asks again.
  }
}

function onIncoming(incoming: CallIncoming): void {
  if (!engine.supported()) return
  const state = callState()
  if (state && state.phase !== 'ended') {
    // Something is already on screen. Kept, in case that turns out to be this
    // device's own call to the same person — see `answerInstead`.
    pendingIncoming = incoming
    return
  }
  const wanted = answerNextFrom
  answerNextFrom = null
  showIncoming(incoming)
  if (wanted && wanted.peerId === incoming.caller._id && wanted.until > Date.now()) {
    void answerCall({ camera: wanted.camera }).catch(() => undefined)
  }
}

function onAccepted({ callId }: { callId: string }): void {
  const held = live
  if (!held || held.callId !== callId || held.role !== 'caller') return
  stopRinging()
  if (held.ringTimer) clearTimeout(held.ringTimer)
  held.ringTimer = null
  held.startedAt = Date.now()
  dispatchCall({ type: 'accepted', callId })
  startHeartbeat(held)
  held.giveUpTimer = setTimeout(
    () => {
      if (live !== held || held.connectedOnce) return
      endOnServer(held, 'connectFailed')
      close(callId, { kind: 'ended', reason: 'connectFailed' }, false)
    },
    (CALL_LIMITS.connectTimeoutSeconds + 5) * 1000,
  )
  const session = held.session
  if (!session) return
  void session
    .createOffer()
    .then((offer) => {
      if (live === held) sendSignal(callId, { description: offer })
    })
    .catch(() => undefined)
}

function onSignal(signal: CallSignal): void {
  if (live && live.callId === signal.callId) applySignal(live, signal)
}

function onEnded(ended: CallEnded): void {
  if (pendingIncoming?.call.callId === ended.callId) pendingIncoming = null
  close(ended.callId, { kind: 'ended', reason: ended.reason }, false)
}

function onRinging({ callId }: { callId: string }): void {
  dispatchCall({ type: 'remoteRinging', callId })
}

function onMedia(notice: CallMediaState): void {
  dispatchCall({
    type: 'remoteMedia',
    callId: notice.callId,
    audio: notice.audio,
    video: notice.video,
  })
}

function onConnect(): void {
  void resyncCalls()
}

/**
 * Hangs the call's events on the app's one socket. Called by `useCalls` once
 * the socket exists, and again with a new socket after a sign-in.
 */
export function attachCallSocket(next: Socket): () => void {
  socket = next
  next.on(CALL_EVENTS.incoming, onIncoming)
  next.on(CALL_EVENTS.accepted, onAccepted)
  next.on(CALL_EVENTS.signal, onSignal)
  next.on(CALL_EVENTS.ended, onEnded)
  next.on(CALL_EVENTS.ringing, onRinging)
  next.on(CALL_EVENTS.media, onMedia)
  // Fires on the first connection and on every one after a drop.
  next.on('connect', onConnect)
  if (next.connected) onConnect()

  return () => {
    next.off(CALL_EVENTS.incoming, onIncoming)
    next.off(CALL_EVENTS.accepted, onAccepted)
    next.off(CALL_EVENTS.signal, onSignal)
    next.off(CALL_EVENTS.ended, onEnded)
    next.off(CALL_EVENTS.ringing, onRinging)
    next.off(CALL_EVENTS.media, onMedia)
    next.off('connect', onConnect)
    /*
     * The socket is going — signing out, mostly. A call in progress goes with
     * it: said to the server while the socket can still say it, and taken off
     * the screen without a line, because the screen is going too.
     */
    const state = callState()
    if (live && state && state.phase !== 'ended') endOnServer(live)
    release()
    pendingIncoming = null
    answerNextFrom = null
    if (clearTimer) clearTimeout(clearTimer)
    clearTimer = null
    dispatchCall({ type: 'cleared' })
    if (socket === next) socket = null
  }
}
