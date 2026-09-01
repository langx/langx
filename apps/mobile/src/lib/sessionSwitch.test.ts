import { describe, expect, it } from 'vitest'
import { isAccountSwitch } from './sessionSwitch'

describe('isAccountSwitch', () => {
  it('is a switch whenever a known account is replaced', () => {
    // The reported case: an account signs out, a guest signs in, and the
    // conversation list cached under the first one is still in the client.
    expect(isAccountSwitch('user-a', null)).toBe(true)
    expect(isAccountSwitch('user-a', 'guest-1')).toBe(true)
    // Straight from one account to another, without a null in between: the
    // effect can miss the intermediate state, so this has to stand alone.
    expect(isAccountSwitch('user-a', 'user-b')).toBe(true)
  })

  it('is not a switch while the same account stays signed in', () => {
    expect(isAccountSwitch('user-a', 'user-a')).toBe(false)
  })

  /**
   * The launch sequence, which must not clear anything: `useSession` resolves
   * from "not observed yet" to whoever it finds, and a cache emptied at that
   * moment would throw away the prefetch the first screen just started.
   */
  it('is not a switch before anyone has been observed', () => {
    expect(isAccountSwitch(undefined, null)).toBe(false)
    expect(isAccountSwitch(undefined, 'user-a')).toBe(false)
  })

  /** Signing in from a signed-out app: the cache was already dropped. */
  it('is not a switch when nobody was signed in', () => {
    expect(isAccountSwitch(null, 'user-a')).toBe(false)
    expect(isAccountSwitch(null, null)).toBe(false)
  })
})
