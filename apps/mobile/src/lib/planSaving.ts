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
 * **The percentage is never written down anywhere.** Per-country prices are
 * edited by hand in App Store Connect — Türkiye already diverges from Apple's
 * own conversion — so a literal in the bundle would be a price claim that stops
 * being true the next time somebody edits one storefront, silently, in a build
 * nobody rebuilt. Both prices here come from the same offering, which means the
 * same storefront and the same currency, so the ratio needs neither an exchange
 * rate nor a currency formatter.
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
