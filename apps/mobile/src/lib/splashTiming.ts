/**
 * The numbers behind the opening, and the pieces of arithmetic in it that are
 * easy to get wrong.
 *
 * Split from the component for the reason `swipeAction` and `pinch` are: a
 * renderer cannot be loaded in this package's tests, and "does a later launch
 * still clear the screen inside 600 ms" is a question about numbers.
 *
 * The opening is the ink stamp (`AppSplash`): the badge the OS drew holds,
 * an ink ring draws once around it, it presses down and lifts, and then the
 * whole ground lifts off the app as one sheet. All times are milliseconds from
 * the moment the native splash has gone.
 */

/**
 * The badge's width on screen, in dp/pt, on both platforms. It is also the
 * `imageWidth` of the `expo-splash-screen` block in `app.config.ts` (which
 * may not import this file; a test holds the two together), so the JS layer's
 * first frame is the native splash, pixel for pixel.
 *
 * 184, not more: Android 12+ composites the image into a 288 dp canvas and
 * masks it to a 192 dp circle. A disc as wide as the mask has its edge shaved
 * by the mask's anti-aliasing; 4 dp of air inside it does not. `stamp.png` is
 * the disc and nothing else, so iOS draws the same 184 pt.
 */
export const DISC_SIZE = 184

/**
 * The ink ring around the disc, centred on the disc's edge. Even, so the
 * ring's box (`DISC_SIZE + RING_WIDTH`) halves into whole pixels: the ring is
 * drawn as two clipped halves, and a half-pixel seam between them shows.
 */
export const RING_WIDTH = 6

/** The two partner discs that pop out from behind the badge on the first launch. */
export const PARTNER_SIZE = 56
/**
 * How far each partner travels along its diagonal, per axis: far enough that
 * its centre is past the disc's edge, so most of it shows while it still
 * tucks under the badge rather than floating free.
 */
export const PARTNER_OFFSET = 76

export const SPLASH_TIMING = {
  /**
   * How long the still badge stays up at minimum, measured from mount, with
   * reduced motion on — the one case where nothing else times the opening.
   * A warm start resolves the session from a cached cookie almost at once,
   * and without a floor the layer would appear and vanish inside about eighty
   * milliseconds: read as a flicker, not as an opening.
   */
  MIN_VISIBLE_MS: 800,
  /**
   * Nothing signalled. Not "the app is fine" — just "stop hiding it": whatever
   * is slow, the reader is better off seeing the screen behind this and its
   * own spinner than a logo held at them indefinitely.
   */
  TIMEOUT_MS: 5000,

  // The first launch: the stamp plays in full once.
  /** The badge holds exactly as the OS drew it, so the handover frame never moves. */
  STAMP_HOLD_MS: 160,
  /** The ink ring drawing clockwise from twelve o'clock (`out`). */
  STAMP_RING_MS: 360,
  /** The press: down to `STAMP_PRESS_SCALE` (`out`). */
  STAMP_PRESS_MS: 110,
  /** And back up to 1 on `pop`, whose overshoot is the stamp lifting off. */
  STAMP_RELEASE_MS: 300,
  /** The partner discs leaving from behind the badge as it presses (`pop`). */
  PARTNER_OUT_MS: 300,
  /** Their pause before tucking back in. */
  PARTNER_HOLD_MS: 20,
  /** Tucking back in (`out`), finished before the sheet can lift. */
  PARTNER_IN_MS: 160,
  /** A beat after the release before the sheet may lift. */
  STAMP_SETTLE_MS: 80,
  /** The whole ground lifting off the app (`rise`). */
  LIFT_MS: 460,

  // Every later launch, and a tap on any launch: from the moment the app is ready.
  /** The ring drawing, or finishing what is left of it. */
  QUICK_RING_MS: 200,
  /** The lift starts while the ring is still closing; the two read as one move. */
  QUICK_LIFT_DELAY_MS: 120,
  QUICK_LIFT_MS: 380,

  /** Reduced motion: the still badge and its ground dissolving together (`crossfade`, `out`). */
  FADE_MS: 240,
} as const

/** How far the press pushes the badge in. */
export const STAMP_PRESS_SCALE = 0.92

/** When the press starts: the moment the ring has closed. */
export const STAMP_PRESS_AT = SPLASH_TIMING.STAMP_HOLD_MS + SPLASH_TIMING.STAMP_RING_MS

/**
 * When the first-launch stamp is over and the sheet may lift, if the app is
 * ready by then. A later-ready app holds this last frame until it is.
 */
export const STAMP_DONE_AT =
  STAMP_PRESS_AT +
  SPLASH_TIMING.STAMP_PRESS_MS +
  SPLASH_TIMING.STAMP_RELEASE_MS +
  SPLASH_TIMING.STAMP_SETTLE_MS

/**
 * The motion a later launch adds on top of the app's own boot: from ready to
 * the screen clear. The film this replaced held every launch for 2.7 s.
 */
export const QUICK_EXIT_MS = SPLASH_TIMING.QUICK_LIFT_DELAY_MS + SPLASH_TIMING.QUICK_LIFT_MS

/**
 * How long the ring has left to draw on a quick exit, given how much of it is
 * drawn: all of `QUICK_RING_MS` if it has not started, what is left of it if
 * a tap caught it halfway, nothing if it has closed.
 */
export function quickRingMs(drawn: number): number {
  const done = Number.isFinite(drawn) ? Math.min(1, Math.max(0, drawn)) : 0
  return Math.round(SPLASH_TIMING.QUICK_RING_MS * (1 - done))
}

/**
 * How much longer the reduced-motion exit has to wait so a fast boot does not
 * flash.
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
