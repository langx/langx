import { PACKAGES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { fakeOffers } from './fakePurchases'
import { yearlyFreeMonths } from './planSaving'

describe('fakeOffers', () => {
  it('offers every package the app sells', () => {
    expect(
      fakeOffers()
        .map((offer) => offer.id)
        .sort(),
    ).toEqual(Object.keys(PACKAGES).sort())
  })

  it('sells each package as the tier and period the shared table says', () => {
    for (const offer of fakeOffers()) {
      expect(offer).toMatchObject(PACKAGES[offer.id as keyof typeof PACKAGES])
    }
  })

  it('sells the one paid tier', () => {
    expect(new Set(fakeOffers().map((offer) => offer.tier))).toEqual(new Set(['pro']))
  })

  /** Monthly and yearly both start with a free week in the stores. */
  it('gives both subscriptions a one-week trial, and the lifetime none', () => {
    for (const offer of fakeOffers()) {
      expect(offer.freeTrialDays).toBe(offer.period === 'lifetime' ? null : 7)
    }
  })

  /**
   * The one thing about these prices that is load-bearing. A paywall showing
   * plausible prices while no money moves is a screenshot that gets mistaken
   * for the real one; every price has to say what it is on its face.
   */
  it('labels every price as a test price', () => {
    for (const offer of fakeOffers()) {
      expect(offer.priceString).toMatch(/^TEST /)
      if (offer.perMonthPriceString !== undefined) {
        expect(offer.perMonthPriceString).toMatch(/^TEST /)
      }
    }
  })

  /** The yearly row leads with the store's monthly figure, so the harness has to supply one. */
  it('gives every yearly offer a per-month price, and no other', () => {
    for (const offer of fakeOffers()) {
      expect(offer.perMonthPriceString !== undefined).toBe(offer.period === 'yearly')
    }
  })

  /**
   * Real yearly prices end in `9.99` (since 21 October 2026; `planSaving.test.ts`
   * says why), and the paywall reads "3 months free" off them against the
   * monthly. The harness has to render the same shape or it is exercising a
   * screen that no longer exists.
   */
  it('prices every yearly offer like the stores do', () => {
    const offers = fakeOffers()
    const monthly = offers.find((offer) => offer.period === 'monthly')
    for (const offer of offers) {
      if (offer.period !== 'yearly') continue
      expect(offer.price.toFixed(2).endsWith('9.99')).toBe(true)
      expect(yearlyFreeMonths(offer, monthly)).toBe(3)
    }
  })
})
