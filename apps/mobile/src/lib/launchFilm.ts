/**
 * Whether this launch plays the opening in full.
 *
 * Only the very first launch does. The opening used to be a 2.7 s film, and
 * every cold start waited it out, ready app or not — fine as a first hello, a
 * toll on the hundredth. So the device remembers having shown it
 * (`FLAG_KEYS.launchFilmSeen`, a name kept from the film so nobody who has
 * seen one opening is shown the next one as if new), and every launch after
 * the first leaves as soon as the app is ready. A tap skips it on any launch,
 * the first included. The opening is the ink stamp now (`AppSplash`), and
 * "the film" below means it.
 *
 * Kept free of imports, like `splashTiming.ts`, so the rule can be tested
 * without a renderer; `AppSplash` reads and writes the flag.
 */

/**
 * `seen` is the stored flag: `undefined` while it is still being read. That
 * counts as a first launch — the read takes milliseconds, and cutting short
 * the one film somebody was meant to see is the worse mistake of the two.
 */
export function exitWaitsForFilm({
  seen,
  skipped,
}: {
  seen: boolean | undefined
  skipped: boolean
}): boolean {
  if (skipped) return false
  return seen !== true
}

/**
 * How long the reduced-motion mark still has to stay up. The floor is there so
 * a warm start does not flash the logo; a tap is somebody asking for it to go,
 * which no flicker argument outweighs.
 */
export function exitDelayMs({ floorMs, skipped }: { floorMs: number; skipped: boolean }): number {
  return skipped ? 0 : floorMs
}

/**
 * Which opening this launch gets:
 *
 * - `full`: the first launch. The ring draws, the badge presses and the
 *   partner discs pop out, then the sheet lifts once the app is ready too.
 * - `quick`: every later launch, and a tap on any launch. Nothing moves
 *   until the app is ready; then the ring closes and the sheet lifts at once.
 * - `still`: reduced motion. The badge holds and the layer dissolves.
 *
 * A flag still being read is a first launch, as in `exitWaitsForFilm`; the
 * component holds the opening's first frame, which is the native splash's,
 * until the read answers, so nothing starts that would have to change course.
 */
export type StampPlan = 'full' | 'quick' | 'still'

export function stampPlan({
  seen,
  skipped,
  reduceMotion,
}: {
  seen: boolean | undefined
  skipped: boolean
  reduceMotion: boolean
}): StampPlan {
  if (reduceMotion) return 'still'
  return exitWaitsForFilm({ seen, skipped }) ? 'full' : 'quick'
}
