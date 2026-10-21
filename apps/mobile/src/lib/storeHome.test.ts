import { COSMETICS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import {
  collectionCount,
  FRAME_RARITY,
  frameAction,
  framesByRarity,
  gateRows,
  initialFrame,
  RARITIES,
  upNext,
  withinReach,
} from './storeHome'
import { buildStoreOffers, type StoreInput } from './storeOffers'

const base: StoreInput = {
  balance: 0,
  owned: [],
  streakFreezes: 0,
  longestStreak: 0,
  lifetimeCorrections: 0,
  t: createTranslate('en'),
}
const offers = (input: Partial<StoreInput> = {}) => buildStoreOffers({ ...base, ...input })
const frameIds = COSMETICS.filter((c) => c.kind === 'frame').map((c) => c.id)

describe('frame rarity', () => {
  it('names a rarity for every frame in the catalogue, and nothing else', () => {
    expect(Object.keys(FRAME_RARITY).sort()).toEqual([...frameIds].sort())
  })

  it('never falls as the ladder climbs', () => {
    const ranks = frameIds.map((id) => RARITIES.indexOf(FRAME_RARITY[id]!))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('groups the sixteen as the master sheet does: five, five, five and one', () => {
    const groups = framesByRarity(offers().filter((o) => o.kind === 'frame'))
    expect(groups.map((g) => [g.rarity, g.frames.length])).toEqual([
      ['common', 5],
      ['rare', 5],
      ['epic', 5],
      ['legendary', 1],
    ])
  })
})

describe('withinReach', () => {
  it('is the cheapest open cosmetic the balance covers', () => {
    // 1,200 covers the first frame and the two 1,000 packs; a pack comes first
    // in price order only by being cheaper, and the frame ties it.
    const pick = withinReach(offers({ balance: 1_200 }))
    expect(pick?.price).toBe(1_000)
    expect(pick?.kind).toBeDefined()
  })

  it('never offers a consumable, however cheap', () => {
    expect(withinReach(offers({ balance: 5_000 }))?.kind).toBeDefined()
  })

  it('is nothing when the balance covers nothing', () => {
    expect(withinReach(offers({ balance: 10 }))).toBeUndefined()
  })

  it('skips what is owned and what is locked', () => {
    const owned = ['frame.slate', 'stickers.practice', 'stickers.starter', 'title.beginner']
    const pick = withinReach(offers({ balance: 1_800, owned }))
    // Washi Tape (1,750) is the next frame rung; the 1,500 packs are cheaper,
    // and Paper Talk is the first of them in catalogue order.
    expect(pick?.id).toBe('stickers.paper')
  })

  it('never offers Aurora Glass while a gate is unmet, whatever the balance', () => {
    // Every other cosmetic owned, so Aurora is the only thing left to pick.
    const owned = COSMETICS.filter((c) => c.id !== 'frame.aurora').map((c) => c.id)
    expect(withinReach(offers({ balance: 1_000_000, owned, longestStreak: 364 }))).toBeUndefined()
    expect(
      withinReach(
        offers({ balance: 1_000_000, owned, longestStreak: 365, lifetimeCorrections: 5_000 }),
      )?.id,
    ).toBe('frame.aurora')
  })
})

describe('upNext', () => {
  it('shows the next two rungs of each ladder and three packs not owned, cheapest first', () => {
    const ids = upNext(offers({ owned: ['frame.slate'] })).map((o) => o.id)
    expect(ids).toEqual([
      'frame.washi',
      'frame.bronze',
      'title.beginner',
      'title.learner',
      'stickers.starter',
      'stickers.practice',
      'stickers.paper',
    ])
  })

  /**
   * Ten packs would otherwise outnumber both ladders together. Three, and
   * the next three once those are owned: the cap moves along the catalogue.
   */
  it('caps the packs at three, skipping the ones owned', () => {
    const owned = ['stickers.starter', 'stickers.practice', 'stickers.paper']
    const packs = upNext(offers({ owned }))
      .filter((o) => o.kind === 'stickers')
      .map((o) => o.id)
    expect(packs).toEqual(['stickers.margin', 'stickers.polyglot', 'stickers.pixel'])
  })

  /**
   * Practice sits fifth in the catalogue, behind three 1,500 packs; by
   * catalogue order alone a new account would not see both packs it can
   * afford first.
   */
  it('puts the cheaper packs first, then catalogue order', () => {
    const packs = (owned: string[]) =>
      upNext(offers({ owned }))
        .filter((o) => o.kind === 'stickers')
        .map((o) => o.id)
    expect(packs([])).toEqual(['stickers.starter', 'stickers.practice', 'stickers.paper'])
    expect(packs(['stickers.starter'])).toEqual([
      'stickers.practice',
      'stickers.paper',
      'stickers.margin',
    ])
  })

  it('leaves out what "Within reach" already shows', () => {
    expect(upNext(offers(), 'frame.slate').map((o) => o.id)).not.toContain('frame.slate')
  })

  it('says which rung opens the locked one', () => {
    const second = upNext(offers({ owned: ['frame.slate'] }))[1]
    expect(second?.locked).toBe(true)
    expect(second?.needs).toBe('Washi Tape')
  })
})

describe('collectionCount', () => {
  it('counts what is owned of one kind', () => {
    expect(collectionCount(offers({ owned: ['frame.slate', 'title.beginner'] }), 'frame')).toEqual({
      owned: 1,
      total: frameIds.length,
    })
  })
})

describe('initialFrame', () => {
  const frames = (input: Partial<StoreInput>) => offers(input).filter((o) => o.kind === 'frame')

  it('opens on the next rung that can be bought', () => {
    expect(initialFrame(frames({ owned: ['frame.slate'] }), 'frame.slate')?.id).toBe('frame.washi')
  })

  it('opens on the worn frame once the ladder is climbed', () => {
    const owned = frameIds.filter((id) => id !== 'frame.aurora')
    expect(initialFrame(frames({ owned }), 'frame.gold')?.id).toBe('frame.gold')
  })
})

describe('frameAction', () => {
  const frame = (id: string, input: Partial<StoreInput>) => offers(input).find((o) => o.id === id)!

  it('is buy when open and covered, short when open and not', () => {
    expect(frameAction(frame('frame.slate', { balance: 1_000 }), undefined)).toBe('buy')
    expect(frameAction(frame('frame.slate', { balance: 999 }), undefined)).toBe('short')
  })

  it('is ladder before gate on Aurora Glass', () => {
    expect(frameAction(frame('frame.aurora', { balance: 60_000 }), undefined)).toBe('ladder')
    expect(
      frameAction(frame('frame.aurora', { balance: 60_000, owned: ['frame.midnight'] }), undefined),
    ).toBe('gate')
  })

  it('is wear or wearing once owned', () => {
    const owned = ['frame.slate']
    expect(frameAction(frame('frame.slate', { owned }), undefined)).toBe('wear')
    expect(frameAction(frame('frame.slate', { owned }), 'frame.slate')).toBe('wearing')
  })
})

describe('gateRows', () => {
  it('draws both of Aurora Glass gates with the real counts', () => {
    expect(gateRows('frame.aurora', { longestStreak: 212, corrections: 5_212 })).toEqual([
      { kind: 'streak', current: 212, threshold: 365, met: false },
      { kind: 'corrections', current: 5_212, threshold: 5_000, met: true },
    ])
  })

  it('is empty for a frame with no gate', () => {
    expect(gateRows('frame.slate', { longestStreak: 0, corrections: 0 })).toEqual([])
  })
})
