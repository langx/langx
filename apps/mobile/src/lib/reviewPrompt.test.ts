import { TOKEN_RULES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REVIEW_STATE,
  markAsked,
  noteCorrection,
  parseReviewPromptState,
  shouldAskForReview,
  type ReviewPromptState,
} from './reviewPrompt'

const now = new Date('2026-09-05T12:00:00.000Z')
const context = { now, version: '2.1.0' }
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()

describe('parseReviewPromptState', () => {
  it('starts fresh from anything that is not a record', () => {
    expect(parseReviewPromptState(null)).toEqual(DEFAULT_REVIEW_STATE)
    expect(parseReviewPromptState('x')).toEqual(DEFAULT_REVIEW_STATE)
    expect(parseReviewPromptState(undefined)).toEqual(DEFAULT_REVIEW_STATE)
  })

  it('keeps what it recognises and repairs the rest', () => {
    expect(
      parseReviewPromptState({ askedAt: daysAgo(1), askedCount: 2.7, corrections: -3, junk: 1 }),
    ).toEqual({ askedAt: daysAgo(1), askedCount: 2, askedVersion: null, corrections: 0 })
  })
})

describe('shouldAskForReview — streak milestones', () => {
  it('asks on a day the shared table pays', () => {
    for (const day of Object.keys(TOKEN_RULES.streakMilestones).map(Number)) {
      expect(
        shouldAskForReview(DEFAULT_REVIEW_STATE, { kind: 'streakMilestone', day }, context),
      ).toBe(true)
    }
  })

  it('stays quiet on an ordinary day', () => {
    expect(
      shouldAskForReview(DEFAULT_REVIEW_STATE, { kind: 'streakMilestone', day: 8 }, context),
    ).toBe(false)
    expect(
      shouldAskForReview(DEFAULT_REVIEW_STATE, { kind: 'streakMilestone', day: 0 }, context),
    ).toBe(false)
  })

  it('reads the milestone list from the context when one is given', () => {
    expect(
      shouldAskForReview(
        DEFAULT_REVIEW_STATE,
        { kind: 'streakMilestone', day: 5 },
        {
          ...context,
          milestones: [5],
        },
      ),
    ).toBe(true)
  })
})

describe('shouldAskForReview — corrections', () => {
  it('asks on the third, the twenty-fifth and the hundredth, and on no other', () => {
    let state: ReviewPromptState = DEFAULT_REVIEW_STATE
    const asked: number[] = []
    for (let i = 1; i <= 100; i++) {
      state = noteCorrection(state)
      if (shouldAskForReview(state, { kind: 'correction' }, context)) asked.push(i)
    }
    expect(asked).toEqual([3, 25, 100])
  })
})

describe('shouldAskForReview — rationing', () => {
  const milestone = { kind: 'streakMilestone', day: 7 } as const

  it('never asks twice under the same version', () => {
    const state = markAsked(DEFAULT_REVIEW_STATE, new Date(daysAgo(400)), '2.1.0')
    expect(shouldAskForReview(state, milestone, context)).toBe(false)
  })

  it('waits ninety days between asks', () => {
    const recent = markAsked(DEFAULT_REVIEW_STATE, new Date(daysAgo(89)), '2.0.0')
    const old = markAsked(DEFAULT_REVIEW_STATE, new Date(daysAgo(91)), '2.0.0')
    expect(shouldAskForReview(recent, milestone, context)).toBe(false)
    expect(shouldAskForReview(old, milestone, context)).toBe(true)
  })

  it('treats a corrupt askedAt as "asked", not as "never asked"', () => {
    const state = { ...DEFAULT_REVIEW_STATE, askedAt: 'not a date' }
    expect(shouldAskForReview(state, milestone, context)).toBe(false)
  })
})

describe('markAsked', () => {
  it('records when, how often and under which version', () => {
    const state = markAsked(DEFAULT_REVIEW_STATE, now, '2.1.0')
    expect(state).toEqual({
      askedAt: now.toISOString(),
      askedCount: 1,
      askedVersion: '2.1.0',
      corrections: 0,
    })
    expect(markAsked(state, now, '2.1.0').askedCount).toBe(2)
  })
})
