import type { BillingPeriod } from '@langx/shared'
import { perMonthPriceString } from './perMonthPrice'
import { yearlyFreeMonths, yearlySavingPercent, type SavingInput } from './planSaving'

/** The parts of a store offer a plan card prices itself from. */
export interface PricedOffer extends SavingInput {
  /** The store's own text for the charge. */
  priceString: string
  /** The store's own per-month text, when it gives one. */
  perMonthPriceString?: string
}

/** What a year saves, in the unit the card states it in. */
export type PlanSaving = { months: number } | { percent: number }

export interface PlanPrice {
  /**
   * What the store will charge, in its own words. The card's headline figure,
   * for every period.
   */
  billed: string
  /** What `billed` is per. */
  period: BillingPeriod
  /**
   * A yearly plan's month, written the way the store wrote the year. Shown
   * beneath `billed`, smaller; `null` for any other period, and for a yearly
   * price neither we nor the store can divide.
   */
  perMonth: string | null
  /** What the year gives away against twelve months, when there is an honest figure. Beneath `billed` too. */
  saving: PlanSaving | null
}

/**
 * Which figures a plan card shows, and which one leads.
 *
 * **The charge leads, always.** Apple's subscription guidance and Google
 * Play's subscription policy both want the amount that will be billed to be
 * the most prominent price on the screen, with anything computed from it — a
 * month's worth of a year, months free, a percentage — beneath it and smaller.
 * The card used to lead with the month, because `$6.99` beside `$9.99` is the
 * cleaner comparison; that is the layout both stores name as misleading.
 * Returning the charge as `billed` and everything else as subordinate fields
 * is the whole rule, in one place a test can hold.
 *
 * A yearly month prefers our truncated figure (`perMonthPriceString`) and
 * falls back to the store's rounded one. The saving prefers whole months and
 * falls back to the percentage (`planSaving.ts`). Pure, and in `src/lib`, so
 * vitest reaches it.
 */
export function planPrice(offer: PricedOffer, monthly: SavingInput | undefined): PlanPrice {
  const billed = offer.priceString
  if (offer.period !== 'yearly') {
    return { billed, period: offer.period, perMonth: null, saving: null }
  }

  const months = yearlyFreeMonths(offer, monthly)
  const percent = months === null ? yearlySavingPercent(offer, monthly) : null
  return {
    billed,
    period: offer.period,
    perMonth:
      perMonthPriceString(offer.priceString, offer.price) ?? offer.perMonthPriceString ?? null,
    saving: months !== null ? { months } : percent !== null ? { percent } : null,
  }
}
