import { PRO_GIFT_RULES, TOKEN_RULES } from '@langx/shared'
import { repairEffect } from './activityMap'

/*
 * The redesign's streak screen, as pure functions: which milestones the
 * ladder shows and what each one says it gives, and whether a missed day is
 * worth offering back. Both are rules a screenshot cannot check — "is this
 * rung really a week of Pro for this person", "does this repair rejoin
 * anything" — so they live here, where the tests reach them.
 */

/** How many rungs the ladder draws: the one just reached, the next, and the one after. */
export const LADDER_SIZE = 3

export interface StreakRung {
  days: number
  /** The milestone's tokens, from `TOKEN_RULES.streakMilestones`. */
  tokens: number
  /**
   * The Pro this rung would give *this account*, or null. Never on a rung
   * already reached: its tokens come back with every run that reaches it, but
   * whether its Pro arrived with this run or an earlier one is not something
   * the screen knows, so it claims neither.
   */
  pro: { months: number; weeks: number } | null
  /** `next` is the one the streak is climbing towards. */
  state: 'reached' | 'next' | 'later'
  /** Days still to go; 0 once reached. */
  toGo: number
}

/**
 * The milestones the ladder shows, in order.
 *
 * A window of `size` rungs, starting from the most recent one reached, so the
 * ladder reads as "done, now this, then that" at any length of streak — seven
 * rungs of which five are years away would be a list of chores. Past the last
 * milestone the window is the last `size`, all reached.
 *
 * A rung names Pro only when `PRO_GIFT_RULES.streak` gives Pro there **and**
 * the server lists it in `proOwed` — the gift is once in an account's life,
 * and never to a lifetime plan. `proOwed` absent (an API older than the field)
 * names no Pro anywhere: the understatement, never the false promise.
 */
export function streakLadder(input: {
  current: number
  proOwed: readonly number[] | undefined
  milestones?: Readonly<Record<number, number>>
  proRules?: readonly { days: number; months: number; weeks: number }[]
  size?: number
}): StreakRung[] {
  const {
    current,
    proOwed,
    milestones = TOKEN_RULES.streakMilestones,
    proRules = PRO_GIFT_RULES.streak,
    size = LADDER_SIZE,
  } = input
  const days = Object.keys(milestones)
    .map(Number)
    .filter((day) => Number.isFinite(day) && day > 0)
    .sort((a, b) => a - b)
  if (days.length === 0) return []

  const next = days.findIndex((day) => day > current)
  const start =
    next === -1
      ? Math.max(0, days.length - size)
      : Math.max(0, Math.min(next - 1, days.length - size))

  return days.slice(start, start + size).map((day, index) => {
    const reached = current >= day
    const rule = proRules.find((rung) => rung.days === day)
    const owed = !reached && rule !== undefined && (proOwed?.includes(day) ?? false)
    return {
      days: day,
      tokens: milestones[day] ?? 0,
      pro: owed && rule.months + rule.weeks > 0 ? { months: rule.months, weeks: rule.weeks } : null,
      state: reached ? 'reached' : start + index === next ? 'next' : 'later',
      toGo: reached ? 0 : day - current,
    }
  })
}

/**
 * The streak a repair of `day` would give back, or null when it would not
 * give a broken streak back.
 *
 * The store sells the newest missed day whatever it does, and its
 * confirmation says so. The streak screen is narrower: it offers the day only
 * when the streak actually broke there — filling it joins today's run to an
 * earlier one, so the streak comes back longer than one more day. That leaves
 * out:
 *
 * - a gap a banked freeze already bridged. The counter is then ahead of the
 *   days on file, the streak never broke, and selling the day would be
 *   selling one extra day as though it were the streak;
 * - a gap with another missed day behind it, where filling one joins nothing;
 * - an account whose streak is older than the day records, where the days on
 *   file cannot say what a repair would join (the counter is ahead of them).
 *
 * `current` is the profile's streak, `filled` the days on file.
 */
export function brokenStreakRepair(input: {
  day: string
  today: string
  filled: ReadonlySet<string>
  current: number
}): number | null {
  const effect = repairEffect({
    day: input.day,
    today: input.today,
    filled: new Set(input.filled),
    price: 0,
    balance: 0,
  })
  if (effect.streakBefore !== input.current) return null
  return effect.streakAfter > effect.streakBefore + 1 ? effect.streakAfter : null
}
