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
   * whole opening: with reduced motion on, where there is no film to wait for.
   *
   * A warm start resolves the session from a cached cookie almost immediately,
   * and without a floor the logo would appear and vanish inside about eighty
   * milliseconds — read as a flicker, not as an opening.
   */
  MIN_VISIBLE_MS: 800,
  /**
   * Nothing signalled. Not "the app is fine" — just "stop hiding it": whatever
   * is slow, the reader is better off seeing the screen behind this and its
   * own spinner than a logo held at them indefinitely.
   */
  TIMEOUT_MS: 5000,
  /**
   * How long the badge sits perfectly still before anything moves.
   *
   * The first frame of this layer is the frame the native splash hands over
   * on, and the two are meant to be the same picture. Motion starting on that
   * frame is motion starting on the one frame most likely to be dropped — a
   * pop with no cause. A beat of stillness puts the handover behind us first.
   */
  HOLD_MS: 150,
  /**
   * The yellow disc growing from the badge's centre until it covers the
   * screen. Short: it is a transition into the film, not part of it.
   */
  DISC_MS: 400,
  /**
   * The film's own length: `assets/splash/intro.mp4`, 162 frames at 60 fps.
   * A test reads the file and holds this to it, because the stall guard below
   * is measured from it.
   */
  INTRO_MS: 2700,
  /**
   * How long the yellow waits for the film to start playing before giving up
   * on it and leaving from the yellow instead. A slow disk or a decoder that
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
   * With reduced motion, the badge dissolving in place. Scale stays at 1:
   * drifting towards the reader is exactly the movement they turned off.
   */
  EXIT_TILE_MS,
  /**
   * The ground waits for the badge to be **gone**, not merely on its way out,
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
   * Both schemes paint this ground in `colors.bg`, which is what the screen
   * behind it starts with too, so once the badge is out of the way the fade
   * itself has almost nothing to show — that is the intent. The exit people
   * should notice is the badge, not the backdrop.
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
 * The diameter of a disc, centred on the window, that covers all of it.
 *
 * The disc is grown by a scale transform from the badge's centre, which is the
 * window's centre, so it has to reach the corners, not the edges: sized to the
 * longer side, a tall phone keeps four slivers of the old ground in its
 * corners for the whole film. Rounded up and given a point either side, so an
 * antialiased rim never lands on the last row of pixels.
 */
export function discDiameter(width: number, height: number): number {
  return Math.ceil(Math.hypot(width, height)) + 2
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
