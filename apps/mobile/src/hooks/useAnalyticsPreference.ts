import { useEffect, useState } from 'react'
import {
  isAnalyticsEnabled,
  isAnalyticsSettled,
  setAnalyticsEnabled,
  startAnalytics,
  subscribeAnalytics,
} from '../lib/analytics'

/**
 * The Settings switch for usage analytics.
 *
 * A subscription onto `lib/analytics` rather than state of its own, following
 * `useTips`: the answer lives in one module-level place, so the root layout
 * (which starts the SDK) and Settings (which turns it off) cannot disagree.
 */
export function useAnalyticsPreference() {
  const [, force] = useState(0)

  useEffect(() => {
    const unsubscribe = subscribeAnalytics(() => force((n) => n + 1))
    void startAnalytics()
    return unsubscribe
  }, [])

  return {
    enabled: isAnalyticsEnabled(),
    /** Whether the stored answer has been read; until then `enabled` is the default. */
    settled: isAnalyticsSettled(),
    setEnabled: (enabled: boolean) => setAnalyticsEnabled(enabled),
  }
}
