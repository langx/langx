import { describe, expect, it } from 'vitest'
import { nativeFreeTrialDays, trialDays, type NativeTrialProduct } from './trialDays'

describe('trialDays', () => {
  it('counts a month as 30 days and a year as 365', () => {
    expect(trialDays('MONTH', 1)).toBe(30)
    expect(trialDays('YEAR', 1)).toBe(365)
  })

  it('reads either SDK spelling of the same unit', () => {
    // `react-native-purchases` says WEEK, `@revenuecat/purchases-js` says week.
    expect(trialDays('WEEK', 1)).toBe(trialDays('week', 1))
    expect(trialDays('day', 7)).toBe(7)
  })

  it('multiplies by the count', () => {
    expect(trialDays('DAY', 7)).toBe(7)
    expect(trialDays('month', 3)).toBe(90)
  })

  it('refuses a unit it does not know', () => {
    expect(trialDays('FORTNIGHT', 1)).toBeNull()
  })

  it('refuses a count that is not a real one', () => {
    expect(trialDays('MONTH', 0)).toBeNull()
    expect(trialDays('MONTH', -1)).toBeNull()
  })
})

describe('nativeFreeTrialDays', () => {
  const week = { billingPeriod: { unit: 'WEEK', value: 1 }, billingCycleCount: 1 }
  const freeIntro = { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1 }

  it('reads an App Store free introductory offer, on any plan', () => {
    // Monthly and yearly alike since 3.0: nothing here knows the period.
    expect(nativeFreeTrialDays({ introPrice: freeIntro, defaultOption: null })).toBe(7)
  })

  it('never calls a paid introductory offer a free trial', () => {
    const product = { introPrice: { ...freeIntro, price: 0.99 }, defaultOption: null }
    expect(nativeFreeTrialDays(product)).toBeNull()
  })

  it('reads Play from the option the purchase will buy', () => {
    expect(nativeFreeTrialDays({ introPrice: null, defaultOption: { freePhase: week } })).toBe(7)
  })

  it('says nothing on Play when the bought option has no free phase', () => {
    // An offer somebody is no longer eligible for is not returned by Play, so
    // the default falls back to the base plan — even if `introPrice` still
    // describes a free week somewhere on the product.
    const product: NativeTrialProduct = {
      introPrice: freeIntro,
      defaultOption: { freePhase: null },
    }
    expect(nativeFreeTrialDays(product)).toBeNull()
  })

  it('counts every cycle of a Play free phase', () => {
    const phase = { billingPeriod: { unit: 'DAY', value: 1 }, billingCycleCount: 3 }
    expect(nativeFreeTrialDays({ introPrice: null, defaultOption: { freePhase: phase } })).toBe(3)
    const once = { ...week, billingCycleCount: null }
    expect(nativeFreeTrialDays({ introPrice: null, defaultOption: { freePhase: once } })).toBe(7)
  })

  it('has no trial without an offer', () => {
    expect(nativeFreeTrialDays({ introPrice: null })).toBeNull()
  })
})
