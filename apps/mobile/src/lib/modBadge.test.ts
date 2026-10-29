import { describe, expect, it } from 'vitest'
import { modBadgeArt } from './modBadge'
import { PRO_BADGE_ART_HEIGHT, proBadgeArt } from './proBadge'

const numbers = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)

/** Every x a path visits, for the absolute M V H A L Z the word is written in. */
function xs(path: string): number[] {
  const out: number[] = []
  for (const [, command, args] of path.matchAll(/([MVHALZ])([^MVHALZ]*)/g)) {
    const n = numbers(args ?? '')
    if (command === 'M' || command === 'L') out.push(n[0]!)
    if (command === 'H') out.push(n[0]!)
    // An arc's x extremes are its end and, for the D's and O's bowls, end ± rx.
    if (command === 'A') out.push(n[5]!, n[5]! + n[0]!, n[5]! - n[0]!)
  }
  return out
}

/** The shield's points, which it is written as: every number an x then a y. */
function points(path: string): [number, number][] {
  const n = numbers(path)
  return n.flatMap((value, index) => (index % 2 === 0 ? [[value, n[index + 1]!]] : []))
}

describe('modBadgeArt', () => {
  it('keeps the shield and the word inside the pill at both cuts', () => {
    for (const height of [10, 24]) {
      const art = modBadgeArt(height)
      const shield = points(art.shield).map(([x]) => x)
      const word = xs(art.letters + art.o)
      const left = Math.min(...shield) - art.shieldRound / 2
      const right = Math.max(...word) + art.stroke / 2
      expect(left).toBeGreaterThan(1)
      expect(right).toBeLessThan(art.width - 1)
      expect(Math.abs(left - (art.width - right))).toBeLessThan(1)
      // The shield ends before the word begins.
      expect(Math.max(...shield) + art.shieldRound / 2).toBeLessThan(
        Math.min(...word) - art.stroke / 2,
      )
      expect(numbers(art.shield + art.letters + art.o).every(Number.isFinite)).toBe(true)
    }
  })

  it('centres the shield on the pill, inside it', () => {
    const art = modBadgeArt(24)
    const ys = points(art.shield).map(([, y]) => y)
    const top = Math.min(...ys) - art.shieldRound / 2
    const bottom = Math.max(...ys) + art.shieldRound / 2
    expect(top).toBeGreaterThan(1)
    expect(bottom).toBeLessThan(PRO_BADGE_ART_HEIGHT - 1)
    expect((top + bottom) / 2).toBeCloseTo(PRO_BADGE_ART_HEIGHT / 2, 1)
  })

  it("draws its word with PRO's strokes, so the two read as a set", () => {
    for (const height of [10, 24]) {
      expect(modBadgeArt(height).stroke).toBe(proBadgeArt(height).stroke)
    }
    // Within a few units of PRO's width: a sibling, not a strip beside it.
    expect(Math.abs(modBadgeArt(24).width - proBadgeArt(24).width)).toBeLessThan(4)
  })
})
