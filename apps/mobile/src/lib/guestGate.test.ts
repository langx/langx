import { describe, expect, it } from 'vitest'
import { shouldEndGuestSession, shouldGateGuest } from './guestGate'

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

describe('shouldEndGuestSession', () => {
  const guest = { isAnonymous: true }

  it('ends a guest session that was already there when the launch began', () => {
    expect(shouldEndGuestSession({ settled: true, seenBefore: false, user: guest })).toBe(true)
  })

  /**
   * The one case that must survive: "look around" signs in a moment *after*
   * the launch has already resolved a session, and deleting that one would
   * undo the tap that made it.
   */
  it('leaves a guest session this launch has just created', () => {
    expect(shouldEndGuestSession({ settled: true, seenBefore: true, user: guest })).toBe(false)
  })

  it('waits for the session to resolve before deciding', () => {
    expect(shouldEndGuestSession({ settled: false, seenBefore: false, user: guest })).toBe(false)
  })

  it('never touches a real account or a signed-out launch', () => {
    expect(
      shouldEndGuestSession({ settled: true, seenBefore: false, user: { isAnonymous: false } }),
    ).toBe(false)
    expect(shouldEndGuestSession({ settled: true, seenBefore: false, user: null })).toBe(false)
  })
})
