import { describe, expect, it } from 'vitest'
import { FAKE_STORE, asFakeRevenueCat, createFakeRevenueCat } from './fakeRevenueCat'
import { createNotConfiguredRevenueCatClient } from './revenueCatClient'

const USER = 'user-1'

describe('createFakeRevenueCat', () => {
  it('grants nothing until something is bought', async () => {
    const store = createFakeRevenueCat()
    expect(await store.getEntitlement(USER)).toBeNull()
  })

  it('grants the tier the package sells', async () => {
    const store = createFakeRevenueCat()
    store.purchase(USER, '$rc_monthly')

    expect(await store.getEntitlement(USER)).toMatchObject({ tier: 'pro', store: FAKE_STORE })
  })

  /** The offering still holds Polyglot's packages for old apps; this code sells neither. */
  it('refuses the retired Polyglot packages', () => {
    const store = createFakeRevenueCat()
    expect(store.purchase(USER, 'pro_plus_monthly')).toBeNull()
  })

  it('refuses a package identifier nothing sells', async () => {
    const store = createFakeRevenueCat()
    expect(store.purchase(USER, 'not_a_package')).toBeNull()
    expect(await store.getEntitlement(USER)).toBeNull()
  })

  it('gives a lifetime purchase no expiry and nothing to renew', async () => {
    const store = createFakeRevenueCat()
    const event = store.purchase(USER, '$rc_lifetime')

    expect(event?.expiration_at_ms).toBeNull()
    expect(await store.getEntitlement(USER)).toMatchObject({ tier: 'pro', expiresAt: null })
  })

  it('dates a subscription in the future, and a yearly one further out', () => {
    const store = createFakeRevenueCat()
    const monthly = store.purchase('monthly-user', '$rc_monthly')
    const yearly = store.purchase('yearly-user', '$rc_annual')

    expect(monthly?.expiration_at_ms).toBeGreaterThan(Date.now())
    expect(yearly?.expiration_at_ms).toBeGreaterThan(monthly?.expiration_at_ms ?? 0)
  })

  it('emits ids no two events share, because the webhook dedupes on them', () => {
    const store = createFakeRevenueCat()
    const first = store.purchase(USER, '$rc_monthly')
    const second = store.purchase(USER, '$rc_monthly')

    expect(first?.id).not.toEqual(second?.id)
  })

  describe('cancel', () => {
    it('keeps access — a cancellation stops the next charge, not this period', async () => {
      const store = createFakeRevenueCat()
      store.purchase(USER, '$rc_monthly')

      expect(store.cancel(USER)?.type).toBe('CANCELLATION')
      expect(await store.getEntitlement(USER)).toMatchObject({ tier: 'pro' })
    })

    it('has nothing to cancel for an account that never bought', () => {
      expect(createFakeRevenueCat().cancel(USER)).toBeNull()
    })
  })

  describe('expire', () => {
    it('ends access', async () => {
      const store = createFakeRevenueCat()
      store.purchase(USER, '$rc_monthly')

      expect(store.expire(USER)?.type).toBe('EXPIRATION')
      expect(await store.getEntitlement(USER)).toBeNull()
    })

    /**
     * The EXPIRATION event has to describe what ended, so the webhook can
     * record which product it was — asking the store afterwards only reports
     * what is left.
     */
    it('names the subscription that just ended', () => {
      const store = createFakeRevenueCat()
      store.purchase(USER, '$rc_annual')

      expect(store.expire(USER)?.entitlement_ids).toEqual(['pro'])
    })
  })

  it('grants a promotional lifetime entitlement, as the v1 loyalty gift does', async () => {
    const store = createFakeRevenueCat()
    await store.grantLifetimeEntitlement(USER, 'pro_plus')

    // A v1 gift granted as Polyglot reads as Pro.
    expect(await store.getEntitlement(USER)).toMatchObject({
      tier: 'pro',
      expiresAt: null,
      store: 'promotional',
      productId: 'rc_promo_pro_plus_lifetime',
      willRenew: false,
    })
  })

  /**
   * A gift of months: dated, reported as `gift` rather than `promotional`
   * (every released paywall reads `promotional` as "for life"), and ended by
   * its own date or by the EXPIRATION RevenueCat sends for it.
   */
  describe('a dated promotional grant', () => {
    const inAMonth = () => new Date(Date.now() + 30 * 86_400_000)

    it('is a gift that ends on its date and does not renew', async () => {
      const store = createFakeRevenueCat()
      const endsAt = inAMonth()
      await store.grantPromotionalEntitlement(USER, 'pro', endsAt)

      expect(await store.getEntitlement(USER)).toMatchObject({
        tier: 'pro',
        store: 'gift',
        expiresAt: endsAt,
        willRenew: false,
      })
    })

    it('keeps one grant when the same end is asked for twice', async () => {
      const store = createFakeRevenueCat()
      const endsAt = inAMonth()
      await store.grantPromotionalEntitlement(USER, 'pro', endsAt)
      await store.grantPromotionalEntitlement(USER, 'pro', endsAt)

      const event = store.expireGift(USER)
      expect(event).toMatchObject({ type: 'EXPIRATION', store: 'PROMOTIONAL' })
      expect(await store.getEntitlement(USER)).toBeNull()
    })

    it('grants nothing once its date has passed', async () => {
      const store = createFakeRevenueCat()
      await store.grantPromotionalEntitlement(USER, 'pro', new Date(Date.now() - 1000))
      expect(await store.getEntitlement(USER)).toBeNull()
    })

    it('leaves a lifetime grant alone when it expires', async () => {
      const store = createFakeRevenueCat()
      await store.grantLifetimeEntitlement(USER, 'pro')
      await store.grantPromotionalEntitlement(USER, 'pro', inAMonth())
      store.expireGift(USER)

      expect(await store.getEntitlement(USER)).toMatchObject({ store: 'promotional' })
    })

    it('has no EXPIRATION to send when nothing was given', () => {
      expect(createFakeRevenueCat().expireGift(USER)).toBeNull()
    })
  })

  /**
   * Buying again while a subscription runs, the way a store swaps one product
   * for another (monthly to yearly): the running subscription is replaced and
   * the event says so.
   */
  describe('product change', () => {
    it('replaces a running subscription and reports it as a product change', async () => {
      const store = createFakeRevenueCat()
      store.purchase(USER, '$rc_monthly')

      const event = store.purchase(USER, '$rc_annual')
      expect(event?.type).toBe('PRODUCT_CHANGE')
      expect(event?.entitlement_ids).toEqual(['pro'])
      expect(await store.getEntitlement(USER)).toMatchObject({
        tier: 'pro',
        productId: 'fake.pro.yearly',
      })
    })

    it('starts fresh once the old subscription has ended', () => {
      const store = createFakeRevenueCat()
      store.purchase(USER, '$rc_monthly')
      store.expire(USER)

      expect(store.purchase(USER, '$rc_annual')?.type).toBe('INITIAL_PURCHASE')
    })
  })

  /**
   * The v1 loyalty gift under a purchase. Nothing sold the gift, so nothing
   * replaces it: the lifetime outlasts any subscription, is what is stored,
   * and is still there when the purchase ends.
   */
  describe('a promotional grant beside a purchase', () => {
    it('outlasts a purchase and is still there when it expires', async () => {
      const store = createFakeRevenueCat()
      await store.grantLifetimeEntitlement(USER, 'pro')
      expect(store.purchase(USER, '$rc_monthly')?.type).toBe('INITIAL_PURCHASE')
      expect(await store.getEntitlement(USER)).toMatchObject({ store: 'promotional' })

      store.expire(USER)
      expect(await store.getEntitlement(USER)).toMatchObject({
        tier: 'pro',
        store: 'promotional',
        expiresAt: null,
      })
    })

    it('is not touched by cancelling or expiring the purchase', async () => {
      const store = createFakeRevenueCat()
      await store.grantLifetimeEntitlement(USER, 'pro_plus')
      store.purchase(USER, '$rc_monthly')
      store.cancel(USER)
      store.expire(USER)

      expect(await store.getEntitlement(USER)).toMatchObject({ tier: 'pro', store: 'promotional' })
    })
  })
})

describe('asFakeRevenueCat', () => {
  it('recognises the fake', () => {
    expect(asFakeRevenueCat(createFakeRevenueCat())).not.toBeNull()
  })

  // The guard the route's boot-time check depends on: anything that is not
  // this fake must come back null rather than be widened into one.
  it('does not recognise a real client', () => {
    expect(asFakeRevenueCat(createNotConfiguredRevenueCatClient())).toBeNull()
  })
})
