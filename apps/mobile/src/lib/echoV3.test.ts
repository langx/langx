import { ECHO_REVIEW_DURATION_MAX_MS, TOKEN_RULES, type EchoAward } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { boundedEchoReviews, planEchoDone, reviewMinutes } from './echoV3'

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
    expect(planEchoDone({ award: award(PAY, 12), sessionsToday: 1, dueNext: 3 })).toEqual({
      tokens: PAY,
      streakDay: 12,
      sessions: { kind: 'this', done: 1, cap: CAP },
      more: true,
    })
  })

  it('leads with Done once the last paid session of the day is in', () => {
    const plan = planEchoDone({ award: award(PAY), sessionsToday: CAP, dueNext: 40 })
    expect(plan.sessions).toEqual({ kind: 'this', done: CAP, cap: CAP })
    expect(plan.more).toBe(false)
  })

  it('says why a session past the cap earned nothing, and claims no token', () => {
    const plan = planEchoDone({ award: award(0), sessionsToday: CAP, dueNext: 40 })
    expect(plan.tokens).toBeNull()
    expect(plan.streakDay).toBeNull()
    expect(plan.sessions).toEqual({ kind: 'all', done: CAP, cap: CAP })
    expect(plan.more).toBe(false)
  })

  it('names no session for a short one that completed none', () => {
    const plan = planEchoDone({ award: award(0), sessionsToday: 0, dueNext: 2 })
    expect(plan.sessions).toBeNull()
    expect(plan.more).toBe(true)
  })

  it('offers no other session with nothing left to review', () => {
    expect(planEchoDone({ award: award(PAY), sessionsToday: 1, dueNext: 0 }).more).toBe(false)
  })

  it('claims nothing about the day before the summary has caught up', () => {
    const plan = planEchoDone({ award: award(PAY, 3), sessionsToday: undefined, dueNext: 5 })
    expect(plan.tokens).toBe(PAY)
    expect(plan.sessions).toBeNull()
    expect(plan.more).toBe(false)
  })

  it('says nothing about tokens or the streak to an API older than the award', () => {
    const plan = planEchoDone({ award: undefined, sessionsToday: 1, dueNext: 5 })
    expect(plan.tokens).toBeNull()
    expect(plan.streakDay).toBeNull()
    expect(plan.sessions).toBeNull()
  })
})

describe('boundedEchoReviews', () => {
  it('holds a card left on screen to the server’s ceiling, and leaves the rest', () => {
    const sent = boundedEchoReviews({
      reviews: [
        { reviewId: 'rv-a-0000', cardId: 'a', grade: 'good', durationMs: 60 * 60 * 1000 },
        { reviewId: 'rv-b-0000', cardId: 'b', grade: 'hard', durationMs: 4000 },
      ],
    })
    expect(sent.reviews.map((review) => review.durationMs)).toEqual([
      ECHO_REVIEW_DURATION_MAX_MS,
      4000,
    ])
    expect(sent.reviews[0]).toMatchObject({ reviewId: 'rv-a-0000', cardId: 'a', grade: 'good' })
  })
})
