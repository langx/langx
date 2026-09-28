/**
 * `work`'s result, or `null` once `ms` have passed without one.
 *
 * For native calls that have no timeout of their own and can simply not come
 * back — a GPS fix indoors, a geocoder with no network. The work itself is not
 * cancelled, only no longer waited for; a rejection after the deadline is
 * absorbed rather than left unhandled.
 */
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  // `race` subscribes to `work`, which is what keeps a late rejection handled.
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer))
}
