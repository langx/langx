import { describe, expect, it } from 'vitest'
import { PAID_PLAN_TIERS } from './limits'
import { TOKEN_RULES } from './token'
import { PRO_WELCOME_PACKS, findCosmetic, welcomePackDelta } from './cosmetics'

describe('PRO_WELCOME_PACKS', () => {
  it('hands out only things that exist in the catalogue', () => {
    for (const tier of PAID_PLAN_TIERS) {
      for (const id of PRO_WELCOME_PACKS[tier].cosmetics) {
        expect(findCosmetic(id), `${tier}: ${id}`).toBeDefined()
      }
    }
  })

  /**
   * The rule the whole design rests on: paying buys items, never token. A
   * balance is `tokenAggregates.all` minus spending, and that aggregate is
   * what the all-time leaderboard ranks — so a token grant would sell rank.
   * Nothing here can express one, and this asserts the shape stays that way.
   */
  it('cannot express a token grant at all', () => {
    for (const tier of PAID_PLAN_TIERS) {
      expect(Object.keys(PRO_WELCOME_PACKS[tier]).sort()).toEqual(['cosmetics', 'streakFreezes'])
    }
  })

  it('makes Pro+ a superset of Pro, so upgrading never takes something away', () => {
    const pro = new Set(PRO_WELCOME_PACKS.pro.cosmetics)
    for (const id of pro) {
      expect(PRO_WELCOME_PACKS.pro_plus.cosmetics, id).toContain(id)
    }
    expect(PRO_WELCOME_PACKS.pro_plus.streakFreezes).toBeGreaterThanOrEqual(
      PRO_WELCOME_PACKS.pro.streakFreezes,
    )
  })

  it('stays inside the banked-freeze cap, so the grant is never partly discarded', () => {
    for (const tier of PAID_PLAN_TIERS) {
      expect(PRO_WELCOME_PACKS[tier].streakFreezes, tier).toBeLessThanOrEqual(
        TOKEN_RULES.sinks.maxBankedStreakFreezes,
      )
    }
  })
})

describe('welcomePackDelta', () => {
  it('is the whole pack for somebody who owns nothing', () => {
    expect(welcomePackDelta('pro', [])).toEqual([...PRO_WELCOME_PACKS.pro.cosmetics])
  })

  it('is empty once everything in it is owned', () => {
    expect(welcomePackDelta('pro_plus', [...PRO_WELCOME_PACKS.pro_plus.cosmetics])).toEqual([])
  })

  /** Somebody who bought the frame with token does not get a second one. */
  it('skips what was already earned rather than paid for', () => {
    expect(welcomePackDelta('pro', ['frame.bronze'])).toEqual([])
  })
})
