import { describe, expect, it } from 'vitest'
import { PAID_PLAN_TIERS } from './limits'
import { TOKEN_RULES } from './token'
import {
  COSMETICS,
  COSMETIC_TONES,
  PRO_WELCOME_PACKS,
  findCosmetic,
  meetsRequirement,
  welcomePackDelta,
  wornCosmetic,
} from './cosmetics'

describe('the catalogue', () => {
  it('has no duplicate ids and prices every item', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length)
    for (const c of COSMETICS) expect(c.price, c.id).toBeGreaterThan(0)
  })

  it('gives every frame a tone and no title one', () => {
    for (const c of COSMETICS) {
      if (c.kind === 'frame') expect(COSMETIC_TONES, c.id).toContain(c.tone)
      else expect(c.tone, c.id).toBeUndefined()
    }
  })

  /**
   * A gate has to be monotonic. `purchase` re-checks the streak half inside
   * the atomic update, and a requirement that could go down would let an item
   * be owned and then un-ownable — so only fields that never decrease belong
   * here, and the type is what enforces which.
   */
  it('gates only on numbers that never go down', () => {
    for (const c of COSMETICS) {
      if (!c.requires) continue
      expect(Object.keys(c.requires).sort()).toEqual(
        Object.keys(c.requires)
          .filter((k) => k === 'longestStreak' || k === 'corrections')
          .sort(),
      )
    }
  })

  /**
   * The sink argument. The old six totalled 21,000 — about thirty days for
   * somebody earning well — so the shop emptied in a month and token had
   * nowhere left to go.
   */
  it('is a large enough sink that it cannot be cleared in a month', () => {
    const total = COSMETICS.reduce((sum, c) => sum + c.price, 0)
    // ~700 token is a very active day, so this is well past a year.
    expect(total).toBeGreaterThan(700 * 365)
  })

  it('keeps an entry cheap enough to be a first purchase', () => {
    const cheapest = Math.min(...COSMETICS.map((c) => c.price))
    expect(cheapest).toBeGreaterThan(TOKEN_RULES.signupBonus)
    expect(cheapest).toBeLessThanOrEqual(2000)
  })
})

describe('meetsRequirement', () => {
  const met = { longestStreak: 365, corrections: 5000 }

  it('passes when there is nothing to meet', () => {
    expect(meetsRequirement(undefined, { longestStreak: 0, corrections: 0 })).toBe(true)
  })

  it('needs every named condition, not any of them', () => {
    const requires = { longestStreak: 365, corrections: 5000 }
    expect(meetsRequirement(requires, met)).toBe(true)
    expect(meetsRequirement(requires, { ...met, corrections: 4999 })).toBe(false)
    expect(meetsRequirement(requires, { ...met, longestStreak: 364 })).toBe(false)
  })
})

describe('wornCosmetic', () => {
  it('draws the most expensive owned item when nothing was chosen', () => {
    const owned = ['frame.slate', 'frame.gold', 'frame.bronze']
    expect(wornCosmetic(undefined, owned, 'frame')?.id).toBe('frame.gold')
  })

  it('lets an explicit choice beat the fallback', () => {
    const owned = ['frame.slate', 'frame.gold']
    expect(wornCosmetic({ frame: 'frame.slate' }, owned, 'frame')?.id).toBe('frame.slate')
  })

  /**
   * The server refuses to store an id the caller does not own, but a stale
   * client or an older document must not paint one either.
   */
  it('ignores a chosen item that is not owned', () => {
    expect(wornCosmetic({ frame: 'frame.gold' }, ['frame.slate'], 'frame')?.id).toBe('frame.slate')
    expect(wornCosmetic({ frame: 'frame.gold' }, [], 'frame')).toBeUndefined()
  })

  it('keeps the two slots apart', () => {
    const owned = ['frame.gold', 'title.tutor']
    expect(wornCosmetic(undefined, owned, 'frame')?.id).toBe('frame.gold')
    expect(wornCosmetic(undefined, owned, 'title')?.id).toBe('title.tutor')
  })

  it('is nothing at all for somebody who owns nothing', () => {
    expect(wornCosmetic(undefined, [], 'frame')).toBeUndefined()
  })
})

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
