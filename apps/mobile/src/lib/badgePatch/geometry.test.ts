import { BADGES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { cutFor, PATCH_IDS, patchNodes, patchTier, type PatchCut } from './geometry'
import { arcToCubics, outlineLength, withoutArcs } from './pathData'

const CUTS: readonly PatchCut[] = ['full', 's40', 's24']

describe('badge patch art', () => {
  it('draws every badge in the catalogue', () => {
    for (const badge of BADGES) expect(PATCH_IDS, badge.id).toContain(badge.id)
  })

  /**
   * The rule the module exists to keep: `expo-image` on iOS draws arcs from a
   * bundled SVG wrongly, so no node may carry one, whichever renderer ends up
   * drawing it.
   */
  it('writes no arc command in any cut or state', () => {
    for (const id of [...PATCH_IDS, 'nobody.knows']) {
      for (const cut of CUTS) {
        for (const state of [
          { kind: 'earned' } as const,
          { kind: 'locked' } as const,
          { kind: 'next', progress: 0.4 } as const,
        ]) {
          for (const node of patchNodes(id, cut, state, 'light')) {
            expect(node.d, `${id} ${cut} ${state.kind}`).not.toMatch(/[Aa]/)
          }
        }
      }
    }
  })

  /** "40: at most six shapes. 24: silhouette, tier ring, one accent." */
  it('keeps the small cuts small', () => {
    for (const id of PATCH_IDS) {
      expect(patchNodes(id, 's40', { kind: 'earned' }, 'light').length, id).toBeLessThanOrEqual(7)
      expect(patchNodes(id, 's24', { kind: 'earned' }, 'light').length, id).toBeLessThanOrEqual(3)
    }
  })

  it('draws an empty hoop for an id it does not know', () => {
    expect(patchNodes('future.1', 'full', { kind: 'earned' }, 'light').length).toBeGreaterThan(0)
    expect(patchTier('future.1')).toBeNull()
  })

  it('stitches the border only as far as the progress goes', () => {
    const none = patchNodes('streak.30', 'full', { kind: 'next', progress: 0 }, 'light')
    const some = patchNodes('streak.30', 'full', { kind: 'next', progress: 0.5 }, 'light')
    expect(some.length).toBeGreaterThan(none.length)
    const band = some.find((node) => node.dash && node.stroke === '#ff9f52')
    const [drawn, gap] = (band?.dash ?? '').split(' ').map(Number)
    expect(drawn! / (gap! - 10)).toBeCloseTo(0.5, 1)
  })

  it('takes the cut from the drawn size', () => {
    expect(cutFor(96)).toBe('full')
    expect(cutFor(64)).toBe('full')
    expect(cutFor(40)).toBe('s40')
    expect(cutFor(24)).toBe('s24')
  })

  it('names the thread of every rung, ending each ladder on bullion', () => {
    expect(patchTier('streak.7')).toBe('cotton')
    expect(patchTier('streak.1095')).toBe('bullion')
    expect(patchTier('veteran.365')).toBe('satin')
    expect(patchTier('origin.v1')).toBe('woven')
  })
})

describe('arcs as cubics', () => {
  it('turns a circle into curves the length of a circle', () => {
    const circle = 'M5 32A27 27 0 1 0 59 32A27 27 0 1 0 5 32Z'
    expect(withoutArcs(circle)).not.toMatch(/A/)
    expect(outlineLength(circle)).toBeCloseTo(2 * Math.PI * 27, 0)
  })

  it('measures a straight-sided outline, H and V included', () => {
    // The banner: 40 across, 50 down each side, two 22.36 diagonals.
    expect(outlineLength('M12 7H52V57L32 47L12 57Z')).toBeCloseTo(
      40 + 50 + 50 + 2 * Math.hypot(20, 10),
      1,
    )
  })

  it('ends each arc exactly where the arc ended', () => {
    const curves = arcToCubics([0, 10], 10, 10, 0, false, true, [10, 0])
    expect(curves.at(-1)?.slice(4)).toEqual([10, 0])
  })

  it('tracks the pen through relative commands', () => {
    const d = 'M14 13h12a4 4 0 0 1 4 4v6'
    expect(withoutArcs(d)).toMatch(/^M14 13L26 13C[\d. ]+ 30 17L30 23$/)
  })
})
