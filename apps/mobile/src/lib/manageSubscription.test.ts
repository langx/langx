import { describe, expect, it } from 'vitest'
import { manageSubscriptionUrl } from './manageSubscription'

describe('manageSubscriptionUrl', () => {
  /** The only one that is right for a web checkout, where no store URL means anything. */
  it('prefers whatever RevenueCat reports', () => {
    const url = 'https://billing.example/portal/abc'
    expect(manageSubscriptionUrl({ managementURL: url }, 'ios')).toBe(url)
    expect(manageSubscriptionUrl({ managementURL: url }, 'web')).toBe(url)
  })

  it('falls back to the right store per platform', () => {
    expect(manageSubscriptionUrl(null, 'ios')).toContain('apps.apple.com')
    expect(manageSubscriptionUrl(null, 'android')).toContain('play.google.com')
  })

  /**
   * `null` means render no row at all, not a disabled one — Settings already
   * says a row that cannot work is worse than one that is not there.
   */
  /** The v1 loyalty gift: no store sold it, so no store can show it. */
  it('has nowhere to send a promotional lifetime holder', () => {
    expect(manageSubscriptionUrl({ store: 'promotional' }, 'ios')).toBeNull()
    expect(manageSubscriptionUrl({ store: 'promotional' }, 'android')).toBeNull()
    // Unless RevenueCat itself has a link — a Polyglot bought on the web on
    // top of the gift is a subscription with a portal.
    const url = 'https://billing.example/portal/abc'
    expect(manageSubscriptionUrl({ store: 'rc_billing', managementURL: url }, 'web')).toBe(url)
  })

  it('has nowhere to send a web user with no reported URL', () => {
    expect(manageSubscriptionUrl(null, 'web')).toBeNull()
    expect(manageSubscriptionUrl({ managementURL: null }, 'web')).toBeNull()
    expect(manageSubscriptionUrl(undefined, 'web')).toBeNull()
  })
})
