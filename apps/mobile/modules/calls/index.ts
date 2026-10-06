import { requireOptionalNativeModule } from 'expo'

/**
 * The call's native half: Android's ring and call-in-progress notification,
 * and the tap that opened the app for a call.
 *
 * Optional, like every module here: a build without it — the web, and every
 * binary from before calls reached phones — gets no-ops, so JavaScript calls
 * these without asking first.
 */
interface CallsNative {
  configure: (baseUrl: string) => void
  takePendingAction: () => { callId: string; answer: boolean } | null
  stopRinging: (callId: string | null) => void
  startOngoing: (name: string, video: boolean) => void
  stopOngoing: () => void
  setSpeakerphone: (on: boolean) => void
  addListener: (
    event: 'onCallAction',
    listener: (action: CallNativeAction) => void,
  ) => { remove: () => void }
}

export interface CallNativeAction {
  type: 'pending' | 'declined' | 'hangUp'
  callId?: string | null
}

const native = requireOptionalNativeModule<CallsNative>('Calls')

export function callsNativeAvailable(): boolean {
  return native != null
}

export function configureCallsNative(baseUrl: string): void {
  native?.configure(baseUrl)
}

export function takePendingCallAction(): { callId: string; answer: boolean } | null {
  return native?.takePendingAction() ?? null
}

export function stopNativeRinging(callId: string | null): void {
  native?.stopRinging(callId)
}

export function startOngoingCall(name: string, video: boolean): void {
  native?.startOngoing(name, video)
}

export function stopOngoingCall(): void {
  native?.stopOngoing()
}

export function setSpeakerphone(on: boolean): void {
  native?.setSpeakerphone(on)
}

export function onNativeCallAction(listener: (action: CallNativeAction) => void): () => void {
  const subscription = native?.addListener('onCallAction', listener)
  return () => subscription?.remove()
}
