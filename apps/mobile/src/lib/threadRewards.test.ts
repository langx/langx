import { TOKEN_RULES, type SendAward } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { rewardsAnnouncement, threadRewards } from './threadRewards'

const { message, correction, mutualConversation } = TOKEN_RULES.award

function award(tokens: number, extra: Partial<SendAward> = {}): SendAward {
  return { tokens, streak: null, capped: false, ...extra }
}

function streak(current: number, milestoneXp: number): NonNullable<SendAward['streak']> {
  return {
    current,
    longest: current,
    lastQualifiedDay: '2026-10-19',
    advanced: true,
    milestoneXp,
    freezeUsed: false,
  }
}

describe('threadRewards', () => {
  it('draws nothing without an award, or for an award of nothing', () => {
    expect(threadRewards(undefined, 'message')).toEqual([])
    expect(threadRewards(award(0), 'message')).toEqual([])
    expect(threadRewards(award(0, { capped: true }), 'message')).toEqual([])
    expect(threadRewards(award(0), 'correction')).toEqual([])
  })

  it("gives a plain message's own point no chip", () => {
    expect(threadRewards(award(message), 'message')).toEqual([])
  })

  it("draws a correction's pay", () => {
    expect(threadRewards(award(correction), 'correction')).toEqual([
      { kind: 'corrected', amount: correction },
    ])
  })

  it('splits the reciprocity bonus off the send that earned it', () => {
    expect(threadRewards(award(message + mutualConversation), 'message')).toEqual([
      { kind: 'bothWrote', amount: mutualConversation },
    ])
    expect(threadRewards(award(correction + mutualConversation), 'correction')).toEqual([
      { kind: 'corrected', amount: correction },
      { kind: 'bothWrote', amount: mutualConversation },
    ])
  })

  it('does not count a capped message as paid when the bonus arrives with it', () => {
    expect(threadRewards(award(mutualConversation, { capped: true }), 'message')).toEqual([
      { kind: 'bothWrote', amount: mutualConversation },
    ])
  })

  it('does not draw a capped correction as paid', () => {
    expect(threadRewards(award(0, { capped: true }), 'correction')).toEqual([])
    expect(threadRewards(award(mutualConversation, { capped: true }), 'correction')).toEqual([
      { kind: 'bothWrote', amount: mutualConversation },
    ])
  })

  it("draws a streak milestone with the server's own figure and the streak's length", () => {
    expect(threadRewards(award(message + 50, { streak: streak(7, 50) }), 'message')).toEqual([
      { kind: 'streak', amount: 50, days: 7, day: '2026-10-19' },
    ])
    expect(threadRewards(award(correction + 50, { streak: streak(30, 50) }), 'correction')).toEqual(
      [
        { kind: 'corrected', amount: correction },
        { kind: 'streak', amount: 50, days: 30, day: '2026-10-19' },
      ],
    )
  })

  it('never draws more than the award holds', () => {
    // A milestone reported larger than the whole payout is clamped to it.
    expect(threadRewards(award(5, { streak: streak(7, 50) }), 'message')).toEqual([
      { kind: 'streak', amount: 5, days: 7, day: '2026-10-19' },
    ])
  })
})

describe('rewardsAnnouncement', () => {
  const t = createTranslate('en')

  it('says one chip as its own label', () => {
    expect(rewardsAnnouncement(t, [{ kind: 'corrected', amount: 10 }], 'Anna')).toBe(
      '10 tokens: you corrected Anna',
    )
  })

  it('says every chip a send earned in one sentence, in the order they sit', () => {
    expect(
      rewardsAnnouncement(
        t,
        [
          { kind: 'corrected', amount: 10 },
          { kind: 'bothWrote', amount: 15 },
          { kind: 'streak', amount: 50, days: 7, day: '2026-10-19' },
        ],
        'Anna',
      ),
    ).toBe(
      '10 tokens: you corrected Anna. 15 tokens each for you and Anna: you both wrote. 50 tokens: 7-day streak',
    )
  })

  it('says nothing for no chips', () => {
    expect(rewardsAnnouncement(t, [], 'Anna')).toBe('')
  })
})
