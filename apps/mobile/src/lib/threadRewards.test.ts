import { TOKEN_RULES, type SendAward } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { threadRewards } from './threadRewards'

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

  it("draws a streak milestone with the server's own figure and the streak's length", () => {
    expect(threadRewards(award(message + 50, { streak: streak(7, 50) }), 'message')).toEqual([
      { kind: 'streak', amount: 50, days: 7 },
    ])
    expect(threadRewards(award(correction + 50, { streak: streak(30, 50) }), 'correction')).toEqual(
      [
        { kind: 'corrected', amount: correction },
        { kind: 'streak', amount: 50, days: 30 },
      ],
    )
  })

  it('never draws more than the award holds', () => {
    // A milestone reported larger than the whole payout is clamped to it.
    expect(threadRewards(award(5, { streak: streak(7, 50) }), 'message')).toEqual([
      { kind: 'streak', amount: 5, days: 7 },
    ])
  })
})
