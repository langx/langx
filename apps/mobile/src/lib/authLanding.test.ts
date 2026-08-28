import { describe, expect, it } from 'vitest'
import { authLandingHref } from './authLanding'

describe('authLandingHref', () => {
  it('sends someone who has not seen the intro to it', () => {
    expect(authLandingHref(false)).toBe('/(auth)/intro')
  })

  it('sends someone who has to sign-in', () => {
    expect(authLandingHref(true)).toBe('/(auth)/sign-in')
  })

  /**
   * The regression this exists for: "Show intro again" clears the flag, and
   * every route out of a session has to ask again rather than assume sign-in.
   */
  it('follows the flag rather than a fixed destination', () => {
    expect(authLandingHref(false)).not.toBe(authLandingHref(true))
  })
})
