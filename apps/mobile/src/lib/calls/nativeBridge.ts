import { CALL_PROTOCOL_VERSION, type RegisterCallEndpointInput } from '@langx/shared'
import { Platform } from 'react-native'
import {
  callsNativeAvailable,
  configureCallsNative,
  onNativeCallAction,
  startOngoingCall,
  stopNativeRinging,
  stopOngoingCall,
  takePendingCallAction,
} from '../../../modules/calls'
import { api } from '../../api/client'
import { API_URL } from '../apiUrl'
import { deviceId } from '../deviceId'
import type { CallState } from './machine'
import { answerCall, declineCall, hangUp, resyncCalls } from './session'
import { callState, subscribeToCall } from './store'

/**
 * Keeps the phone's own call furniture in step with the call on screen.
 *
 * Android draws two things itself and has to be told about each: the ring a
 * call makes while the app is closed (`CallService` in `modules/calls`), and
 * the "call in progress" notification that also keeps the microphone running
 * when the screen goes off. This watches the call the session holds and
 * starts and stops them; and it carries the taps on them back — Answer and
 * Decline from the ring, Hang up from the call in progress.
 *
 * Nothing at all where the module is absent: the web, and every binary from
 * before calls reached phones.
 */
export function startNativeCallBridge(): () => void {
  if (!callsNativeAvailable()) return () => undefined
  configureCallsNative(API_URL)
  void registerEndpoint()

  let previous: CallState | null = callState()
  const unsubscribe = subscribeToCall(() => {
    const next = callState()
    follow(previous, next)
    previous = next
  })
  const stopActions = onNativeCallAction((action) => {
    if (action.type === 'pending') void takePendingAction()
    else if (action.type === 'hangUp') hangUp()
    else if (action.type === 'declined') {
      // Turned down from the notification while the app also had it on
      // screen. The server has been told already; this only closes it here.
      const state = callState()
      if (state?.phase === 'incoming' && state.callId === action.callId) declineCall()
    }
  })
  void takePendingAction()

  return () => {
    unsubscribe()
    stopActions()
    stopOngoingCall()
  }
}

/**
 * The call a notification opened the app for. Called at start, on every
 * return to the front, and when the module says a tap just arrived — whichever
 * comes first finds it, and the others find nothing.
 */
export async function takePendingAction(): Promise<void> {
  const action = takePendingCallAction()
  if (!action) return
  if (action.answer) wanted = { callId: action.callId, until: Date.now() + WANTED_FOR_MS }
  // The ring arrived as a push, so the call may not be on screen yet.
  if (callState()?.callId !== action.callId) await resyncCalls()
  answerIfWanted(callState())
}

/**
 * An Answer tapped on the notification, held until its call is on screen.
 *
 * From a cold start the tap is read long before the call can be shown: the
 * session is still being read from storage and the socket is still
 * connecting, so the first look at the server finds nothing to show, and the
 * call arrives a few seconds later by the socket's own resync. Taken and
 * dropped at the first look, the tap was lost and the phone sat on the
 * ringing screen of a call somebody had already answered.
 */
let wanted: { callId: string; until: number } | null = null
const WANTED_FOR_MS = 60_000

function answerIfWanted(state: CallState | null): void {
  if (!wanted || !state || state.callId !== wanted.callId) return
  if (Date.now() > wanted.until) {
    wanted = null
    return
  }
  if (state.phase !== 'incoming') return
  wanted = null
  void answerCall({ camera: state.media === 'video' }).catch(() => undefined)
}

function follow(previous: CallState | null, next: CallState | null): void {
  answerIfWanted(next)
  const wasRinging = previous?.phase === 'incoming'
  const ringing = next?.phase === 'incoming' && next.callId === previous?.callId
  if (wasRinging && !ringing) stopNativeRinging(previous.callId)

  const up = (state: CallState | null) =>
    state !== null && (state.phase === 'connecting' || state.phase === 'active')
  if (up(next) && !(up(previous) && previous?.callId === next?.callId)) {
    startOngoingCall(next!.peer.displayName, next!.media === 'video')
  } else if (!up(next) && up(previous)) {
    stopOngoingCall()
  }
}

/**
 * "This phone can be rung while its app is closed." Android's ring travels
 * with the push token the phone already registered, so the endpoint names
 * the device and nothing else. Once per launch: the server keeps it until the
 * device is signed out.
 */
async function registerEndpoint(): Promise<void> {
  if (Platform.OS !== 'android') return
  const body: RegisterCallEndpointInput = {
    deviceId: await deviceId(),
    platform: 'android',
    protocol: CALL_PROTOCOL_VERSION,
  }
  await api
    .request('/me/call-endpoint', { method: 'PUT', body: JSON.stringify(body) })
    .catch(() => undefined)
}
