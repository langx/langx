import { describe, expect, it } from 'vitest'
import { trialDays } from './trialDays'

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
