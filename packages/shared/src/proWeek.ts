import { shiftDayKey } from './periods'
import { PRO_GIFT_RULES } from './proGift'

/**
 * The Pro Week: seven days of Pro for every new account, through the gift
 * path, behind `flags.proWeek` (which starts off).
 *
 * A reverse trial rather than a store trial. Nothing is bought, nothing is
 * billed and no card is asked for: the account is given Pro the moment its
 * profile exists, the gift ends on its own date, and the store's own free
 * week is still there afterwards, untouched. It is never called a "free
 * trial" anywhere a person reads it — that is the store's, and it is a
 * purchase.
 *
 * See `docs/decisions.md` → _The Pro Week: a week of Pro at sign-up, behind a
 * switch_.
 */
export const PRO_WEEK_RULES = {
  /** How long the week is, from the moment the profile is made. */
  weeks: 1,
  /**
   * The streak that keeps Pro for a second week: this many local days in a
   * row, each with a qualifying action, inside the first week.
   *
   * The streak's own first rung, deliberately — inside the Pro Week the second
   * week _is_ that rung's week, under a stricter count. A day bridged by a
   * freeze, bought back with a repair, or only opened counts for nothing here:
   * freezes and repairs are bought with tokens, and tokens never unlock Pro.
   */
  extensionStreakDays: PRO_GIFT_RULES.streak[0].days,
  /** How long the second week is. */
  extensionWeeks: PRO_GIFT_RULES.streak[0].weeks,
  /**
   * The recap — what the week was used for, "Keep Pro", "Continue free" —
   * opens once, on the first visit in its window: from this many hours before
   * the end…
   */
  recapHoursBefore: 24,
  /** …until this many days after it. Later than that it would be news about nothing. */
  recapDaysAfter: 7,
} as const

/** The streak calendar's day, as far as the second week reads it. */
export interface PracticeDayInput {
  day: string
  actions: number
  source: 'activity' | 'purchase' | 'checkIn'
}

/**
 * A day of practice: at least one qualifying action, and not a day bought
 * back. A check-in fills the square with `actions: 0`; a bridged day has no
 * square at all; a repair is `source: 'purchase'`.
 */
export function isPracticeDay(day: PracticeDayInput): boolean {
  return day.actions > 0 && day.source !== 'purchase'
}

/**
 * The run of practice days that ends on `today`, counting none before
 * `from` — the local day the Pro Week started on.
 */
export function practiceRunEndingOn(
  days: readonly PracticeDayInput[],
  today: string,
  from: string,
): number {
  const practice = new Set(days.filter(isPracticeDay).map((entry) => entry.day))
  let run = 0
  let day = today
  while (day >= from && practice.has(day)) {
    run++
    day = shiftDayKey(day, -1)
  }
  return run
}

/** The Pro Week as its owner's profile carries it. Dates are ISO strings on the wire. */
export interface ProWeekWire {
  startedAt: string
  /** When the Pro the week gave ends; absent until the gift has been granted. */
  endsAt?: string
  /** The second week was earned. */
  extended?: boolean
  /** The recap has been seen, on any device. */
  recapSeenAt?: string
}

/**
 * `GET /me/pro-week`: the recap, or `null` when there is none to show — no
 * Pro Week, not yet its last day, long over, already seen, or a plan that
 * carries on past it.
 *
 * Every count is of something the free plan does not do, never of something
 * it does: replies, corrections and the first five new chats of a day are
 * free, so none of them is here.
 */
export interface ProWeekRecap {
  endsAt: string
  ended: boolean
  extended: boolean
  /** Conversations opened beyond the free plan's daily allowance. */
  extraChats: number
  /** Messages sent with a translation under them. */
  translatedSends: number
  /** Languages added during the week, which pause for matching on the free plan. */
  languages: string[]
}

export interface ProWeekRecapResponse {
  recap: ProWeekRecap | null
}

/**
 * Whether the recap's window is open: the last `recapHoursBefore` of the Pro
 * the week gave, or up to `recapDaysAfter` after it ended.
 */
export function proWeekRecapWindowOpen(endsAt: Date, now: Date): boolean {
  const opens = endsAt.getTime() - PRO_WEEK_RULES.recapHoursBefore * 60 * 60 * 1000
  const closes = endsAt.getTime() + PRO_WEEK_RULES.recapDaysAfter * 24 * 60 * 60 * 1000
  return now.getTime() >= opens && now.getTime() < closes
}

/**
 * How many of these new conversations the free plan would have refused: each
 * opening is replayed against a rolling day that only counts the openings the
 * free plan would have let through, which is how `consumeQuota` behaves — a
 * refused attempt takes no slot. `allowance` is `PLAN_LIMITS.free`'s.
 */
export function chatsBeyondAllowance(
  openedAt: readonly Date[],
  allowance: number | null,
  windowMs: number = 24 * 60 * 60 * 1000,
): number {
  if (allowance === null) return 0
  const accepted: number[] = []
  let beyond = 0
  for (const at of [...openedAt].map((date) => date.getTime()).sort((a, b) => a - b)) {
    const inWindow = accepted.filter((earlier) => at - earlier < windowMs).length
    if (inWindow < allowance) accepted.push(at)
    else beyond++
  }
  return beyond
}
