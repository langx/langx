import { describe, expect, it } from 'vitest'
import { perMonthPriceString } from './perMonthPrice'

describe('perMonthPriceString', () => {
  /**
   * The prices on sale since 25 September 2026: every yearly price is
   * `12 × month + 0.11`, so each one must read as the `.99` month it was
   * chosen for. The stores' own per-month strings round these up to the next
   * whole unit, which is the reason this function exists.
   */
  it.each([
    ['US Fluent', '$83.99', 83.99, '$6.99'],
    ['US Polyglot', '$131.99', 131.99, '$10.99'],
    ['Türkiye Fluent', '₺1.799,99', 1799.99, '₺149,99'],
    ['Türkiye Polyglot', '₺2.699,99', 2699.99, '₺224,99'],
    ['euro Polyglot', '155,99 €', 155.99, '12,99 €'],
    ['Canada Fluent', 'CA$119.99', 119.99, 'CA$9.99'],
    ['Brazil Fluent', 'R$ 599,90', 599.9, 'R$ 49,99'],
    ['Switzerland Fluent', 'CHF 71.95', 71.95, 'CHF 5.99'],
  ])('%s: %s a year reads as %s a month', (_name, yearly, price, expected) => {
    expect(perMonthPriceString(yearly, price)).toBe(expected)
  })

  it('keeps a currency without minor units whole', () => {
    expect(perMonthPriceString('¥13,200', 13200)).toBe('¥1,100')
    expect(perMonthPriceString('Rp 1.500.000', 1500000)).toBe('Rp 125.000')
  })

  it('groups only where the store grouped', () => {
    expect(perMonthPriceString('₹8,400', 8400)).toBe('₹700')
    expect(perMonthPriceString('Rp 3.000.000', 3000000)).toBe('Rp 250.000')
  })

  it('writes back in the digits the store used', () => {
    expect(perMonthPriceString('٣٥٩٫٩٩ ر.س.‏', 359.99)).toBe('٢٩٫٩٩ ر.س.‏')
  })

  it('truncates rather than rounds', () => {
    // 59.99 ÷ 12 = 4.99917: the store rounds it to $5.00, which is the
    // opposite of what the price was chosen to say.
    expect(perMonthPriceString('$59.99', 59.99)).toBe('$4.99')
  })

  it('gives up on a string that does not state the price it came with', () => {
    expect(perMonthPriceString('$83.99', 90)).toBeNull()
    expect(perMonthPriceString('Free', 83.99)).toBeNull()
    expect(perMonthPriceString('$0.00', 0)).toBeNull()
  })
})
