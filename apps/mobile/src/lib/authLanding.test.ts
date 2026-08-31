import { describe, expect, it } from 'vitest'
import { authLandingHref } from './authLanding'

describe('authLandingHref', () => {
  it('sends someone who has not seen the intro to it', () => {
    expect(authLandingHref(false)).toBe('/(auth)/intro')
  })

  /**
   * The welcome screen, not the sign-in form. "Give us your email" is the wrong
   * first question for somebody who has not yet seen whether anyone here speaks
   * their language — signing in is still one tap from there.
   */
  it('sends someone who has seen it to the welcome screen', () => {
    expect(authLandingHref(true)).toBe('/(auth)/welcome')
  })

  /**
   * The regression this exists for: "Show intro again" clears the flag, and
   * every route out of a session has to ask again rather than assume sign-in.
   */
  it('follows the flag rather than a fixed destination', () => {
    expect(authLandingHref(false)).not.toBe(authLandingHref(true))
  })
})
