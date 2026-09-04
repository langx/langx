/**
 * Whose pull the spinner belongs to.
 *
 * Every pull-to-refresh in the app used to wire `RefreshControl`'s
 * `refreshing` straight to React Query's `isRefetching`, which is true for
 * **any** background refetch. With a 30-second `staleTime` and React Query's
 * default `refetchOnMount`, coming back to a tab after half a minute starts
 * one — so the spinner appeared having never been pulled, and on the tab's
 * first mount the control was born with `refreshing: true`. A native
 * `RefreshControl` handles that badly: it has no gesture to animate out of, so
 * it holds both the spinner *and* the content inset it opened for it, which is
 * the empty band that pushed the first row a quarter of a screen down.
 *
 * So the spinner reflects a pull and nothing else. A pull takes the next
 * number; only the settle of the pull that is currently on screen closes it.
 * That is the whole rule, and it is here rather than inside the hook because
 * the two ways it goes wrong — an older request settling after a newer pull,
 * and a settle arriving for a screen that has gone — are exactly the kind of
 * thing that is only ever wrong intermittently, on a tab switch, on somebody
 * else's phone.
 */

/** No pull is on screen; the control is closed. */
export const NO_PULL = 0

/** The number for a pull starting now, given the last one handed out. */
export function nextPull(previous: number): number {
  return previous + 1
}

/**
 * What the control shows once `settled` has finished.
 *
 * A settle that does not belong to the pull on screen changes nothing: pull,
 * let go, pull again, and the first request coming back must not close the
 * spinner the second pull is still waiting on.
 */
export function settlePull(active: number, settled: number): number {
  return active === settled ? NO_PULL : active
}

export function isPulling(active: number): boolean {
  return active !== NO_PULL
}
