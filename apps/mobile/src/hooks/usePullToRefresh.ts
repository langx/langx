import { onlineManager } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { currentTranslate } from '../i18n/runtime'
import { isPulling, nextPull, NO_PULL, settlePull } from '../lib/pullToRefresh'
import { showToast } from '../lib/toast'

/**
 * `refreshing` and `onRefresh` for a `RefreshControl`, driven by the pull
 * rather than by React Query's fetch state.
 *
 * Spreads into a `RefreshControl` and into `Screen`'s own
 * `onRefresh`/`refreshing` props, which is why twelve screens could move onto
 * it without any of them changing shape.
 *
 * Two properties matter, and neither can be had from query state:
 *
 * 1. **It is impossible to mount already refreshing.** The initial value is
 *    always closed and only `onRefresh` opens it, so a screen that mounts
 *    while a background refetch is in flight — a tab's first visit, a search
 *    toggle remounting the list — cannot inherit a spinner it never opened,
 *    and cannot inherit the content inset that came with it.
 * 2. **A settle for a screen that has gone is dropped.** Switching tabs
 *    mid-pull is the reported trigger; the screen must come back closed rather
 *    than resuming a pull with no gesture behind it.
 *
 * A background refetch now shows no indicator at all. That is the point: the
 * screens already have skeletons for a first load, and a spinner nobody asked
 * for was the complaint.
 */
export function usePullToRefresh(refetch: () => unknown): {
  refreshing: boolean
  onRefresh: () => void
} {
  const [active, setActive] = useState(NO_PULL)
  const counter = useRef(NO_PULL)

  /*
   * Held in a ref so `onRefresh` is stable even though every call site passes
   * a fresh arrow — `RefreshControl` is cheap to re-render, but a stable
   * handler keeps this hook from being the reason a memo somewhere is missed.
   */
  const latest = useRef(refetch)
  latest.current = refetch

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const onRefresh = useCallback(() => {
    const pull = nextPull(counter.current)
    counter.current = pull
    setActive(pull)
    // `refetch` may return a promise or nothing (`me.tsx` refreshes four
    // queries with `Promise.all`); either way the control closes when it is
    // done, and a rejection closes it too — a spinner that outlives a failed
    // request is the same stuck spinner in a different disguise.
    void Promise.resolve(latest.current())
      .catch(() => undefined)
      .finally(() => {
        if (!mounted.current) return
        /*
         * `refetch()` resolves whether or not it worked — react-query hands
         * the error back in the result rather than rejecting — so there is no
         * failure to catch here without changing twelve call sites. The state
         * of the radio answers the only question a pull actually asks: a
         * spinner that opens and closes with nothing new on screen is read as
         * "there is nothing new", and in a tunnel that is not what happened.
         */
        if (!onlineManager.isOnline()) showToast(currentTranslate()('errors.offlineAction'))
        setActive((current) => settlePull(current, pull))
      })
  }, [])

  return { refreshing: isPulling(active), onRefresh }
}
