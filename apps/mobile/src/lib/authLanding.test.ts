import { describe, expect, it } from 'vitest'
import { authLandingHref } from './authLanding'

describe('authLandingHref', () => {
  /**
   * The welcome screen, not the sign-in form and no longer the intro. "Give us
   * your email" is the wrong first question for somebody who has not yet seen
   * whether anyone here speaks their language — signing in is still one tap
   * from there.
   */
  it('sends a signed-out user to the welcome screen', () => {
    expect(authLandingHref()).toBe('/(auth)/welcome')
  })

  /**
   * The intro is Settings-only now, so nothing signed out may route into
   * `(auth)/intro` — a route that no longer exists.
   */
  it('never routes to the intro', () => {
    expect(authLandingHref()).not.toContain('intro')
  })
})
