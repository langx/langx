import type { BillingPeriod } from '@langx/shared'

/** The two facts a saving is computed from, and nothing else. */
export interface SavingInput {
  period: BillingPeriod
  /** The store's own number, in the storefront's currency. */
  price: number
}

/**
 * Below this, the difference is a rounding artefact of two price points that
 * happen not to line up rather than a discount anybody chose, and advertising
 * it reads as a trick.
 */
const MIN_WORTH_SAYING = 5

/**
 * How much less a year costs than twelve months bought one at a time, as a
 * whole percent — or `null` when there is nothing honest to claim.
 *
 * **The percentage is never written down anywhere.** Yearly prices are set one
 * storefront at a time — each has to divide into a round monthly figure in its
 * own currency, and no single conversion does that everywhere — so a literal in
 * the bundle would be a price claim that stops being true the next time
 * somebody edits one storefront, silently, in a build nobody rebuilt. Both
 * prices here come from the same offering, which means the same storefront and
 * the same currency, so the ratio needs neither an exchange rate nor a currency
 * formatter.
 *
 * Pure, and kept apart from `purchases.ts` for the mechanical reason
 * `manageSubscription` and `guestGate` are: `vitest.config.ts` reaches
 * `src/lib/**`, but not a file that imports `react-native`. The arithmetic is
 * the part worth testing.
 */
export function yearlySavingPercent(
  yearly: SavingInput,
  monthly: SavingInput | undefined,
): number | null {
  if (yearly.period !== 'yearly' || monthly?.period !== 'monthly') return null

  const twelveMonths = monthly.price * 12
  if (!Number.isFinite(twelveMonths) || twelveMonths <= 0) return null
  if (!Number.isFinite(yearly.price) || yearly.price < 0) return null

  const percent = Math.round((1 - yearly.price / twelveMonths) * 100)
  // 100 or more could only come from a free or negative yearly price, which is
  // a misconfiguration rather than an offer to shout about.
  return percent >= MIN_WORTH_SAYING && percent < 100 ? percent : null
}

/**
 * How many whole months a year gives away against twelve bought one at a time:
 * `floor(12 − yearly ÷ monthly)`, or `null` below one.
 *
 * The paywall leads with this — "3 months free" — and falls back to
 * `yearlySavingPercent` when it is `null`. Months rather than a percentage
 * because it is the unit people compare: a year at $83.99 against $9.99 a
 * month is 3.6 months nobody pays for, and "3 months free" is the honest floor
 * of that. Never rounded up — "4 months free" would be a claim the prices do
 * not make.
 *
 * Computed from the same two store prices as the percentage, for the same
 * reason: it is a claim about one storefront's prices and must move when they
 * do.
 */
export function yearlyFreeMonths(
  yearly: SavingInput,
  monthly: SavingInput | undefined,
): number | null {
  if (yearly.period !== 'yearly' || monthly?.period !== 'monthly') return null
  if (!Number.isFinite(monthly.price) || monthly.price <= 0) return null
  if (!Number.isFinite(yearly.price) || yearly.price <= 0) return null

  // A hair of tolerance so a price exactly N months short of twelve is not
  // floored to N − 1 by binary arithmetic.
  const months = Math.floor(12 - yearly.price / monthly.price + 1e-9)
  return months >= 1 && months < 12 ? months : null
}
