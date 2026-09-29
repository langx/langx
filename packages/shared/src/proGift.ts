import { z } from 'zod'

/**
 * Gifts of Pro: months of the paid plan given rather than bought.
 *
 * Four doors, one mechanism. An operator gives one from the panel; a streak
 * crossing a milestone earns one; every few invitees who become real users
 * earn their referrer one; and a gift code typed into the paywall redeems
 * one (`giftCode.ts`). Each writes a `proGifts` row and the
 * scheduler turns the row into a RevenueCat promotional grant — so the rules
 * of *who* gets *what* are here, and the API only carries them out.
 *
 * Kept apart from `PLAN_LIMITS` and `TOKEN_RULES` because these are neither:
 * nothing here limits a plan and nothing pays a token. They are the one place
 * the product gives away the thing it sells, which is why the numbers are
 * small and every one of them is capped.
 */

/** What an operator may give, in months. Short on purpose: a year is the ceiling. */
export const PRO_GIFT_MONTHS = [1, 3, 6, 12] as const
export type ProGiftMonths = (typeof PRO_GIFT_MONTHS)[number]

export const PRO_GIFT_SOURCES = ['admin', 'referral', 'streak', 'code'] as const
export type ProGiftSource = (typeof PRO_GIFT_SOURCES)[number]

export const PRO_GIFT_RULES = {
  /**
   * Streak milestones, each paid once in an account's life.
   *
   * "At least", not "exactly": a streak already past a milestone on the day
   * this shipped — a v1 restore of four hundred days, say — earns every rung
   * below it on its next real action, once. So a streak of 400 is owed 1 + 3.
   */
  streak: [
    { days: 100, months: 1 },
    { days: 365, months: 3 },
  ],
  /**
   * Every `activationsPerGift` invitees who become real users in a calendar
   * year earn the referrer `monthsPerGift`, up to `maxGiftsPerYear` of them.
   *
   * Counted per calendar year (UTC) rather than rolling, so the cap is a date
   * anybody can read off a calendar: it opens again on 1 January.
   */
  referral: { activationsPerGift: 3, monthsPerGift: 1, maxGiftsPerYear: 3 },
  /**
   * The two reminders before a gift runs out, nearest first. Informational,
   * never a sales letter — a nudge to buy is marketing, and marketing needs a
   * consent this reminder does not ask for.
   */
  reminders: [
    { key: 'day', daysBefore: 1 },
    { key: 'week', daysBefore: 7 },
  ],
} as const

export type ProGiftReminderKey = (typeof PRO_GIFT_RULES.reminders)[number]['key']

/** An operator's gift. The note is for the audit trail and is never shown to the recipient. */
export const adminGiftProSchema = z.object({
  months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
  note: z.string().trim().max(500).optional(),
})
export type AdminGiftProInput = z.infer<typeof adminGiftProSchema>

/**
 * `months` calendar months after `from`, in UTC, landing on the last day of a
 * shorter month rather than spilling into the next — 31 January plus one is
 * the 28th or 29th of February, not 3 March.
 */
export function addMonthsUtc(from: Date, months: number): Date {
  const out = new Date(from.getTime())
  const day = out.getUTCDate()
  out.setUTCDate(1)
  out.setUTCMonth(out.getUTCMonth() + months)
  const lastDay = new Date(
    Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0, 0, 0, 0, 0),
  ).getUTCDate()
  out.setUTCDate(Math.min(day, lastDay))
  return out
}

/** The streak milestones a streak of `current` has reached and has not yet been paid for. */
export function streakGiftsOwed(
  current: number,
  alreadyGiven: readonly number[] = [],
): { days: number; months: number }[] {
  return PRO_GIFT_RULES.streak.filter(
    (rung) => current >= rung.days && !alreadyGiven.includes(rung.days),
  )
}

/** How many referral gifts `activations` in one calendar year have earned, capped. */
export function referralGiftSlots(activations: number): number {
  const { activationsPerGift, maxGiftsPerYear } = PRO_GIFT_RULES.referral
  return Math.min(maxGiftsPerYear, Math.floor(Math.max(0, activations) / activationsPerGift))
}
