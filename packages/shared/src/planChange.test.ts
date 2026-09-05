import { describe, expect, it } from 'vitest'
import { planChangeFor, platformOfStore, replaceableProductId } from './planChange'

describe('planChangeFor', () => {
  it('is a plain purchase from the free tier, whatever the platform', () => {
    for (const platform of ['ios', 'android', 'web'] as const) {
      expect(planChangeFor({ tier: 'free' }, 'pro', platform)).toBe('buy')
      expect(planChangeFor({ tier: 'free' }, 'pro_plus', platform)).toBe('buy')
    }
  })

  it('covers the tier held and everything below it', () => {
    expect(planChangeFor({ tier: 'pro', store: 'app_store' }, 'pro', 'ios')).toBe('covered')
    expect(planChangeFor({ tier: 'pro_plus', store: 'app_store' }, 'pro', 'ios')).toBe('covered')
    expect(planChangeFor({ tier: 'pro_plus', store: 'play_store' }, 'pro_plus', 'android')).toBe(
      'covered',
    )
  })

  it('upgrades through the store that sold the plan', () => {
    expect(planChangeFor({ tier: 'pro', store: 'app_store' }, 'pro_plus', 'ios')).toBe('upgrade')
    expect(planChangeFor({ tier: 'pro', store: 'play_store' }, 'pro_plus', 'android')).toBe(
      'upgrade',
    )
    expect(planChangeFor({ tier: 'pro', store: 'rc_billing' }, 'pro_plus', 'web')).toBe('upgrade')
    expect(planChangeFor({ tier: 'pro', store: 'stripe' }, 'pro_plus', 'web')).toBe('upgrade')
  })

  it('sends a plan bought on another platform back there', () => {
    expect(planChangeFor({ tier: 'pro', store: 'app_store' }, 'pro_plus', 'android')).toBe(
      'elsewhere',
    )
    expect(planChangeFor({ tier: 'pro', store: 'play_store' }, 'pro_plus', 'web')).toBe('elsewhere')
    expect(planChangeFor({ tier: 'pro', store: 'rc_billing' }, 'pro_plus', 'ios')).toBe('elsewhere')
  })

  /**
   * The v1 loyalty gift. Nothing sold it, so nothing can prorate it: Polyglot
   * is bought on top, and the gifted Fluent survives underneath — which is
   * what `ENTITLEMENT_PRECEDENCE` is for.
   */
  it('treats a promotional grant as something to buy on top of, not to swap', () => {
    for (const platform of ['ios', 'android', 'web'] as const) {
      expect(planChangeFor({ tier: 'pro', store: 'promotional' }, 'pro_plus', platform)).toBe('buy')
    }
  })

  it('treats an unrecorded or unknown store the same way', () => {
    expect(planChangeFor({ tier: 'pro' }, 'pro_plus', 'ios')).toBe('buy')
    expect(planChangeFor({ tier: 'pro', store: null }, 'pro_plus', 'ios')).toBe('buy')
    expect(planChangeFor({ tier: 'pro', store: 'unknown' }, 'pro_plus', 'ios')).toBe('buy')
  })

  it('lets the harness upgrade from anywhere', () => {
    for (const platform of ['ios', 'android', 'web'] as const) {
      expect(planChangeFor({ tier: 'pro', store: 'fake_store' }, 'pro_plus', platform)).toBe(
        'upgrade',
      )
    }
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
    expect(platformOfStore(undefined)).toBeNull()
    expect(platformOfStore('')).toBeNull()
  })
})

describe('replaceableProductId', () => {
  it('skips promotional grants and strips a Play base plan', () => {
    expect(replaceableProductId(['rc_promo_pro_lifetime', 'fluent_monthly:monthly'])).toBe(
      'fluent_monthly',
    )
    expect(replaceableProductId(['fluent_yearly'])).toBe('fluent_yearly')
  })

  it('has nothing to replace for a grant alone or an empty list', () => {
    expect(replaceableProductId(['rc_promo_pro_lifetime'])).toBeNull()
    expect(replaceableProductId([])).toBeNull()
  })
})
