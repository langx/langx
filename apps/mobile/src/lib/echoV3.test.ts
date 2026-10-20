import { SRS_RULES, TOKEN_RULES, type EchoAward } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { planEchoDone, reviewMinutes } from './echoV3'

const SIZE = SRS_RULES.sessionSize
const CAP = TOKEN_RULES.caps.echoSessionsPerDay
const PAY = TOKEN_RULES.award.echoSession

function award(tokens: number, streak: number | null = null): EchoAward {
  return {
    tokens,
    streak:
      streak === null
        ? null
        : {
            current: streak,
            longest: streak,
            lastQualifiedDay: '2026-10-19',
            advanced: true,
            milestoneXp: 0,
            freezeUsed: false,
          },
  }
}

describe('reviewMinutes', () => {
  it('says nothing without a pace', () => {
    expect(reviewMinutes(12, null)).toBeNull()
    expect(reviewMinutes(12, undefined)).toBeNull()
  })

  it('says nothing with nothing due', () => {
    expect(reviewMinutes(0, 20)).toBeNull()
  })

  it('rounds to whole minutes, and is never zero', () => {
    expect(reviewMinutes(12, 20)).toBe(4)
    expect(reviewMinutes(1, 6)).toBe(1)
    expect(reviewMinutes(100, 9)).toBe(15)
  })
})

describe('planEchoDone', () => {
  it('names the session this batch completed, its token and the streak', () => {
    expect(planEchoDone({ award: award(PAY, 12), reviewedToday: SIZE, dueNext: 3 })).toEqual({
      tokens: PAY,
      streakDay: 12,
      sessions: { kind: 'this', done: 1, cap: CAP },
      more: true,
    })
  })

  it('leads with Done once the last paid session of the day is in', () => {
    const plan = planEchoDone({ award: award(PAY), reviewedToday: CAP * SIZE, dueNext: 40 })
    expect(plan.sessions).toEqual({ kind: 'this', done: CAP, cap: CAP })
    expect(plan.more).toBe(false)
  })

  it('says why a session past the cap earned nothing, and claims no token', () => {
    const plan = planEchoDone({ award: award(0), reviewedToday: (CAP + 1) * SIZE, dueNext: 40 })
    expect(plan.tokens).toBeNull()
    expect(plan.streakDay).toBeNull()
    expect(plan.sessions).toEqual({ kind: 'all', done: CAP, cap: CAP })
    expect(plan.more).toBe(false)
  })

  it('names no session for a short one that completed none', () => {
    const plan = planEchoDone({ award: award(0), reviewedToday: SIZE - 6, dueNext: 2 })
    expect(plan.sessions).toBeNull()
    expect(plan.more).toBe(true)
  })

  it('offers no other session with nothing left to review', () => {
    expect(planEchoDone({ award: award(PAY), reviewedToday: SIZE, dueNext: 0 }).more).toBe(false)
  })

  it('claims nothing about the day before the summary has caught up', () => {
    const plan = planEchoDone({ award: award(PAY, 3), reviewedToday: undefined, dueNext: 5 })
    expect(plan.tokens).toBe(PAY)
    expect(plan.sessions).toBeNull()
    expect(plan.more).toBe(false)
  })

  it('says nothing about tokens or the streak to an API older than the award', () => {
    const plan = planEchoDone({ award: undefined, reviewedToday: SIZE, dueNext: 5 })
    expect(plan.tokens).toBeNull()
    expect(plan.streakDay).toBeNull()
    expect(plan.sessions).toBeNull()
  })
})
