/**
 * The numbers behind the opening animation, and the one piece of arithmetic in
 * it that is easy to get wrong.
 *
 * Split from the component for the reason `swipeAction` and `pinch` are: a
 * renderer cannot be loaded in this package's tests, and "did a fast boot flash
 * the logo for two frames" is a question about numbers.
 */
export const SPLASH_TIMING = {
  /**
   * How long the logo stays up at minimum, measured from mount.
   *
   * A warm start resolves the session from a cached cookie almost immediately,
   * and without a floor the logo would appear and vanish inside about eighty
   * milliseconds — read as a flicker, not as an opening.
   *
   * Raised from 700 when the arcs arrived: the last of the four is still
   * springing open at ~800ms, and a floor that lets the exit start before the
   * bloom has finished shows the reader an animation being interrupted rather
   * than one being played.
   */
  MIN_VISIBLE_MS: 900,
  /**
   * Nothing signalled. Not "the app is fine" — just "stop hiding it": whatever
   * is slow, the reader is better off seeing the screen behind this and its
   * own spinner than a logo breathing at them indefinitely.
   */
  TIMEOUT_MS: 5000,
  ENTRY_FROM_SCALE: 0.96,
  ENTRY_SPEED: 14,
  ENTRY_BOUNCINESS: 4,
  /** `Skeleton` breathes at 700/700. A logo the size of a thumbnail wants slower. */
  LOOP_HALF_MS: 900,
  LOOP_SCALE: 1.045,
  LOOP_OPACITY: 0.9,
  /**
   * The arcs open one after another rather than together, smallest first, so
   * the bloom reads as coming *out of* the badge instead of appearing around
   * it. Below about 60ms the four stop being distinguishable.
   */
  BLOOM_STAGGER_MS: 90,
  /**
   * Looser than the badge's own spring — these are meant to overshoot — but
   * not so loose that the outermost is still settling when `MIN_VISIBLE_MS`
   * is up and the exit wants to start.
   */
  BLOOM_SPEED: 9,
  BLOOM_BOUNCINESS: 6,
  BLOOM_FROM_SCALE: 0.22,
  EXIT_SETTLE_MS: 180,
  /** The yellow leaving the badge and taking the screen. The whole exit hangs off it. */
  EXIT_FLOOD_MS: 460,
  /**
   * The badge waits a beat before dissolving, so there is a moment of it
   * sitting *on* the flood rather than being overtaken by it.
   */
  EXIT_TILE_DELAY_MS: 160,
  EXIT_TILE_MS: 320,
  EXIT_TILE_SCALE: 1.1,
  /** Only once the flood has actually covered the screen — see `EXIT_FLOOD_MS`. */
  EXIT_GROUND_MS: 360,
  EXIT_GROUND_DELAY_MS: 380,
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
 * The width of the disc that has to cover the screen on the way out.
 *
 * It grows from the centre, so what it must clear is the distance to a
 * *corner*, not to an edge — a disc as wide as the screen leaves four wedges
 * of the app showing through before the ground has faded. The corner is half
 * a diagonal away, so the diagonal is the diameter, plus a few percent for the
 * rounding at the very last frame.
 *
 * Guards a zero: `useWindowDimensions` can report 0×0 for a frame on the web
 * during the static export's prerender, and a diameter of zero would make the
 * exit a hard cut.
 */
export function floodDiameter(width: number, height: number): number {
  const diagonal = Math.hypot(width, height)
  if (!Number.isFinite(diagonal) || diagonal <= 0) return 0
  return diagonal * 1.06
}
