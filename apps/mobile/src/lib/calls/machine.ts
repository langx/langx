import type { CallEndReason, CallMedia, CallPeer } from '@langx/shared'

/**
 * What a call looks like from this device, at each moment it is on screen.
 *
 * Narrower than the server's states and named for what the person sees: the
 * server has one `ringing`, and here it is two — `outgoing` and `incoming` —
 * because who is waiting on whom is the whole difference between the screens.
 * `ended` is the closing line a call shows for a moment before it goes.
 */
export type CallPhase = 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended'

/**
 * Why the call on screen stopped, as this device words it. The server's
 * reasons, plus the refusals a call can meet before it ever rings — those
 * arrive as error codes rather than as a `call:ended`.
 */
export type CallClosing =
  | { kind: 'ended'; reason: CallEndReason }
  /**
   * The server refused to place it. `code` is the API's error code, and
   * `reason` the detail a code with two meanings carries — whose switch it
   * was that refused, for `CALLS_REFUSED`.
   */
  | { kind: 'refused'; code: string; reason?: string }

export interface CallState {
  callId: string
  conversationId: string
  role: 'caller' | 'callee'
  peer: CallPeer
  /** What the call was placed as. A video call answered without a camera is still one. */
  media: CallMedia
  phase: CallPhase
  /** Outgoing only: a device of theirs has actually started ringing. */
  remoteRinging: boolean
  /** When ringing gives up, on *this* device's clock. */
  ringUntil: number
  /** When media first flowed, on this device's clock. The timer counts from it. */
  connectedAt: number | null
  micOn: boolean
  cameraOn: boolean
  /** What the other side said about its own microphone and camera. */
  remoteMicOn: boolean
  remoteCameraOn: boolean
  /** The media path dropped and is being rebuilt. The call is not over. */
  reconnecting: boolean
  /** The call screen is put away and the call goes on behind a small bar. */
  minimized: boolean
  closing: CallClosing | null
}

export type CallEvent =
  | {
      type: 'placed' | 'incoming'
      callId: string
      conversationId: string
      peer: CallPeer
      media: CallMedia
      ringUntil: number
    }
  /** A fact about the call learned later: the server's own deadline for the ring. */
  | { type: 'ringUntil'; callId: string; ringUntil: number }
  | { type: 'remoteRinging'; callId: string }
  /** The callee tapped answer. `cameraOn` is whether they answered with it. */
  | { type: 'answering'; callId: string; cameraOn: boolean }
  /** The caller was told the other person picked up. */
  | { type: 'accepted'; callId: string }
  | { type: 'connected'; callId: string; at: number }
  | { type: 'reconnecting'; callId: string; value: boolean }
  | { type: 'localMedia'; callId: string; micOn?: boolean; cameraOn?: boolean }
  | { type: 'remoteMedia'; callId: string; audio: boolean; video: boolean }
  | { type: 'minimized'; value: boolean }
  | { type: 'closed'; callId: string; closing: CallClosing }
  | { type: 'cleared' }

/**
 * The call on screen, as a pure function of what has happened to it.
 *
 * Everything that *does* something — the socket, the media engine, the ringer,
 * the timers — lives in `session.ts`, and tells this what happened. Keeping
 * the two apart is what lets the rules be read and tested in one place: which
 * events a call in each phase listens to, and that an event about some other
 * call changes nothing.
 *
 * That last rule is the one that matters. Events arrive late: a `call:ended`
 * for a call that was already replaced on screen, a media notice for one that
 * has closed. Every event but the two that start a call and the one that
 * clears the screen names its call, and is dropped unless that is the call
 * being shown.
 */
export function reduceCall(state: CallState | null, event: CallEvent): CallState | null {
  if (event.type === 'cleared') return null

  if (event.type === 'placed' || event.type === 'incoming') {
    // A new call replaces only a closing line, never a call still in progress:
    // the session decides what to do about a ring that arrives mid-call.
    if (state && state.phase !== 'ended') return state
    const caller = event.type === 'placed'
    return {
      callId: event.callId,
      conversationId: event.conversationId,
      role: caller ? 'caller' : 'callee',
      peer: event.peer,
      media: event.media,
      phase: caller ? 'outgoing' : 'incoming',
      remoteRinging: false,
      ringUntil: event.ringUntil,
      connectedAt: null,
      micOn: true,
      // The caller of a video call starts with the camera on — they chose it.
      // Somebody being called has chosen nothing yet.
      cameraOn: caller && event.media === 'video',
      remoteMicOn: true,
      // Assumed until they say otherwise: a video call that draws a blank
      // tile while waiting for a notice looks broken, and the notice arrives
      // with the first frames.
      remoteCameraOn: event.media === 'video',
      reconnecting: false,
      minimized: false,
      closing: null,
    }
  }

  if (!state) return null

  if (event.type === 'minimized') {
    // Only a call that is up can be put away. A ringing one has to be seen.
    if (state.phase !== 'connecting' && state.phase !== 'active') return state
    return { ...state, minimized: event.value }
  }

  if (event.callId !== state.callId) return state

  switch (event.type) {
    case 'ringUntil':
      return { ...state, ringUntil: event.ringUntil }
    case 'remoteRinging':
      return state.phase === 'outgoing' ? { ...state, remoteRinging: true } : state
    case 'answering':
      if (state.phase !== 'incoming') return state
      return { ...state, phase: 'connecting', cameraOn: event.cameraOn }
    case 'accepted':
      return state.phase === 'outgoing' ? { ...state, phase: 'connecting' } : state
    case 'connected':
      if (state.phase !== 'connecting' && state.phase !== 'active') return state
      return {
        ...state,
        phase: 'active',
        // The first connection starts the clock. A reconnection must not
        // restart it: the call did not begin again.
        connectedAt: state.connectedAt ?? event.at,
        reconnecting: false,
      }
    case 'reconnecting':
      return state.phase === 'active' || state.phase === 'connecting'
        ? { ...state, reconnecting: event.value }
        : state
    case 'localMedia':
      return {
        ...state,
        ...(event.micOn === undefined ? {} : { micOn: event.micOn }),
        ...(event.cameraOn === undefined ? {} : { cameraOn: event.cameraOn }),
      }
    case 'remoteMedia':
      return { ...state, remoteMicOn: event.audio, remoteCameraOn: event.video }
    case 'closed':
      if (state.phase === 'ended') return state
      return {
        ...state,
        phase: 'ended',
        reconnecting: false,
        // A closing line is always shown in full: the bar it was hiding
        // behind has nothing left to return to.
        minimized: false,
        closing: event.closing,
      }
  }
}

/**
 * Whether the closing line is worth showing, or the screen should simply go.
 *
 * A call somebody turned down themselves, one that was answered on their other
 * phone, or one the caller gave up on while it rang here: in each the person
 * looking at this screen already knows what happened, or it happened
 * elsewhere, and a card saying so is one more thing to dismiss.
 */
export function showsClosingLine(state: CallState, endedByMe: boolean): boolean {
  const closing = state.closing
  if (!closing) return false
  if (closing.kind === 'refused') return true
  if (closing.reason === 'answeredElsewhere') return false
  if (state.role === 'callee' && state.connectedAt === null) return false
  if (endedByMe && state.connectedAt === null) return false
  return true
}
