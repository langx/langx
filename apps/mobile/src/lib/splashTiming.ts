/**
 * The numbers behind the opening animation, and the two pieces of arithmetic in
 * it that are easy to get wrong.
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
   * How long the logo stays up at minimum, measured from mount.
   *
   * A warm start resolves the session from a cached cookie almost immediately,
   * and without a floor the logo would appear and vanish inside about eighty
   * milliseconds — read as a flicker, not as an opening.
   *
   * Nothing above this is waiting to finish. The halo below is a loop with no
   * end state, so the exit can start at any point in it without showing the
   * reader an animation being interrupted — which is what the floor had to be
   * raised for when the opening was four springs that had to land first.
   */
  MIN_VISIBLE_MS: 800,
  /**
   * Nothing signalled. Not "the app is fine" — just "stop hiding it": whatever
   * is slow, the reader is better off seeing the screen behind this and its
   * own spinner than a logo breathing at them indefinitely.
   */
  TIMEOUT_MS: 5000,
  /** One halo's whole life: born at the badge's edge, gone before the corners. */
  HALO_MS: 2600,
  /** Three in the air at once, a third of a cycle apart. See `haloDelayMs`. */
  HALO_COUNT: 3,
  /**
   * Multiples of the badge's own width. It starts on the badge's edge, so the
   * ring reads as leaving the mark rather than arriving around it, and stops
   * at a little under a phone's width — a ring still at full radius when it
   * reaches the bezel is a stripe across the screen, which is what the four
   * rotating arcs this replaces looked like.
   */
  HALO_TO_SCALE: 2.2,
  /** Faint on purpose: three of these overlap, and they are behind the mark. */
  HALO_OPACITY: 0.45,
  /**
   * How far into its life a halo is at full strength. It fades *in* over the
   * first tenth so the ring does not appear as a hard edge sitting on the
   * badge, and fades out over the rest.
   */
  HALO_FADE_IN: 0.1,
  /** Slower than `Skeleton`'s 700/700, and about half a halo, so the two agree. */
  BREATH_HALF_MS: 1300,
  BREATH_SCALE: 1.03,
  /** The halos go first, and quickly: they are the part that says "still working". */
  EXIT_HALO_MS: 200,
  /**
   * The badge drifting towards the reader as it dissolves. Small — at more than
   * a few percent this stops being a hand-off and becomes a zoom.
   */
  EXIT_TILE_MS,
  EXIT_TILE_SCALE: 1.06,
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
 * When the halo at `index` first sets off.
 *
 * All three run the identical loop; the only thing that distinguishes them is
 * that each starts a fraction of a cycle after the last, once, before its loop
 * begins. That is what makes the ripple continuous: at any instant one ring is
 * leaving the badge, one is halfway out and one is fading at the edge.
 *
 * The failure it exists to prevent is spacing them by a constant. A gap that
 * does not divide `HALO_MS` leaves a beat with nothing on screen every cycle —
 * a pause in a loop that is supposed to have no seam, which reads as a stall
 * on the one screen where a stall means the app has hung.
 */
export function haloDelayMs(index: number): number {
  return Math.round((index * SPLASH_TIMING.HALO_MS) / SPLASH_TIMING.HALO_COUNT)
}
