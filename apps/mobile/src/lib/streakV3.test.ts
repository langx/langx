import { PRO_GIFT_RULES, TOKEN_RULES, shiftDayKey } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { brokenStreakRepair, streakLadder } from './streakV3'

const MILESTONES = { 7: 50, 30: 250, 100: 1000, 180: 1500 }
const PRO = [
  { days: 7, months: 0, weeks: 1 },
  { days: 100, months: 1, weeks: 0 },
]
const ALL_OWED = [7, 100]

function ladder(current: number, proOwed: readonly number[] | undefined) {
  return streakLadder({ current, proOwed, milestones: MILESTONES, proRules: PRO })
}

describe('streakLadder', () => {
  it('shows the next three for a streak that has reached nothing', () => {
    const rungs = ladder(0, ALL_OWED)
    expect(rungs.map((r) => [r.days, r.state, r.toGo])).toEqual([
      [7, 'next', 7],
      [30, 'later', 30],
      [100, 'later', 100],
    ])
  })

  it('starts from the rung just reached, then the one being climbed', () => {
    const rungs = ladder(12, ALL_OWED)
    expect(rungs.map((r) => [r.days, r.state, r.toGo])).toEqual([
      [7, 'reached', 0],
      [30, 'next', 18],
      [100, 'later', 88],
    ])
  })

  it('counts the day a rung is reached as reached', () => {
    expect(ladder(30, ALL_OWED).map((r) => [r.days, r.state])).toEqual([
      [30, 'reached'],
      [100, 'next'],
      [180, 'later'],
    ])
  })

  it('keeps a full window at the top of the table', () => {
    expect(ladder(150, ALL_OWED).map((r) => [r.days, r.state])).toEqual([
      [30, 'reached'],
      [100, 'reached'],
      [180, 'next'],
    ])
    expect(ladder(400, ALL_OWED).map((r) => r.state)).toEqual(['reached', 'reached', 'reached'])
  })

  it('reads the tokens from the milestone table', () => {
    expect(ladder(12, ALL_OWED).map((r) => r.tokens)).toEqual([50, 250, 1000])
  })

  it('names Pro only on the rungs PRO_GIFT_RULES gives it on', () => {
    // 30 pays tokens and no Pro, so it says nothing about Pro.
    expect(ladder(0, ALL_OWED).map((r) => r.pro)).toEqual([
      { months: 0, weeks: 1 },
      null,
      { months: 1, weeks: 0 },
    ])
  })

  it('leaves the Pro off a rung whose gift this account has had', () => {
    expect(ladder(0, [100]).map((r) => r.pro)).toEqual([null, null, { months: 1, weeks: 0 }])
  })

  it('names no Pro at all when the API did not say which are owed', () => {
    expect(ladder(0, undefined).every((r) => r.pro === null)).toBe(true)
    expect(ladder(0, []).every((r) => r.pro === null)).toBe(true)
  })

  it('never claims Pro on a rung already reached', () => {
    const reached = ladder(12, ALL_OWED).find((r) => r.days === 7)
    expect(reached?.pro).toBeNull()
  })

  it('reads the real tables by default', () => {
    const rungs = streakLadder({ current: 0, proOwed: PRO_GIFT_RULES.streak.map((r) => r.days) })
    const first = Math.min(...Object.keys(TOKEN_RULES.streakMilestones).map(Number))
    expect(rungs[0]?.days).toBe(first)
    expect(rungs[0]?.tokens).toBe(TOKEN_RULES.streakMilestones[first])
  })

  it('has a wording for every Pro rung the real table has', () => {
    // The screen words a gift as weeks or as months, never both at once; a
    // rung with both would need a sentence it does not have.
    for (const rung of PRO_GIFT_RULES.streak) {
      expect(rung.months === 0 || rung.weeks === 0).toBe(true)
    }
  })
})

describe('brokenStreakRepair', () => {
  const today = '2026-10-16'
  const back = (n: number) => shiftDayKey(today, -n)
  const run = (from: number, to: number) => {
    const days: string[] = []
    for (let n = from; n <= to; n++) days.push(back(n))
    return days
  }

  it('offers the day that broke a streak, with what it gives back', () => {
    // Ten days, a miss yesterday, and today's check-in restarting at one.
    const filled = new Set([today, ...run(2, 11)])
    expect(brokenStreakRepair({ day: back(1), today, filled, current: 1 })).toBe(12)
  })

  it('offers nothing for a gap a freeze already bridged', () => {
    // The counter kept going across yesterday, so the streak never broke.
    const filled = new Set([today, ...run(2, 11)])
    expect(brokenStreakRepair({ day: back(1), today, filled, current: 11 })).toBeNull()
  })

  it('offers nothing when another missed day sits behind it', () => {
    const filled = new Set([today, ...run(3, 11)])
    expect(brokenStreakRepair({ day: back(1), today, filled, current: 1 })).toBeNull()
  })

  it('offers nothing for the day before a run that started from nothing', () => {
    // Twelve days, and before them a fortnight away: filling the day before
    // the run is one more day, not the streak coming back.
    const filled = new Set(run(0, 11))
    expect(brokenStreakRepair({ day: back(12), today, filled, current: 12 })).toBeNull()
  })

  it('offers nothing when the days on file cannot account for the streak', () => {
    // A streak older than the day records: the walk cannot say what joins.
    const filled = new Set([today])
    expect(brokenStreakRepair({ day: back(1), today, filled, current: 40 })).toBeNull()
  })
})
