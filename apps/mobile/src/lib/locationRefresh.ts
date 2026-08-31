import { LOCATION_REFRESH_MIN_GAP_MS } from '@langx/shared'

/**
 * Whether a shared location is stale enough to be worth refreshing.
 *
 * Pure, and separate from the hook, because this is the decision — the hook is
 * only the wiring, and `vitest.config.ts` cannot see hooks.
 */
export function shouldRefreshLocation(input: {
  /** Absent means the person is not sharing at all; nothing to refresh. */
  hasLocation: boolean
  /** When it was last written. Absent on a point stored before the field existed. */
  locationUpdatedAt?: string | undefined
  now?: Date
}): boolean {
  if (!input.hasLocation) return false
  // A point with no timestamp predates `locationUpdatedAt`. Refreshing it once
  // is how it acquires one, and it is by definition older than the gap.
  if (!input.locationUpdatedAt) return true

  const at = Date.parse(input.locationUpdatedAt)
  // An unparseable date is not evidence of staleness, but it is not evidence of
  // freshness either — and one silent refresh is cheaper than a location that
  // can never update again.
  if (Number.isNaN(at)) return true

  const now = (input.now ?? new Date()).getTime()
  // A timestamp in the future is a clock skew, not a reason to refresh.
  if (at > now) return false
  return now - at >= LOCATION_REFRESH_MIN_GAP_MS
}
