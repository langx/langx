import { useSegments } from 'expo-router'
import { useEffect } from 'react'
import { trackScreen } from '../lib/analytics'
import { screenNameFromSegments } from '../lib/analyticsScreen'

/**
 * One `$screen` per route change, named after the route file.
 *
 * Expo Router sits on React Navigation but does not expose its container, so
 * PostHog's own screen autocapture cannot see it — the SDK's docs say as much.
 * The URL is always known instead, and the segments are the URL with the
 * values taken out; see `screenNameFromSegments` for why that is the version
 * sent.
 *
 * Mounted once, in the root layout, so it outlives every screen; keyed on the
 * joined name so a re-render that changes nothing sends nothing.
 */
export function useScreenTracking(): void {
  const segments = useSegments()
  const name = screenNameFromSegments(segments)
  useEffect(() => {
    trackScreen(name)
  }, [name])
}
