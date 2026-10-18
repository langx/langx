import { latchV3Home } from '../lib/v3Home'
import { useAppConfig } from './useAppConfig'

/**
 * Whether the config has said anything yet, for `app/index.tsx`, which holds
 * the splash until it has — the landing is Home or Discover by this flag, and
 * landing on the wrong one would be the bar rearranging a moment after launch.
 *
 * Settled after one attempt, success or not. The query retries once, and a
 * launch must not wait out that retry for a flag: an unreachable config is
 * today's tabs (`latchV3Home`). A request held back for want of a network is
 * settled too, for `app/index.tsx`'s own reason — it will never fire.
 */
export function appConfigSettled(config: {
  isPending: boolean
  fetchStatus: string
  failureCount: number
}): boolean {
  return !config.isPending || config.fetchStatus === 'paused' || config.failureCount > 0
}

/**
 * The redesign's Home tab and its bar, behind `flags.v3Home` — read once per
 * launch; see `latchV3Home` for why it does not follow the flag live.
 *
 * `=== true`, not truthiness alone: an API older than the flag sends no such
 * key, and that has to mean off.
 */
export function useV3Home(): boolean {
  return useV3HomeDecision() ?? false
}

/**
 * The same answer, or `undefined` while the config has not settled — for the
 * one caller that has to wait rather than assume off: Home's own route, which
 * with the flag off sends itself to Discover, and on a web page load would
 * otherwise do that before the config had said anything.
 */
export function useV3HomeDecision(): boolean | undefined {
  const config = useAppConfig()
  return latchV3Home({
    settled: appConfigSettled(config),
    on: config.data?.flags.v3Home === true,
  })
}
