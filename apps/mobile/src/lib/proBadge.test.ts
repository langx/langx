import { describe, expect, it } from 'vitest'
import {
  PRO_BADGE_ART_HEIGHT,
  PRO_BADGE_MIN,
  proBadgeArt,
  proBadgeGap,
  proBadgeHeight,
  proBadgeWidth,
} from './proBadge'
import { v3Type } from './theme/tokens'

const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

/** Every x a path visits, for the absolute M V H A L Z the art is written in. */
function xs(path: string): number[] {
  const out: number[] = []
  for (const [, command, args] of path.matchAll(/([MVHALZ])([^MVHALZ]*)/g)) {
    const n = numbers(args ?? '')
    if (command === 'M' || command === 'L') out.push(n[0]!)
    if (command === 'H') out.push(n[0]!)
    // An arc's x extremes are its end and, for the O's half-ellipses, centre ± rx.
    if (command === 'A') out.push(n[5]!, n[5]! + n[0]!, n[5]! - n[0]!)
  }
  return out
}

describe('proBadgeHeight', () => {
  it('stands a little over cap height beside the profile title', () => {
    // Nunito's capitals are 0.705 em: 22.6 at the title's 32.
    expect(proBadgeHeight(v3Type.title.fontSize)).toBe(24)
    expect(proBadgeHeight(v3Type.title.fontSize)).toBeGreaterThan(v3Type.title.fontSize * 0.705)
  })

  it('fits inside the line box of every step it can stand beside', () => {
    for (const step of Object.values(v3Type)) {
      if (!('lineHeight' in step)) continue
      expect(proBadgeHeight(step.fontSize)).toBeLessThanOrEqual(step.lineHeight)
    }
  })

  it('grows with the text and never drops under the floor', () => {
    expect(proBadgeHeight(22)).toBe(17)
    expect(proBadgeHeight(17)).toBe(13)
    expect(proBadgeHeight(13)).toBe(10)
    expect(proBadgeHeight(8)).toBe(PRO_BADGE_MIN)
  })
})

describe('proBadgeGap', () => {
  it('is a quarter of the em', () => {
    expect(proBadgeGap(32)).toBe(8)
    expect(proBadgeGap(13)).toBe(3)
  })
})

/** The star's corners, which it is written as: M, then L to each, then Z. */
function corners(path: string): [number, number][] {
  const n = numbers(path)
  return n.flatMap((value, index) => (index % 2 === 0 ? [[value, n[index + 1]!]] : []))
}

describe('proBadgeArt', () => {
  it('keeps the star and the word inside the pill at both cuts', () => {
    for (const height of [10, 24]) {
      const art = proBadgeArt(height)
      const star = corners(art.star).map(([x]) => x)
      const word = xs(art.letters + art.o)
      // Every x, plus half its stroke, stays inside the pill's 1-unit inset,
      // and the two ends' padding is within a unit of each other.
      const left = Math.min(...star) - art.starRound / 2
      const right = Math.max(...word) + art.stroke / 2
      expect(left).toBeGreaterThan(1)
      expect(right).toBeLessThan(art.width - 1)
      expect(Math.abs(left - (art.width - right))).toBeLessThan(1)
      // The star ends before the word begins.
      expect(Math.max(...star) + art.starRound / 2).toBeLessThan(Math.min(...word) - art.stroke / 2)
      expect(numbers(art.star + art.letters + art.o).every(Number.isFinite)).toBe(true)
    }
  })

  it('sets the star level with the word, inside the pill', () => {
    const art = proBadgeArt(24)
    const ys = corners(art.star).map(([, y]) => y)
    const top = Math.min(...ys) - art.starRound / 2
    const bottom = Math.max(...ys) + art.starRound / 2
    expect(top).toBeGreaterThan(1)
    expect(bottom).toBeLessThan(PRO_BADGE_ART_HEIGHT - 1)
    expect((top + bottom) / 2).toBeCloseTo(PRO_BADGE_ART_HEIGHT / 2, 1)
  })

  it('thickens the strokes for the small cut, and widens to keep the spacing', () => {
    const small = proBadgeArt(10)
    const large = proBadgeArt(24)
    expect(small.stroke).toBeGreaterThan(large.stroke)
    expect(small.width).toBeGreaterThan(large.width)
  })

  it('reads as a pill with room for its star, not a strip', () => {
    const { width } = proBadgeArt(24)
    expect(width / PRO_BADGE_ART_HEIGHT).toBeGreaterThan(2)
    expect(width / PRO_BADGE_ART_HEIGHT).toBeLessThan(2.5)
  })
})

describe('proBadgeWidth', () => {
  it('scales the art to the height asked for', () => {
    const art = proBadgeArt(24)
    expect(proBadgeWidth(art, 24)).toBeCloseTo(art.width, 1)
    expect(proBadgeWidth(art, 12)).toBeCloseTo(art.width / 2, 1)
  })
})
