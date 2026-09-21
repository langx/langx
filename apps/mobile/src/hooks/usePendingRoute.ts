import { router } from 'expo-router'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { takePendingRoute } from '../../modules/companion-snapshot'
import { pendingRouteHref } from '../lib/pendingRoute'

/**
 * Sends the app where an App Intent asked it to go.
 *
 * An intent that opens the app cannot navigate it: `openAppWhenRun` brings
 * the app forward and stops, and in this app "forward" is a React Native
 * runtime that may be starting cold with no router yet. So the intent leaves
 * a route in the App Group and this collects it.
 *
 * On mount **and** on every return to the foreground, because both are real:
 * the app may be launched by the intent, or it may already be in the
 * background when one runs. There is no event to subscribe to — the App
 * Group is a file, not a channel — so the check happens at the two moments
 * the app has any reason to look.
 *
 * Mounted beside the other signed-in hooks and gated the same way. A guest
 * has nowhere for any of these routes to land.
 */
export function usePendingRoute({ enabled }: { enabled: boolean }): void {
  useEffect(() => {
    if (!enabled) return

    const go = () => {
      // Only the routes this app actually has; `pendingRouteHref` says which
      // and why, and is where the conversation id is checked.
      const href = pendingRouteHref(takePendingRoute())
      if (href) router.push(href)
    }

    go()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') go()
    })
    return () => subscription.remove()
  }, [enabled])
}
