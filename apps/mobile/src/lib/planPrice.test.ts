import { describe, expect, it } from 'vitest'
import { planPrice } from './planPrice'

const monthly = { period: 'monthly' as const, price: 9.99, priceString: '$9.99' }
const yearly = { period: 'yearly' as const, price: 79.99, priceString: '$79.99' }

describe('planPrice', () => {
  /** The rule the stores review: the charge is the card's headline, the month is not. */
  it('leads a yearly plan with the yearly charge, and puts the month beneath it', () => {
    expect(planPrice(yearly, monthly)).toEqual({
      billed: '$79.99',
      period: 'yearly',
      perMonth: '$6.66',
      saving: { months: 3 },
    })
  })

  it('leads a monthly plan with the monthly charge, and computes nothing', () => {
    expect(planPrice(monthly, monthly)).toEqual({
      billed: '$9.99',
      period: 'monthly',
      perMonth: null,
      saving: null,
    })
  })

  it('leads a one-off purchase with what it costs', () => {
    const lifetime = { period: 'lifetime' as const, price: 199.99, priceString: '$199.99' }
    expect(planPrice(lifetime, monthly)).toEqual({
      billed: '$199.99',
      period: 'lifetime',
      perMonth: null,
      saving: null,
    })
  })

  /** The fake store's prices: the month keeps the store's prefix, the charge is untouched. */
  it('keeps the store’s own text for the charge', () => {
    const test = planPrice({ ...yearly, priceString: 'TEST $79.99' }, monthly)
    expect(test.billed).toBe('TEST $79.99')
    expect(test.perMonth).toBe('TEST $6.66')
  })

  it('falls back to the store’s month when the yearly text cannot be read back', () => {
    const odd = { ...yearly, priceString: 'eighty' }
    expect(planPrice({ ...odd, perMonthPriceString: '$6.67' }, monthly).perMonth).toBe('$6.67')
    expect(planPrice(odd, monthly).perMonth).toBeNull()
    expect(planPrice(odd, monthly).billed).toBe('eighty')
  })

  it('states a percentage only when a year gives away less than a whole month', () => {
    expect(planPrice({ ...yearly, price: 110 }, monthly).saving).toEqual({ percent: 8 })
    expect(planPrice({ ...yearly, price: 119.88 }, monthly).saving).toBeNull()
  })

  it('claims no saving without a monthly plan to measure against', () => {
    expect(planPrice(yearly, undefined).saving).toBeNull()
    expect(planPrice(yearly, undefined).billed).toBe('$79.99')
  })
})
