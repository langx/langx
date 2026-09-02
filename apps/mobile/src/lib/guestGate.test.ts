import { describe, expect, it } from 'vitest'
import { isRestoredGuestSession, shouldGateGuest } from './guestGate'

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

describe('isRestoredGuestSession', () => {
  const guest = { isAnonymous: true }

  it('finds a guest session that was already there when the launch began', () => {
    expect(isRestoredGuestSession({ settled: true, seenBefore: false, user: guest })).toBe(true)
  })

  /**
   * The one case that must never match: "look around" signs in a moment
   * *after* the launch has already resolved a session, and ending that one
   * would undo the tap that made it.
   */
  it('ignores a guest session this launch has just created', () => {
    expect(isRestoredGuestSession({ settled: true, seenBefore: true, user: guest })).toBe(false)
  })

  it('waits for the session to resolve before deciding', () => {
    expect(isRestoredGuestSession({ settled: false, seenBefore: false, user: guest })).toBe(false)
  })

  it('never touches a real account or a signed-out launch', () => {
    expect(
      isRestoredGuestSession({ settled: true, seenBefore: false, user: { isAnonymous: false } }),
    ).toBe(false)
    expect(isRestoredGuestSession({ settled: true, seenBefore: false, user: null })).toBe(false)
  })
})
