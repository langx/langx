import { describe, expect, it } from 'vitest'
import { SPLASH_TIMING, floodDiameter, msUntilExitAllowed } from './splashTiming'

const { MIN_VISIBLE_MS } = SPLASH_TIMING

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

describe('floodDiameter', () => {
  /**
   * The failure this exists to catch: sizing the disc by the *width* leaves
   * the four corners of a tall screen uncovered for the whole exit.
   */
  it('reaches past the corners of a phone', () => {
    const [width, height] = [390, 844]
    expect(floodDiameter(width, height) / 2).toBeGreaterThan(Math.hypot(width, height) / 2)
    expect(floodDiameter(width, height)).toBeGreaterThan(height)
  })

  it('covers a landscape tablet the same way round', () => {
    expect(floodDiameter(1366, 1024)).toBeGreaterThan(1366)
  })

  /** A frame of 0x0, which the web reports during the static export's prerender. */
  it('asks for nothing when there is no window yet', () => {
    expect(floodDiameter(0, 0)).toBe(0)
    expect(floodDiameter(Number.NaN, 100)).toBe(0)
  })
})
