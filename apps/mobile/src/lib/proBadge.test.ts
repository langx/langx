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

describe('proBadgeArt', () => {
  it('keeps the word inside the tablet at both cuts', () => {
    for (const height of [10, 24]) {
      const art = proBadgeArt(height)
      const all = xs(art.letters + art.o)
      // Every x, plus half a stroke, stays inside the tablet's 1-unit inset,
      // with the same padding left and right.
      const left = Math.min(...all) - art.stroke / 2
      const right = Math.max(...all) + art.stroke / 2
      expect(left).toBeGreaterThan(1)
      expect(right).toBeLessThan(art.width - 1)
      expect(left).toBeCloseTo(art.width - right, 0)
      expect(numbers(art.letters + art.o).every(Number.isFinite)).toBe(true)
    }
  })

  it('thickens the strokes for the small cut, and widens to keep the spacing', () => {
    const small = proBadgeArt(10)
    const large = proBadgeArt(24)
    expect(small.stroke).toBeGreaterThan(large.stroke)
    expect(small.width).toBeGreaterThan(large.width)
  })

  it('reads as a tablet, not a square or a strip', () => {
    const { width } = proBadgeArt(24)
    expect(width / PRO_BADGE_ART_HEIGHT).toBeGreaterThan(1.3)
    expect(width / PRO_BADGE_ART_HEIGHT).toBeLessThan(1.8)
  })
})

describe('proBadgeWidth', () => {
  it('scales the art to the height asked for', () => {
    const art = proBadgeArt(24)
    expect(proBadgeWidth(art, 24)).toBeCloseTo(art.width, 1)
    expect(proBadgeWidth(art, 12)).toBeCloseTo(art.width / 2, 1)
  })
})
