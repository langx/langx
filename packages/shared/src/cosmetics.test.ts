import { describe, expect, it } from 'vitest'
import { COSMETIC_KINDS } from './cosmetics'
import { PAID_PLAN_TIERS } from './limits'
import { TOKEN_RULES } from './token'
import {
  COSMETICS,
  COSMETIC_TONES,
  PRO_WELCOME_PACKS,
  findCosmetic,
  meetsRequirement,
  previousCosmetic,
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

  /**
   * The array's order is the ladder, and the prices are how it is explained.
   * If they disagree — a cheaper item sitting above a dearer one — then the
   * shop asks somebody to buy the expensive thing first and shows them a
   * bargain they are not allowed to have. Nothing else would catch it: every
   * other test here passes on a shuffled catalogue.
   */
  it('prices each ladder strictly upwards, so order and price tell one story', () => {
    for (const kind of COSMETIC_KINDS) {
      const ladder = COSMETICS.filter((c) => c.kind === kind)
      expect(ladder.length, kind).toBeGreaterThan(1)
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i]!.price, `${ladder[i]!.id} after ${ladder[i - 1]!.id}`).toBeGreaterThan(
          ladder[i - 1]!.price,
        )
      }
    }
  })
})

describe('previousCosmetic', () => {
  it('has nothing below the first rung of either ladder', () => {
    for (const kind of COSMETIC_KINDS) {
      const first = COSMETICS.find((c) => c.kind === kind)!
      expect(previousCosmetic(first), first.id).toBeUndefined()
    }
  })

  it('walks one step down, never across to the other kind', () => {
    for (const kind of COSMETIC_KINDS) {
      const ladder = COSMETICS.filter((c) => c.kind === kind)
      for (let i = 1; i < ladder.length; i++) {
        const previous = previousCosmetic(ladder[i]!)
        expect(previous?.id, ladder[i]!.id).toBe(ladder[i - 1]!.id)
        expect(previous?.kind, ladder[i]!.id).toBe(kind)
      }
    }
  })

  /**
   * Walking down from the top has to reach the bottom in exactly as many steps
   * as there are rungs. A cycle or a gap would hang the shop rather than
   * mis-price it.
   */
  it('reaches the bottom of each ladder without looping', () => {
    for (const kind of COSMETIC_KINDS) {
      const ladder = COSMETICS.filter((c) => c.kind === kind)
      let current = ladder.at(-1)
      let steps = 0
      while (current && steps <= ladder.length) {
        current = previousCosmetic(current)
        steps++
      }
      expect(steps, kind).toBe(ladder.length)
    }
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

  /**
   * A gift bypasses the ladder — `grantWelcomePack` writes with `$addToSet`
   * and never goes through `purchase` — so the packs are the one place that
   * can hand somebody a rung above one they do not own. Starting at the bottom
   * is what keeps "own the one below" and "own everything below" the same
   * rule, which is what makes the shop explainable in one sentence.
   */
  it('grants the bottom of each ladder, contiguously, never a rung from up it', () => {
    for (const tier of PAID_PLAN_TIERS) {
      const granted = new Set(PRO_WELCOME_PACKS[tier].cosmetics)
      for (const kind of COSMETIC_KINDS) {
        const ladder = COSMETICS.filter((c) => c.kind === kind)
        const count = ladder.filter((c) => granted.has(c.id)).length
        // Whatever many it gives of a kind, they are the first that many.
        expect(
          ladder.slice(0, count).map((c) => c.id),
          `${tier}/${kind}`,
        ).toEqual(ladder.filter((c) => granted.has(c.id)).map((c) => c.id))
      }
    }
  })

  it('never gifts an item that also has to be earned', () => {
    for (const tier of PAID_PLAN_TIERS) {
      for (const id of PRO_WELCOME_PACKS[tier].cosmetics) {
        expect(findCosmetic(id)?.requires, `${tier}: ${id}`).toBeUndefined()
      }
    }
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

  /**
   * Somebody who bought a frame with token does not get a second one. Derived
   * from the pack rather than naming an id, so it keeps testing the behaviour
   * when the pack's contents move.
   */
  it('skips what was already earned rather than paid for', () => {
    const [first, ...rest] = PRO_WELCOME_PACKS.pro.cosmetics
    expect(first).toBeDefined()
    expect(welcomePackDelta('pro', [first!])).toEqual(rest)
  })
})
