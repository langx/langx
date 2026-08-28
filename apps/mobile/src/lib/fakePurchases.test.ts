import { PACKAGES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { fakeOffers } from './fakePurchases'

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

  /**
   * The paywall groups its columns by tier, so a harness that produced only
   * one tier's packages would leave half the screen untested.
   */
  it('covers both paid tiers', () => {
    expect(new Set(fakeOffers().map((offer) => offer.tier))).toEqual(new Set(['pro', 'pro_plus']))
  })

  /**
   * The one thing about these prices that is load-bearing. A paywall showing
   * plausible prices while no money moves is a screenshot that gets mistaken
   * for the real one; every price has to say what it is on its face.
   */
  it('labels every price as a test price', () => {
    for (const offer of fakeOffers()) {
      expect(offer.priceString).toMatch(/^TEST /)
    }
  })
})
