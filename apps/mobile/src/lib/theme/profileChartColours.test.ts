import { describe, expect, it } from 'vitest'
import { PARTNER_HUES, v3, type ColorScheme } from './tokens'

/**
 * The profile's two charts draw in the person's own hue, which is any of six,
 * so whatever sits beside that hue has to stay tellable from all of them in
 * both schemes. Measured, because the failure looks fine on the one hue a
 * screenshot happened to land on: v3's correction green beside the mint and
 * aqua hues after dark is one green next to another.
 *
 * CIE76 ΔE in Lab — the distance between two colours as an eye reads it,
 * which a contrast ratio is not (a white and a lime can share a luminance
 * and still never be mistaken for each other).
 *
 * - `WeeklyChartV3`: messages in the hue, corrections in `fg`.
 * - `ActivityMapV3`: busy days a solid hue, quiet days a hue outline around
 *   the card's own colour, empty days `track` — so a quiet day differs from
 *   an empty one by its ring, which has to read against the card.
 */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((u) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ]
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a)
  const [l2, a2, b2] = lab(b)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

/** Clearly two colours at a glance; the old pairing measured well under it. */
const DISTINCT = 40

/**
 * Two filled squares side by side: a saturated hue against a neutral grey is
 * told apart by its colour alone, so the bar is lower than for two hues. The
 * closest pair, light aqua on the track, sits just above it.
 */
const DISTINCT_FILL = 35

const SCHEMES: ColorScheme[] = ['light', 'dark']

describe('the profile charts stay readable on every partner hue', () => {
  for (const scheme of SCHEMES) {
    const { colors, hues } = v3[scheme]
    for (const hue of PARTNER_HUES) {
      it(`${scheme} ${hue}: corrections (fg) differ from messages (hue)`, () => {
        expect(deltaE(colors.fg, hues[hue])).toBeGreaterThanOrEqual(DISTINCT)
      })
      it(`${scheme} ${hue}: a quiet day's hue ring reads on the card`, () => {
        expect(deltaE(hues[hue], colors.surface)).toBeGreaterThanOrEqual(DISTINCT)
      })
      it(`${scheme} ${hue}: a busy day differs from an empty one`, () => {
        expect(deltaE(hues[hue], colors.track)).toBeGreaterThanOrEqual(DISTINCT_FILL)
      })
    }
  }

  it('the colour it replaced really was the problem', () => {
    // Keeps the measure honest: if this ever passes, the threshold is too low.
    expect(deltaE(v3.dark.colors.correction, v3.dark.hues.mint)).toBeLessThan(DISTINCT)
  })
})
