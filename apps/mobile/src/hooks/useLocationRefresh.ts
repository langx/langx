import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useMe, useShareLocation } from '../api/queries'
import { captureLocation } from '../lib/location'
import { shouldRefreshLocation } from '../lib/locationRefresh'

/**
 * Keeps a shared location from going stale, on foreground.
 *
 * `AppState`, not `setInterval`, and the reason is in `app.config.ts`: there is
 * no background location permission on either platform, and adding one would
 * change what both stores' privacy forms have to say. A timer therefore only
 * ever fires while the app is open — which is precisely what this listener
 * says, without pretending to be a schedule. `useAppConfig` already makes the
 * same argument: polling in the background spends battery to learn nothing.
 *
 * It is also the moment that matters. Somebody who opens the app after landing
 * in a new city gets a fresh position on their first foreground, which is
 * exactly when they would look at who is nearby.
 *
 * Silent throughout. This is not something the user asked for right now, so a
 * denied permission or a failed fix must not raise anything — they will find
 * out when they next use the feature deliberately.
 */
export function useLocationRefresh({ enabled = true }: { enabled?: boolean } = {}): void {
  const me = useMe()
  const share = useShareLocation()
  // Guards against a second run while one is in flight — foregrounding twice
  // in quick succession is ordinary, and two fixes would be two writes.
  const busy = useRef(false)

  const hasLocation = me.data?.location !== undefined
  const updatedAt = me.data?.locationUpdatedAt

  useEffect(() => {
    if (!enabled) return
    async function refresh(): Promise<void> {
      if (busy.current) return
      if (!shouldRefreshLocation({ hasLocation, locationUpdatedAt: updatedAt })) return
      busy.current = true
      try {
        // `promptIfNeeded: false` is the whole safety of this: without it a
        // permission dialog could appear on returning to the app, unconnected
        // to anything the person tapped.
        const fix = await captureLocation({ promptIfNeeded: false })
        if (fix.ok) share.mutate({ lat: fix.lat, lng: fix.lng })
      } finally {
        busy.current = false
      }
    }

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh()
    })
    // Once on mount too: the app is already foreground when this first runs,
    // so waiting for a change event would skip the launch that opened it.
    void refresh()
    return () => subscription.remove()
    // Keyed on the two values the decision actually reads, plus the mutation
    // object react-query keeps stable across renders.
  }, [enabled, hasLocation, updatedAt, share])
}
