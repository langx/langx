import { describe, expect, it } from 'vitest'
import { PRO_GIFT_RULES } from './proGift'
import {
  PRO_WEEK_RULES,
  chatsBeyondAllowance,
  practiceRunEndingOn,
  proWeekRecapWindowOpen,
  type PracticeDayInput,
} from './proWeek'

const HOUR = 60 * 60 * 1000

describe('PRO_WEEK_RULES', () => {
  it('makes the second week the streak’s first rung, so it can never be paid as a third', () => {
    expect(PRO_WEEK_RULES.extensionStreakDays).toBe(PRO_GIFT_RULES.streak[0].days)
    expect(PRO_WEEK_RULES.extensionWeeks).toBe(PRO_GIFT_RULES.streak[0].weeks)
  })
})

describe('practiceRunEndingOn', () => {
  const practice = (day: string): PracticeDayInput => ({ day, actions: 2, source: 'activity' })

  it('counts consecutive days of real practice back from today', () => {
    const days = ['2026-10-12', '2026-10-13', '2026-10-14'].map(practice)
    expect(practiceRunEndingOn(days, '2026-10-14', '2026-10-01')).toBe(3)
  })

  it('stops at a day only opened, a day bought back, and a day with no square', () => {
    const run = (gap: PracticeDayInput | null) =>
      practiceRunEndingOn(
        [practice('2026-10-12'), ...(gap ? [gap] : []), practice('2026-10-14')],
        '2026-10-14',
        '2026-10-01',
      )
    expect(run({ day: '2026-10-13', actions: 0, source: 'checkIn' })).toBe(1)
    expect(run({ day: '2026-10-13', actions: 1, source: 'purchase' })).toBe(1)
    expect(run(null)).toBe(1)
    // A day that began as a check-in and then saw a message is practice.
    expect(run({ day: '2026-10-13', actions: 1, source: 'checkIn' })).toBe(3)
  })

  it('counts nothing from before the week began', () => {
    const days = ['2026-10-12', '2026-10-13', '2026-10-14'].map(practice)
    expect(practiceRunEndingOn(days, '2026-10-14', '2026-10-13')).toBe(2)
  })
})

describe('chatsBeyondAllowance', () => {
  const at = (hours: number) => new Date(Date.UTC(2026, 9, 12) + hours * HOUR)

  it('counts only the openings the free plan would have refused', () => {
    // Seven in one hour: five fit, two would have been refused.
    expect(chatsBeyondAllowance([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map(at), 5)).toBe(2)
    // Five a day for two days fits exactly.
    expect(chatsBeyondAllowance([0, 1, 2, 3, 4, 25, 26, 27, 28, 29].map(at), 5)).toBe(0)
  })

  it('lets a refused opening take no slot, as the quota does', () => {
    // Six in the first hour (one refused), then one at 24.5h: the window then
    // holds the five accepted ones from 0–0.4h only until 24h, so it fits.
    expect(chatsBeyondAllowance([0, 0.1, 0.2, 0.3, 0.4, 0.5, 24.5].map(at), 5)).toBe(1)
  })

  it('is zero on a plan with no limit', () => {
    expect(chatsBeyondAllowance([0, 0, 0].map(at), null)).toBe(0)
  })
})

describe('proWeekRecapWindowOpen', () => {
  const endsAt = new Date('2026-10-20T10:00:00Z')

  it('opens a day before the end and closes a week after it', () => {
    expect(proWeekRecapWindowOpen(endsAt, new Date('2026-10-19T09:59:00Z'))).toBe(false)
    expect(proWeekRecapWindowOpen(endsAt, new Date('2026-10-19T10:00:00Z'))).toBe(true)
    expect(proWeekRecapWindowOpen(endsAt, new Date('2026-10-26T09:59:00Z'))).toBe(true)
    expect(proWeekRecapWindowOpen(endsAt, new Date('2026-10-27T10:00:00Z'))).toBe(false)
  })
})
