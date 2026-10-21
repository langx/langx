import { describe, expect, it, vi } from 'vitest'
import {
  iosIneligibleForTrial,
  nativeFreeTrialDays,
  trialDays,
  type NativeTrialProduct,
} from './trialDays'

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

describe('iosIneligibleForTrial', () => {
  const ELIGIBLE = 'ELIGIBLE'
  const ids = ['pro_monthly', 'pro_yearly']

  it('keeps the trial only where StoreKit says eligible', async () => {
    const check = () =>
      Promise.resolve({ pro_monthly: { status: ELIGIBLE }, pro_yearly: { status: 'INELIGIBLE' } })
    expect([...(await iosIneligibleForTrial(ids, check, ELIGIBLE))]).toEqual(['pro_yearly'])
  })

  it('hides the trial on a product with no answer, or UNKNOWN', async () => {
    const check = () => Promise.resolve({ pro_monthly: { status: 'UNKNOWN' } })
    expect([...(await iosIneligibleForTrial(ids, check, ELIGIBLE))]).toEqual(ids)
  })

  // A promised trial that does not happen is a false price; an unannounced
  // one is a pleasant surprise. So a failed call promises nothing.
  it('hides every trial when the eligibility call throws', async () => {
    const check = () => Promise.reject(new Error('StoreKit unavailable'))
    expect([...(await iosIneligibleForTrial(ids, check, ELIGIBLE))]).toEqual(ids)
  })

  it('asks nothing for no products', async () => {
    const check = vi.fn(() => Promise.resolve({}))
    expect((await iosIneligibleForTrial([], check, ELIGIBLE)).size).toBe(0)
    expect(check).not.toHaveBeenCalled()
  })
})
