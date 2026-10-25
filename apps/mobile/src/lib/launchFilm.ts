/**
 * Whether this launch plays the opening film to its end.
 *
 * Only the very first launch does. The film is 2.4 s, and every cold start
 * used to wait it out in full, ready app or not — fine as a first hello,
 * a toll on the hundredth. So the device remembers having shown it
 * (`FLAG_KEYS.launchFilmSeen`), and every launch after the first leaves as
 * soon as the app is ready, cutting the film wherever it has got to. A tap
 * skips it on any launch, the first included.
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
 * a fast boot does not flash the logo at somebody who has never seen it; a tap
 * is somebody asking for it to go, which no flicker argument outweighs.
 *
 * Only on the first launch, for the film's reason: the mark is a hello, and
 * from the second launch on the app is what they opened it for. The mark's own
 * dissolve (`EXIT_TILE_MS`) is still there, so it never blinks out.
 *
 * `seen` is `FLAG_KEYS.launchSeen`, not the film's flag: with reduce motion on
 * there is no film, so that one is never written, and every launch would count
 * as the first. `undefined` while it is read counts as a first launch, as it
 * does for the film.
 */
export function exitDelayMs({
  floorMs,
  skipped,
  seen,
}: {
  floorMs: number
  skipped: boolean
  seen: boolean | undefined
}): number {
  if (skipped || seen === true) return 0
  return floorMs
}
