import { describe, expect, it } from 'vitest'
import { shouldGateGuest } from './guestGate'

describe('shouldGateGuest', () => {
  it('gates only a session the server marked anonymous', () => {
    expect(shouldGateGuest({ isAnonymous: true })).toBe(true)
    expect(shouldGateGuest({ isAnonymous: false })).toBe(false)
  })

  /**
   * Absent on every ordinary session, and `input: false` on the server means a
   * client cannot assert it either way — so the check is `=== true` rather than
   * truthiness, and an unknown shape is treated as a real account rather than
   * locking somebody out of their own app.
   */
  it('treats an absent or unknown flag as a real account', () => {
    expect(shouldGateGuest({})).toBe(false)
    expect(shouldGateGuest({ isAnonymous: null })).toBe(false)
    expect(shouldGateGuest(null)).toBe(false)
    expect(shouldGateGuest(undefined)).toBe(false)
  })
})
