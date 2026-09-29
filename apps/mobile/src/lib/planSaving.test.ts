import { describe, expect, it } from 'vitest'
import { perMonthPriceString } from './perMonthPrice'
import { yearlyFreeMonths, yearlySavingPercent } from './planSaving'

const monthly = (price: number) => ({ period: 'monthly' as const, price })
const yearly = (price: number) => ({ period: 'yearly' as const, price })

/** The price on sale in the storefront the others are converted from. */
const US_PRICES = [
  { name: 'Pro', yearly: 83.99, monthly: 9.99, perMonth: '6.99', saving: 30 },
] as const

/**
 * Pro in each storefront the plan names (`docs/decisions.md` → "One plan:
 * Pro"). Every one of them is 3.3–3.6 months short of twelve, so every one
 * reads "3 months free" — computed, never typed on the paywall.
 */
const STOREFRONTS = [
  { name: 'US', yearly: 83.99, monthly: 9.99 },
  { name: 'Euro', yearly: 95.99, monthly: 10.99 },
  { name: 'UK', yearly: 83.99, monthly: 9.99 },
  { name: 'Canada / Australia', yearly: 119.99, monthly: 13.99 },
  { name: 'Turkey', yearly: 1799.99, monthly: 214.99 },
] as const

describe('yearlyFreeMonths', () => {
  it.each(STOREFRONTS.map((p) => [p.name, yearly(p.yearly), monthly(p.monthly)] as const))(
    'reads 3 months free off the %s prices',
    (_name, year, month) => {
      expect(yearlyFreeMonths(year, month)).toBe(3)
    },
  )

  /** Floored, never rounded: 3.6 is three months, not four. */
  it('never rounds up', () => {
    expect(yearlyFreeMonths(yearly(84), monthly(10))).toBe(3)
    expect(yearlyFreeMonths(yearly(80), monthly(10))).toBe(4)
  })

  /** Below a whole month there is nothing to say in months; the percentage takes over. */
  it('says nothing under one month, so the paywall falls back to the percentage', () => {
    expect(yearlyFreeMonths(yearly(115), monthly(10))).toBeNull()
    expect(yearlySavingPercent(yearly(110), monthly(10))).toBe(8)
    expect(yearlyFreeMonths(yearly(110), monthly(10))).toBe(1)
  })

  it('says nothing without a monthly price, or for a free year', () => {
    expect(yearlyFreeMonths(yearly(83.99), undefined)).toBeNull()
    expect(yearlyFreeMonths(yearly(83.99), monthly(0))).toBeNull()
    expect(yearlyFreeMonths(yearly(0), monthly(9.99))).toBeNull()
    expect(yearlyFreeMonths(monthly(9.99), monthly(9.99))).toBeNull()
  })

  it('says nothing when the year costs more than twelve months', () => {
    expect(yearlyFreeMonths(yearly(130), monthly(10))).toBeNull()
  })
})

describe('yearlySavingPercent', () => {
  /**
   * The prices actually on sale. Per-country prices are set one storefront at a
   * time, so these are the US numbers the rest are converted from rather than a
   * complete list; the point of the assertion is that the arithmetic reads the
   * right percentage off a real pair, not that these are the only pair.
   */
  it.each(US_PRICES.map((p) => [p.name, yearly(p.yearly), monthly(p.monthly), p.saving] as const))(
    'reads %s off the store prices',
    (_name, year, month, expected) => {
      expect(yearlySavingPercent(year, month)).toBe(expected)
    },
  )

  it('says nothing when there is no monthly price to compare against', () => {
    expect(yearlySavingPercent(yearly(59.9), undefined)).toBeNull()
  })

  it('says nothing when the monthly price is zero', () => {
    expect(yearlySavingPercent(yearly(59.9), monthly(0))).toBeNull()
  })

  it('only speaks for a yearly offer', () => {
    expect(yearlySavingPercent(monthly(6.99), monthly(6.99))).toBeNull()
    expect(yearlySavingPercent({ period: 'lifetime', price: 99 }, monthly(6.99))).toBeNull()
  })

  it('will not dress a rounding artefact as a discount', () => {
    // 82 against 84 is 2%, which no one chose and no one should be told.
    expect(yearlySavingPercent(yearly(82), monthly(7))).toBeNull()
  })

  it('says nothing when the year costs more', () => {
    expect(yearlySavingPercent(yearly(90), monthly(7))).toBeNull()
  })

  /**
   * A free or negative yearly price is a misconfigured storefront, not a 100%
   * discount, and the paywall must not advertise it as one.
   */
  it('refuses a saving of everything', () => {
    expect(yearlySavingPercent(yearly(0), monthly(7))).toBeNull()
  })
})

/**
 * The paywall leads a yearly plan with what it costs a month, so the yearly
 * price is chosen backwards from what that figure should read: a `.99` month
 * times twelve, plus 0.11 — `$6.99` wants `$83.88`, and the `.99` above it is
 * `$83.99`. The stores round that division up to `$7.00`, so the paywall
 * truncates instead (`perMonthPrice.ts`), and above about $100 there is no
 * yearly price the stores' rounding would turn into a `.99` at all.
 *
 * The assertion is on the price: this is where the intent is written down, so
 * a dashboard edit that breaks it fails here rather than on the paywall.
 */
describe('the yearly prices divide into a clean monthly', () => {
  it.each(US_PRICES.map((p) => [p.name, p.yearly, p.perMonth] as const))(
    '%s: %d a year reads as %s a month',
    (_name, year, perMonth) => {
      expect(perMonthPriceString(`$${year.toFixed(2)}`, year)).toBe(`$${perMonth}`)
    },
  )
})
