import { describe, expect, it } from 'vitest'
import { SPLASH_TIMING, haloDelayMs, msUntilExitAllowed } from './splashTiming'

const { MIN_VISIBLE_MS, HALO_COUNT, HALO_MS } = SPLASH_TIMING

describe('msUntilExitAllowed', () => {
  /** A warm start: the session came back from a cached cookie almost at once. */
  it('holds a fast boot open for the rest of the floor', () => {
    expect(msUntilExitAllowed(1000, 1080)).toBe(MIN_VISIBLE_MS - 80)
  })

  it('lets a boot that already took longer go immediately', () => {
    expect(msUntilExitAllowed(1000, 1000 + MIN_VISIBLE_MS)).toBe(0)
    expect(msUntilExitAllowed(1000, 9999)).toBe(0)
  })

  it('never asks for a negative wait', () => {
    expect(msUntilExitAllowed(0, Number.MAX_SAFE_INTEGER)).toBe(0)
  })

  /**
   * A device whose clock is corrected during launch. Treated as "no time has
   * passed" rather than as a wait of days.
   */
  it('treats a clock that went backwards as the start of the floor', () => {
    expect(msUntilExitAllowed(5000, 1000)).toBe(MIN_VISIBLE_MS)
  })
})

describe('the exit', () => {
  /**
   * The ground is the only opaque thing on the layer, so a fade that starts
   * before the badge has finished leaving shows the app through the logo. The
   * two numbers are one number for that reason; this is what notices if they
   * ever stop being.
   */
  it('does not lift the ground while the badge is still on screen', () => {
    expect(SPLASH_TIMING.EXIT_GROUND_DELAY_MS).toBeGreaterThanOrEqual(SPLASH_TIMING.EXIT_TILE_MS)
  })

  /** The halos are the first thing to go, and the badge is not waiting on them. */
  it('clears the halos before the badge has gone', () => {
    expect(SPLASH_TIMING.EXIT_HALO_MS).toBeLessThanOrEqual(SPLASH_TIMING.EXIT_TILE_MS)
  })
})

describe('haloDelayMs', () => {
  /** The first ring is what the badge hands over to, so it cannot wait. */
  it('sends the first one off immediately', () => {
    expect(haloDelayMs(0)).toBe(0)
  })

  /**
   * The failure this exists to catch: spacing the rings by a constant that
   * does not divide the cycle, which leaves a beat of empty screen once per
   * loop — a stall on the one screen where a stall means the app has hung.
   *
   * The last gap is measured against the end of the cycle, because that is
   * where the first ring starts again.
   */
  it('spreads them evenly over exactly one cycle', () => {
    const share = HALO_MS / HALO_COUNT
    for (let index = 0; index < HALO_COUNT; index += 1) {
      const next = index + 1 === HALO_COUNT ? HALO_MS : haloDelayMs(index + 1)
      // Within a millisecond: the delays are whole ms and a cycle does not
      // always divide by the count.
      expect(Math.abs(next - haloDelayMs(index) - share)).toBeLessThan(1)
    }
  })

  it('never delays one past the cycle it belongs to', () => {
    for (let index = 0; index < HALO_COUNT; index += 1) {
      expect(haloDelayMs(index)).toBeLessThan(HALO_MS)
    }
  })
})
