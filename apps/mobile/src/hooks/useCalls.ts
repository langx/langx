import { useEffect, useState, useSyncExternalStore } from 'react'
import { AppState, Platform } from 'react-native'
import { formatCallDuration } from '../lib/calls/callLabels'
import type { CallState } from '../lib/calls/machine'
import { attachCallSocket, engineSupported, hangUp, resyncCalls } from '../lib/calls/session'
import { callState, subscribeToCall } from '../lib/calls/store'
import { callStreams, subscribeToCallStreams, type CallStreams } from '../lib/calls/streams'
import { resumedFromBackground } from '../lib/missedEvents'
import { getSocket } from '../lib/socket'

/**
 * Lets calls reach this device, for as long as somebody is signed in.
 *
 * Mounted once, beside `useSocket`, and for its reason: a call is not a
 * screen's. It hangs the call's events on the app's one socket and takes them
 * off again when the account goes — which also ends a call in progress, said
 * to the server while the socket can still say it.
 *
 * **Called before `useSocket`.** Effects are cleaned up in the order they were
 * declared, and that hook's cleanup closes the socket this one's has a last
 * word to say on.
 *
 * A build with no media engine does nothing here at all: it declared no
 * capability on the socket, so no call event will ever be sent to it.
 */
export function useCalls({ enabled = true }: { enabled?: boolean } = {}): void {
  useEffect(() => {
    if (!enabled || !engineSupported()) return
    let cancelled = false
    let detach: (() => void) | null = null

    void getSocket().then((socket) => {
      if (cancelled) return
      detach = attachCallSocket(socket)
    })

    /*
     * A phone that was in a pocket has no socket, and a call that started
     * ringing meanwhile was never a `call:incoming` here. Coming back to the
     * front asks the server what is ringing — the socket reconnecting asks the
     * same question, and whichever is second finds the call already on screen.
     */
    let lastAppState = AppState.currentState
    const appState = AppState.addEventListener('change', (next) => {
      if (resumedFromBackground(lastAppState, next)) void resyncCalls()
      lastAppState = next
    })

    /*
     * Closing the tab mid-call. The frame usually gets out; when it does not,
     * the other side's own thirty seconds of trying to reconnect ends the call
     * for them, and the server's lease ends it for the record.
     */
    const leaving = (): void => hangUp()
    const onWeb = Platform.OS === 'web' && typeof window !== 'undefined'
    if (onWeb) window.addEventListener('pagehide', leaving)

    return () => {
      cancelled = true
      appState.remove()
      if (onWeb) window.removeEventListener('pagehide', leaving)
      detach?.()
    }
  }, [enabled])
}

/** The call on screen, or `null`. Re-renders on every change to it. */
export function useCallState(): CallState | null {
  return useSyncExternalStore(subscribeToCall, callState, callState)
}

/** The two pictures of the call. Re-renders when a track comes or goes. */
export function useCallStreams(): CallStreams {
  return useSyncExternalStore(subscribeToCallStreams, callStreams, callStreams)
}

/**
 * How long the call has been up, as its clock reads — or `null` before it is.
 *
 * Counted from `connectedAt` on every tick rather than incremented, so a tab
 * the browser throttled in the background shows the right time the moment it
 * is looked at again.
 */
export function useCallClock(call: CallState | null): string | null {
  const connectedAt = call?.phase === 'active' ? call.connectedAt : null
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (connectedAt === null) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [connectedAt])

  return connectedAt === null ? null : formatCallDuration((now - connectedAt) / 1000)
}
