import { describe, expect, it } from 'vitest'
import { CHANGE_HAPTIC_WINDOW_MS, isPressedChange } from './changeHaptic'

describe('isPressedChange', () => {
  it('is a change nobody pressed for when there was no press', () => {
    expect(isPressedChange(null, 5_000)).toBe(false)
  })

  it('counts a change in the render right after the press', () => {
    expect(isPressedChange(5_000, 5_016)).toBe(true)
  })

  it('counts a change at the edge of the window, and not after it', () => {
    expect(isPressedChange(5_000, 5_000 + CHANGE_HAPTIC_WINDOW_MS)).toBe(true)
    expect(isPressedChange(5_000, 5_001 + CHANGE_HAPTIC_WINDOW_MS)).toBe(false)
  })

  it('does not let a refused press claim a later change', () => {
    // Pressed, refused (no change), then filters reset ten seconds later.
    expect(isPressedChange(5_000, 15_000)).toBe(false)
  })

  it('refuses a stamp from the future, as a clock that moved backwards would leave', () => {
    expect(isPressedChange(5_000, 4_000)).toBe(false)
  })
})
