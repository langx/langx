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
   */
  MIN_VISIBLE_MS: 700,
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
  EXIT_SETTLE_MS: 180,
  EXIT_TILE_MS: 320,
  EXIT_TILE_SCALE: 1.1,
  EXIT_GROUND_MS: 320,
  EXIT_GROUND_DELAY_MS: 60,
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
