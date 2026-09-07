import { describe, expect, it } from 'vitest'
import { yearlySavingPercent } from './planSaving'

const monthly = (price: number) => ({ period: 'monthly' as const, price })
const yearly = (price: number) => ({ period: 'yearly' as const, price })

/** The two prices on sale in the storefront the others are converted from. */
const US_PRICES = [
  { name: 'Fluent', yearly: 59.9, monthly: 6.99, perMonth: '4.99', saving: 29 },
  { name: 'Polyglot', yearly: 95.9, monthly: 12.99, perMonth: '7.99', saving: 38 },
] as const

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
 * The paywall leads a yearly plan with the store's own per-month string, so the
 * yearly price is chosen backwards from what that division should read. `$4.99`
 * a month wants `$59.88` a year, which is not a price point Apple sells — the
 * endings are `.99`, `.00`, `.90` and `.95` — so the `.90` at the same dollar
 * is taken instead, and it stays inside the window that still formats as
 * `$4.99`. Picking `$59.99` instead would print `$5.00` and throw the whole
 * point away, which is a mistake easy to make from a dashboard months from now.
 *
 * The assertion is on the price rather than on any code: nothing in the bundle
 * does this division, and this is the only place the intent is written down.
 */
describe('the yearly prices divide into a clean monthly', () => {
  it.each(US_PRICES.map((p) => [p.name, p.yearly, p.perMonth] as const))(
    '%s: %d a year reads as %s a month',
    (_name, year, perMonth) => {
      expect((year / 12).toFixed(2)).toBe(perMonth)
    },
  )
})
