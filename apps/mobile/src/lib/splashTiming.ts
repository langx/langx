/**
 * The numbers behind the opening animation, and the pieces of arithmetic in it
 * that are easy to get wrong.
 *
 * Split from the component for the reason `swipeAction` and `pinch` are: a
 * renderer cannot be loaded in this package's tests, and "did a fast boot flash
 * the logo for two frames" is a question about numbers.
 */

/**
 * Named before the table because two entries in it are the same number, and
 * they have to be. See `EXIT_GROUND_DELAY_MS`.
 */
const EXIT_TILE_MS = 260

export const SPLASH_TIMING = {
  /**
   * How long the logo stays up at minimum, measured from mount, when it is the
   * whole opening: with reduced motion on, where there is no film to wait for,
   * and on the device's first launch only (`exitDelayMs` in `launchFilm.ts`).
   *
   * A fast boot resolves the session almost immediately, and without a floor
   * the logo would appear and vanish inside about eighty milliseconds — read
   * as a flicker, not as an opening. From the second launch on the logo is no
   * longer a hello, and its own dissolve is enough.
   */
  MIN_VISIBLE_MS: 800,
  /**
   * Nothing signalled. Not "the app is fine" — just "stop hiding it": whatever
   * is slow, the reader is better off seeing the screen behind this and its
   * own spinner than a logo held at them indefinitely.
   */
  TIMEOUT_MS: 5000,
  /**
   * The film's own length: `assets/splash/intro.mp4`, 144 frames at 60 fps.
   * A test reads the file and holds this to it, because the stall guard below
   * is measured from it.
   *
   * Longer than the 1.8 s hellos film it replaced: Venus dropping in and
   * slow-blinking needs the extra 0.6 s, and only the device's first launch
   * waits the film out (`launchFilm.ts`); every later one leaves as soon as
   * the app is ready, wherever the film has got to.
   */
  INTRO_MS: 2400,
  /**
   * How long the light film's yellow takes to close into the badge, leaving
   * the white card round it (`T.close` in `tools/showreel/src/splash/splash.js`).
   * The bars beside a `contain` film turn white over the same time.
   */
  PAPER_MS: 460,
  /**
   * How long the yellow waits, once the native splash has gone, for the film
   * to start playing before giving up on it and leaving from the yellow
   * instead. A slow disk or a decoder that
   * never answers must not turn the opening into a yellow screen.
   */
  INTRO_WAIT_MS: 1500,
  /**
   * Past the film's length, how long a film that started but never reported
   * its end is given. A film can start and then stall — a decoder that stops,
   * a buffer that never refills — and the end event is then never sent, so it
   * cannot be the only way out.
   */
  INTRO_STALL_MS: 1500,
  /** The whole layer lifting off the app once the film is over and the app is up. */
  EXIT_FADE_MS: 300,
  /**
   * With reduced motion, the still mark dissolving in place. Scale stays at 1:
   * drifting towards the reader is exactly the movement they turned off.
   */
  EXIT_TILE_MS,
  /**
   * The ground waits for the mark to be **gone**, not merely on its way out,
   * which is why this is `EXIT_TILE_MS` exactly rather than a smaller number
   * that overlaps it prettily.
   *
   * Overlapping them was the first version, and stepping the web build through
   * a slowed exit frame by frame is what caught it: the ground is the only
   * opaque thing on this screen, so while it is at half opacity the app behind
   * shows *through the badge* — the welcome screen's headline and buttons
   * legible through a logo that has not finished leaving.
   * The badge dissolves late by design (`Easing.in`), so even a short overlap
   * catches it at a third of its opacity, which is far from invisible.
   *
   * (That was measured with the old badge on the theme's own ground; the
   * ground is the brand yellow now, but the rule holds for the same reason:
   * a half-transparent ground shows the app through a logo still leaving.)
   */
  EXIT_GROUND_DELAY_MS: EXIT_TILE_MS,
  EXIT_GROUND_MS: 240,
} as const

/**
 * How much longer the exit has to wait so a fast boot does not flash.
 *
 * Clamped at zero from both ends: a slow boot has already earned its exit, and
 * a clock that jumped backwards mid-launch must not push the exit into next
 * week.
 */
export function msUntilExitAllowed(mountedAtMs: number, nowMs: number): number {
  const elapsed = nowMs - mountedAtMs
  if (!Number.isFinite(elapsed) || elapsed < 0) return SPLASH_TIMING.MIN_VISIBLE_MS
  return Math.max(0, SPLASH_TIMING.MIN_VISIBLE_MS - elapsed)
}

/**
 * Whether the opening may leave.
 *
 * With motion, it waits for both halves: the app being ready and the film
 * being over — played to the end, or given up on. An app that is ready early
 * does not cut the film short, and a film that ends early holds its last frame
 * until the app is ready. With reduced motion there is no film, so readiness
 * alone decides (the floor is `msUntilExitAllowed`'s job).
 */
export function canExit({
  ready,
  introDone,
  reduceMotion,
}: {
  ready: boolean
  introDone: boolean
  reduceMotion: boolean
}): boolean {
  if (!ready) return false
  return reduceMotion || introDone
}
