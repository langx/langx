import { describe, expect, it } from 'vitest'
import { yearlySavingPercent } from './planSaving'

const monthly = (price: number) => ({ period: 'monthly' as const, price })
const yearly = (price: number) => ({ period: 'yearly' as const, price })

describe('yearlySavingPercent', () => {
  /**
   * The four prices actually on sale, in the two storefronts that have been
   * priced by hand. Türkiye is the reason this is computed at all: its numbers
   * were edited away from Apple's conversion, and they still have to produce a
   * true percentage.
   */
  it.each([
    ['Fluent, USD', yearly(49.99), monthly(6.99), 40],
    ['Polyglot, USD', yearly(94.99), monthly(12.99), 39],
    ['Fluent, TRY', yearly(1099.99), monthly(149.99), 39],
    ['Polyglot, TRY', yearly(1799.99), monthly(249.99), 40],
  ])('reads %s off the store prices', (_name, year, month, expected) => {
    expect(yearlySavingPercent(year, month)).toBe(expected)
  })

  it('says nothing when there is no monthly price to compare against', () => {
    expect(yearlySavingPercent(yearly(49.99), undefined)).toBeNull()
  })

  it('says nothing when the monthly price is zero', () => {
    expect(yearlySavingPercent(yearly(49.99), monthly(0))).toBeNull()
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
