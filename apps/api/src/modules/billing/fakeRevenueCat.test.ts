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

  /**
   * The overlap `ENTITLEMENT_PRECEDENCE` exists for. A fake that granted only
   * `pro_plus` would resolve correctly by accident and never exercise it.
   */
  it('gives a Pro+ buyer both entitlement ids, and resolves them to pro_plus', async () => {
    const store = createFakeRevenueCat()
    const event = store.purchase(USER, 'pro_plus_monthly')

    expect(event?.entitlement_ids).toEqual(['pro_plus', 'pro'])
    expect(await store.getEntitlement(USER)).toMatchObject({ tier: 'pro_plus' })
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
      store.purchase(USER, 'pro_plus_yearly')

      expect(store.expire(USER)?.entitlement_ids).toEqual(['pro_plus', 'pro'])
    })
  })

  it('grants a promotional lifetime entitlement, as the v1 loyalty gift does', async () => {
    const store = createFakeRevenueCat()
    await store.grantLifetimeEntitlement(USER, 'pro_plus')

    expect(await store.getEntitlement(USER)).toMatchObject({
      tier: 'pro_plus',
      expiresAt: null,
      store: 'promotional',
      productId: 'rc_promo_pro_plus_lifetime',
      willRenew: false,
    })
  })

  /**
   * Fluent → Polyglot, the way a store does it: the running subscription is
   * replaced, and the event says so. The webhook treats `PRODUCT_CHANGE` as a
   * grant, and the harness is where that is seen to hold with the event type
   * a store would actually send rather than a second `INITIAL_PURCHASE`.
   */
  describe('upgrade', () => {
    it('replaces a running subscription and reports it as a product change', async () => {
      const store = createFakeRevenueCat()
      store.purchase(USER, '$rc_monthly')

      const event = store.purchase(USER, 'pro_plus_monthly')
      expect(event?.type).toBe('PRODUCT_CHANGE')
      expect(event?.entitlement_ids).toEqual(['pro_plus', 'pro'])
      expect(await store.getEntitlement(USER)).toMatchObject({ tier: 'pro_plus' })
    })

    it('starts fresh once the old subscription has ended', () => {
      const store = createFakeRevenueCat()
      store.purchase(USER, '$rc_monthly')
      store.expire(USER)

      expect(store.purchase(USER, 'pro_plus_monthly')?.type).toBe('INITIAL_PURCHASE')
    })
  })

  /**
   * The v1 loyalty gift under a purchase. Nothing sold the gift, so nothing
   * replaces it: a gifted Fluent who buys Polyglot holds both, resolves to
   * Polyglot while it runs, and is back on Fluent — not free — when it ends.
   */
  describe('a promotional grant beside a purchase', () => {
    it('is outranked by a higher purchase and found again when it expires', async () => {
      const store = createFakeRevenueCat()
      await store.grantLifetimeEntitlement(USER, 'pro')
      expect(store.purchase(USER, 'pro_plus_monthly')?.type).toBe('INITIAL_PURCHASE')
      expect(await store.getEntitlement(USER)).toMatchObject({
        tier: 'pro_plus',
        store: FAKE_STORE,
      })

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

      expect(await store.getEntitlement(USER)).toMatchObject({ tier: 'pro_plus' })
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
