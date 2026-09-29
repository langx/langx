import { describe, expect, it } from 'vitest'
import { planChangeFor, platformOfStore } from './planChange'

const DAY = 24 * 60 * 60 * 1000

describe('planChangeFor', () => {
  it('is a plain purchase from the free tier', () => {
    expect(planChangeFor({ tier: 'free' })).toBe('buy')
  })

  it('covers a subscription, whichever store sold it', () => {
    for (const store of ['app_store', 'play_store', 'rc_billing', 'stripe', 'fake_store']) {
      expect(planChangeFor({ tier: 'pro', store })).toBe('covered')
    }
  })

  /** A Polyglot row the merge script has not reached yet is Pro all the same. */
  it('covers the retired pro_plus tier too', () => {
    expect(planChangeFor({ tier: 'pro_plus', store: 'app_store' })).toBe('covered')
  })

  it('covers a lifetime grant', () => {
    expect(planChangeFor({ tier: 'pro', store: 'promotional', expiresAt: null })).toBe('covered')
  })

  /**
   * The whole reason `expiresAt` and the `gift` store are read: somebody given
   * a month of Pro must be able to subscribe, so Pro carries on after it.
   */
  it('lets a timed gift be subscribed on top of', () => {
    const expiresAt = new Date(Date.now() + 20 * DAY).toISOString()
    expect(planChangeFor({ tier: 'pro', store: 'gift', expiresAt })).toBe('buy')
  })

  it('sells to somebody whose plan has lapsed without a webhook', () => {
    const expiresAt = new Date(Date.now() - DAY)
    expect(planChangeFor({ tier: 'pro', store: 'app_store', expiresAt })).toBe('buy')
  })
})

describe('platformOfStore', () => {
  it('names the platform behind each store RevenueCat reports', () => {
    expect(platformOfStore('app_store')).toBe('ios')
    expect(platformOfStore('mac_app_store')).toBe('ios')
    expect(platformOfStore('play_store')).toBe('android')
    expect(platformOfStore('rc_billing')).toBe('web')
    expect(platformOfStore('stripe')).toBe('web')
  })

  it('has no platform for a grant or nothing', () => {
    expect(platformOfStore('promotional')).toBeNull()
    expect(platformOfStore('gift')).toBeNull()
    expect(platformOfStore(undefined)).toBeNull()
    expect(platformOfStore('')).toBeNull()
  })
})
