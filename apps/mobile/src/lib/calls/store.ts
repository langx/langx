import { reduceCall, type CallEvent, type CallState } from './machine'

/**
 * The call on screen, held outside React.
 *
 * A module store rather than component state for the reason
 * `inAppNotifications.ts` is one: what changes it is a socket event, a media
 * engine callback or a timer, none of which belong to a screen, and the call
 * has to survive every screen it is shown over. The hosts read it with
 * `useSyncExternalStore`.
 *
 * Nothing in here does anything. `dispatch` runs the reducer and tells whoever
 * is listening; `session.ts` is what makes a call happen.
 */
let state: CallState | null = null
const listeners = new Set<() => void>()

export function callState(): CallState | null {
  return state
}

export function subscribeToCall(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function dispatchCall(event: CallEvent): CallState | null {
  const next = reduceCall(state, event)
  if (next === state) return state
  state = next
  for (const listener of listeners) listener()
  return state
}

export function resetCallStoreForTest(): void {
  state = null
  listeners.clear()
}
