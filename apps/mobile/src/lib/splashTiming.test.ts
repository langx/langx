import { describe, expect, it } from 'vitest'
import { SPLASH_TIMING, msUntilExitAllowed } from './splashTiming'

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
