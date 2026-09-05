/**
 * How many days of free trial a store's "count × unit" period amounts to.
 *
 * A month counts as 30 days and a year as 365. The screen says "30 days free",
 * which is what every other subscription app says and what people compare
 * against. The alternative is a message per unit in eight languages, for trial
 * lengths we do not sell.
 *
 * Pure, and in a file of its own, because two SDKs need it and neither spells
 * the unit the way the other does: `react-native-purchases` reports `MONTH`,
 * RevenueCat's web SDK reports `month`. Folding the case here rather than at
 * each call site is what keeps the 30-and-365 convention written down once —
 * two copies of it is how one of them quietly stops matching what the paywall
 * claims.
 */
const DAYS_PER_PERIOD_UNIT: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 }

/**
 * `null` for a unit this does not recognise, or a count that is not a real
 * one — a trial length we cannot state is one the paywall must not claim.
 */
export function trialDays(unit: string, count: number): number | null {
  const days = DAYS_PER_PERIOD_UNIT[unit.toUpperCase()]
  if (days === undefined || count <= 0) return null
  return days * count
}
