import { BADGE_KINDS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { BADGE_MARKS } from './badgeMark'
import { palettes } from './theme/tokens'

/** WCAG 2.1 relative luminance, sRGB. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0)
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/**
 * A glyph on its own fill has to be legible in **both** schemes.
 *
 * WCAG 1.4.11 asks 3:1 of a graphical object that carries meaning, and this
 * mark is the only thing distinguishing one badge family from another.
 *
 * The test exists because of a real failure rather than a rule: the v1 badge
 * shipped as a yellow glyph on an `ink` fill, which is 11:1 in light and
 * **1.44:1** in dark, because `ink` inverts with the ground and the yellow
 * does not. It looked right in every screenshot anybody took. Nothing else
 * would have caught it — the colours are valid tokens, the types are fine, and
 * the component renders.
 */
describe('badge marks', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`stays legible in ${scheme}`, () => {
      const { colors } = palettes[scheme]
      for (const kind of BADGE_KINDS) {
        const mark = BADGE_MARKS[kind](colors)
        const ratio = contrast(mark.fill, mark.glyph)
        expect(ratio, `${kind} ${mark.glyph} on ${mark.fill}`).toBeGreaterThanOrEqual(3)
      }
    })
  }

  /**
   * Two kinds may share a family — the glyph is what tells them apart — but a
   * family that swallowed everything would leave the screen one colour, which
   * is what this change set out to fix.
   */
  it('spends more than one family', () => {
    const { colors } = palettes.light
    const fills = new Set(BADGE_KINDS.map((kind) => BADGE_MARKS[kind](colors).fill))
    expect(fills.size).toBeGreaterThanOrEqual(4)
  })
})
