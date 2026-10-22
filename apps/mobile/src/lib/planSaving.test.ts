import { describe, expect, it } from 'vitest'
import { perMonthPriceString } from './perMonthPrice'
import { yearlyFreeMonths, yearlySavingPercent } from './planSaving'

const monthly = (price: number) => ({ period: 'monthly' as const, price })
const yearly = (price: number) => ({ period: 'yearly' as const, price })

/** The price on sale in the storefront the others are converted from. */
const US_PRICES = [
  { name: 'Pro', yearly: 79.99, monthly: 9.99, perMonth: '6.66', saving: 33 },
] as const

/**
 * Pro in each storefront the plan names (`docs/release-runbook.md` → "One plan:
 * Pro"), with the yearly cut of 21 October 2026. Every one of them is 3.4–3.99
 * months short of twelve, so every one reads "3 months free" — computed, never
 * typed on the paywall. $79.99 is 3.99: floored, it is still three.
 */
const STOREFRONTS = [
  { name: 'US', yearly: 79.99, monthly: 9.99 },
  { name: 'Euro', yearly: 89.99, monthly: 10.99 },
  { name: 'UK', yearly: 79.99, monthly: 9.99 },
  { name: 'Canada / Australia', yearly: 119.99, monthly: 13.99 },
  { name: 'Turkey', yearly: 1799.99, monthly: 214.99 },
] as const

/**
 * Storefronts whose monthly is above the usual one, where the same cut gave
 * the year a fourth free month (Play: Albania, Belarus, Moldova, North
 * Macedonia and Uganda; the West and Central African EUR regions).
 */
const FOUR_MONTH_STOREFRONTS = [
  { name: 'USD at $11.99 a month', yearly: 89.99, monthly: 11.99 },
  { name: 'EUR at €8.99 a month', yearly: 69.99, monthly: 8.99 },
] as const

describe('yearlyFreeMonths', () => {
  it.each(STOREFRONTS.map((p) => [p.name, yearly(p.yearly), monthly(p.monthly)] as const))(
    'reads 3 months free off the %s prices',
    (_name, year, month) => {
      expect(yearlyFreeMonths(year, month)).toBe(3)
    },
  )

  it.each(
    FOUR_MONTH_STOREFRONTS.map((p) => [p.name, yearly(p.yearly), monthly(p.monthly)] as const),
  )('reads 4 months free off the %s prices', (_name, year, month) => {
    expect(yearlyFreeMonths(year, month)).toBe(4)
  })

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
    expect(yearlyFreeMonths(yearly(79.99), undefined)).toBeNull()
    expect(yearlyFreeMonths(yearly(79.99), monthly(0))).toBeNull()
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
 * Since 21 October 2026 the yearly price ends in `9.99`, rounded down from the
 * `12 × a .99 month + 0.11` it used to be (`$83.99` → `$79.99`). The per-month
 * figure under it is whatever the truncated division comes to (`perMonthPrice.ts`)
 * — `$6.66`, where the stores' own rounding would say `$6.67`.
 *
 * The assertion is on the price: this is where the intent is written down, so
 * a dashboard edit that breaks it fails here rather than on the paywall.
 */
describe('the yearly prices end in 9.99', () => {
  it.each(US_PRICES.map((p) => [p.name, p.yearly, p.perMonth] as const))(
    '%s: %d a year reads as %s a month',
    (_name, year, perMonth) => {
      expect(year.toFixed(2).endsWith('9.99')).toBe(true)
      expect(perMonthPriceString(`$${year.toFixed(2)}`, year)).toBe(`$${perMonth}`)
    },
  )
})
