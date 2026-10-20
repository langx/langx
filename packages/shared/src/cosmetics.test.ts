import { describe, expect, it } from 'vitest'
import { COSMETIC_KINDS } from './cosmetics'
import { PAID_PLAN_TIERS } from './limits'
import { TOKEN_RULES } from './token'
import {
  COSMETICS,
  COSMETIC_TONES,
  PRO_WELCOME_PACKS,
  findCosmetic,
  isLadderKind,
  ladderOpen,
  ladderOpeners,
  meetsRequirement,
  previousCosmetic,
  welcomePackDelta,
  UNKNOWN_FRAME_TONE,
  wornCosmetic,
  wornFrameTone,
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
    for (const kind of COSMETIC_KINDS.filter(isLadderKind)) {
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
  /**
   * Sticker packs are shopped, not climbed — so every pack has nothing below
   * it, not just the first. Without this a second pack would silently become
   * unbuyable until the first was owned.
   */
  it('puts no pack behind another pack', () => {
    for (const pack of COSMETICS.filter((c) => c.kind === 'stickers')) {
      expect(previousCosmetic(pack), pack.id).toBeUndefined()
    }
  })

  it('has nothing below the first rung of either ladder', () => {
    for (const kind of COSMETIC_KINDS.filter(isLadderKind)) {
      const first = COSMETICS.find((c) => c.kind === kind)!
      expect(previousCosmetic(first), first.id).toBeUndefined()
    }
  })

  it('walks one step down, never across to the other kind', () => {
    for (const kind of COSMETIC_KINDS.filter(isLadderKind)) {
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
    for (const kind of COSMETIC_KINDS.filter(isLadderKind)) {
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

describe('ladderOpen', () => {
  const frames = COSMETICS.filter((c) => c.kind === 'frame')
  const frame = (id: string) => findCosmetic(id)!

  it('opens the bottom rung with nothing owned', () => {
    expect(ladderOpeners(frames[0]!)).toEqual([])
    expect(ladderOpen(frames[0]!, [])).toBe(true)
  })

  it('opens a rung with the one below it', () => {
    expect(ladderOpen(frame('frame.bronze'), ['frame.washi'])).toBe(true)
  })

  /** The case the rule was written for: Woven Reed owned, Linocut inserted under it. */
  it('opens an inserted rung for somebody who owns a rung above it', () => {
    expect(ladderOpen(frame('frame.lino'), ['frame.slate', 'frame.sky'])).toBe(true)
    expect(ladderOpen(frame('frame.lino'), ['frame.midnight'])).toBe(true)
  })

  it('keeps a rung shut when only rungs further down are owned', () => {
    expect(ladderOpen(frame('frame.bronze'), ['frame.slate'])).toBe(false)
    expect(ladderOpen(frame('frame.gold'), ['frame.slate', 'frame.washi'])).toBe(false)
  })

  it('never counts the rung itself, or the other ladder', () => {
    expect(ladderOpeners(frame('frame.lino'))).not.toContain('frame.lino')
    expect(ladderOpen(frame('frame.bronze'), ['frame.bronze'])).toBe(false)
    expect(ladderOpen(frame('frame.bronze'), ['title.legend'])).toBe(false)
  })

  it('puts no sticker pack behind anything', () => {
    for (const pack of COSMETICS.filter((c) => c.kind === 'stickers')) {
      expect(ladderOpen(pack, []), pack.id).toBe(true)
    }
  })
  /**
   * The whole ladder, one owned rung at a time: owning rung `i` opens every
   * rung up to `i + 1` and nothing past it. The rule hands out no shortcut —
   * the highest rung anybody can buy is still one above the highest they own.
   */
  it('opens at most one rung past the highest owned, on either ladder', () => {
    for (const kind of ['frame', 'title'] as const) {
      const ladder = COSMETICS.filter((c) => c.kind === kind)
      ladder.forEach((owned, i) => {
        ladder.forEach((rung, j) => {
          if (j === i) return
          expect(ladderOpen(rung, [owned.id]), `${owned.id} -> ${rung.id}`).toBe(j <= i + 1)
        })
      })
    }
  })

  it('keeps Aurora Glass behind Night Hoop, whatever else is owned', () => {
    const below = COSMETICS.filter((c) => c.kind === 'frame' && c.id !== 'frame.midnight')
    expect(ladderOpeners(frame('frame.aurora'))).toEqual(['frame.midnight'])
    expect(
      ladderOpen(
        frame('frame.aurora'),
        below.map((c) => c.id),
      ),
    ).toBe(false)
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

describe('wornFrameTone', () => {
  it("is the worn frame's tone", () => {
    expect(wornFrameTone({ frame: 'frame.washi' }, ['frame.slate', 'frame.washi'])).toBe('blush')
    expect(wornFrameTone(undefined, ['frame.slate'])).toBe('slate')
  })

  it('is nothing for somebody with no frame', () => {
    expect(wornFrameTone(undefined, [])).toBeUndefined()
    expect(wornFrameTone(undefined, ['title.tutor'])).toBeUndefined()
  })

  /**
   * A frame bought on a newer build, worn on an older one. Its id is not in
   * this catalogue; the face still wears a ring rather than nothing.
   */
  it('is a tone nothing matches for a frame this build does not know', () => {
    const tone = wornFrameTone({ frame: 'frame.future' }, ['frame.slate', 'frame.future'])
    expect(tone).toBe(UNKNOWN_FRAME_TONE)
    expect(COSMETIC_TONES as readonly string[]).not.toContain(tone)
    expect(wornFrameTone(undefined, ['frame.future'])).toBe(UNKNOWN_FRAME_TONE)
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

  /** Polyglot's old pack, so nobody who had it is given less by the merge. */
  it('keeps the old Fluent frames inside the single pack', () => {
    for (const id of ['frame.slate', 'frame.bronze']) {
      expect(PRO_WELCOME_PACKS.pro.cosmetics, id).toContain(id)
    }
  })

  /**
   * A gift bypasses the ladder — `grantWelcomePack` writes with `$addToSet`
   * and never goes through `purchase` — so the packs are the one place that
   * can hand somebody a rung above one they do not own. The pack used to be
   * the bottom of each ladder; since rungs were inserted it names four frames
   * that are not contiguous any more. What has to hold is that a holder is
   * never stuck: every rung from the bottom to one past the pack's top opens
   * with what the pack gave.
   */
  it('leaves every rung up to and just past the gift open to whoever holds it', () => {
    for (const tier of PAID_PLAN_TIERS) {
      const granted = PRO_WELCOME_PACKS[tier].cosmetics
      for (const kind of COSMETIC_KINDS.filter(isLadderKind)) {
        const ladder = COSMETICS.filter((c) => c.kind === kind)
        const top = Math.max(...ladder.map((c, i) => (granted.includes(c.id) ? i : -1)))
        if (top < 0) continue
        for (const rung of ladder.slice(0, top + 2)) {
          expect(ladderOpen(rung, granted), `${tier}/${rung.id}`).toBe(true)
        }
      }
    }
  })

  /** Behic's call when the art frames were inserted: the pack is named by id. */
  it('still grants the four frames it always named', () => {
    expect(PRO_WELCOME_PACKS.pro.cosmetics.filter((id) => id.startsWith('frame.'))).toEqual([
      'frame.slate',
      'frame.bronze',
      'frame.sky',
      'frame.silver',
    ])
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

  /** What `merge-pro-tiers.ts` hands an ex-Fluent subscriber. */
  it('is the difference for somebody who had the old Fluent pack', () => {
    expect(welcomePackDelta('pro', ['frame.slate', 'frame.bronze'])).toEqual([
      'frame.sky',
      'frame.silver',
      'title.beginner',
      'title.learner',
    ])
  })

  it('is empty once everything in it is owned', () => {
    expect(welcomePackDelta('pro', [...PRO_WELCOME_PACKS.pro.cosmetics])).toEqual([])
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
