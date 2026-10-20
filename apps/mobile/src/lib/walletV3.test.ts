import { COSMETICS, isLadderKind } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import type { HistoryRow } from './tokenHistory'
import { historyItems, nextRung } from './walletV3'

const ladder = (kind: 'frame' | 'title') => COSMETICS.filter((item) => item.kind === kind)
const frames = ladder('frame')
const titles = ladder('title')

describe('nextRung', () => {
  it('starts at the cheaper of the two first rungs', () => {
    const first = [frames[0]!, titles[0]!].sort((a, b) => a.price - b.price)[0]!
    expect(nextRung([], 0)?.cosmetic.id).toBe(first.id)
  })

  it('moves up the ladder that was climbed', () => {
    const owned = [frames[0]!.id, titles[0]!.id]
    const expected = [frames[1]!, titles[1]!].sort((a, b) => a.price - b.price)[0]!
    expect(nextRung(owned, 0)?.cosmetic.id).toBe(expected.id)
  })

  it('never offers a rung whose rung below is missing', () => {
    // Owning a gifted rung high up the ladder, and not the one under it.
    const gifted = frames[5]!
    const rung = nextRung([gifted.id, ...titles.map((title) => title.id)], 0)
    expect(rung?.cosmetic.id).toBe(frames[0]!.id)
  })

  it('takes the rung above a gifted one when the one under it is owned', () => {
    const owned = [frames[0]!.id, frames[2]!.id, ...titles.map((title) => title.id)]
    // frames[1] is buyable (frames[0] owned) and frames[3] is (frames[2] owned): the cheaper wins.
    expect(nextRung(owned, 0)?.cosmetic.id).toBe(frames[1]!.id)
  })

  it('leaves out sticker packs and rungs behind an earned gate', () => {
    const gated = COSMETICS.filter((item) => item.requires)
    expect(gated.length).toBeGreaterThan(0)
    const everythingBelow = COSMETICS.filter(
      (item) => isLadderKind(item.kind) && !item.requires,
    ).map((item) => item.id)
    expect(nextRung(everythingBelow, 1_000_000)).toBeNull()
  })

  it('draws nothing once every frame and title is owned, the gated one too', () => {
    const all = COSMETICS.filter((item) => isLadderKind(item.kind)).map((item) => item.id)
    expect(nextRung(all, 1_000_000)).toBeNull()
  })

  it('says how far, and is full once the balance covers it', () => {
    const first = nextRung([], 0)!.cosmetic
    const half = Math.floor(first.price / 2)
    expect(nextRung([], half)).toMatchObject({ left: first.price - half })
    expect(nextRung([], half)!.fraction).toBeCloseTo(half / first.price)
    expect(nextRung([], first.price + 50)).toMatchObject({ left: 0, fraction: 1 })
  })

  it('reads a negative balance as nothing saved', () => {
    const first = nextRung([], 0)!.cosmetic
    expect(nextRung([], -40)).toMatchObject({ left: first.price, fraction: 0 })
  })
})

describe('historyItems', () => {
  const day = (key: string, kinds: HistoryRow['entries']): HistoryRow => ({
    day: key,
    label: key,
    earned: 0,
    spent: 0,
    entries: kinds,
    poolShare: null,
  })

  it('heads each day and marks the ends of its block', () => {
    const items = historyItems([
      day('2026-10-19', [
        { kind: 'message', label: 'Messages', amount: 23 },
        { kind: 'gift', label: 'Hourly gift', amount: 12 },
      ]),
      day('2026-10-18', [{ kind: 'spend', label: 'Spent', amount: -200 }]),
    ])
    expect(items.map((item) => item.key)).toEqual([
      '2026-10-19',
      '2026-10-19:message',
      '2026-10-19:gift',
      '2026-10-18',
      '2026-10-18:spend',
    ])
    expect(items[1]).toMatchObject({ first: true, last: false })
    expect(items[2]).toMatchObject({ first: false, last: true })
    expect(items[4]).toMatchObject({ first: true, last: true })
  })

  it('draws no heading over a day with nothing in it', () => {
    expect(historyItems([day('2026-10-19', [])])).toEqual([])
  })
})
