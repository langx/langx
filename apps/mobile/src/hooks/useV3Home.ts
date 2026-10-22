import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  announceV3Home,
  latchV3Home,
  subscribeV3Home,
  v3HomeSnapshot,
  v3HomeWaitLeft,
} from '../lib/v3Home'
import { useAppConfig } from './useAppConfig'

/**
 * Whether the config has said anything yet. The landing is Home or Discover
 * by this flag, and landing on the wrong one would be the bar rearranging a
 * moment after launch, so `app/index.tsx` holds the splash until it has.
 *
 * Settled after one attempt, success or not. The query retries once, and a
 * launch must not wait out that retry for a flag: an unreachable config is
 * today's tabs (`latchV3Home`). A request held back for want of a network is
 * settled too, for `app/index.tsx`'s own reason — it will never fire. A
 * request that is simply slow is `useV3HomeDecision`'s ceiling to cut short.
 */
function appConfigSettled(config: {
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
 * callers that have to wait rather than assume off: the launch splash, and
 * Home's own route, which with the flag off sends itself to Discover and on a
 * web page load would otherwise do that before the config had said anything.
 *
 * Never `undefined` for longer than `V3_HOME_WAIT_MS` from launch (`useV3HomeLatch`):
 * past that the answer is taken from whatever the config has said by then,
 * which for a request still out is nothing, and so off.
 */
export function useV3HomeDecision(): boolean | undefined {
  return useSyncExternalStore(subscribeV3Home, v3HomeSnapshot, v3HomeSnapshot)
}

/**
 * What decides it: the config query and the wait's clock, run once, by the
 * root layout. Every `useV3Home` reads the store this fills rather than
 * subscribing to the config itself — see `subscribeV3Home`.
 */
export function useV3HomeLatch(): void {
  const config = useAppConfig()
  const [waitOver, setWaitOver] = useState(false)
  // The clock starts in an effect, never during render: the web export
  // prerenders, and a clock started there would run out mid-build and latch
  // the build's own "off" into pages the browser then hydrates differently.
  useEffect(() => {
    const timer = setTimeout(() => setWaitOver(true), v3HomeWaitLeft(Date.now()))
    return () => clearTimeout(timer)
  }, [])
  // Latched during render, as it always was, so anything rendered after the
  // root in the same pass already reads the answer; announced after commit
  // for whatever rendered before it.
  const decision = latchV3Home({
    settled: waitOver || appConfigSettled(config),
    on: config.data?.flags.v3Home === true,
  })
  useEffect(() => {
    if (decision !== undefined) announceV3Home()
  }, [decision])
}
