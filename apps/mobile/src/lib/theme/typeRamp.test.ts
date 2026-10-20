import { describe, expect, it } from 'vitest'
import { DISPLAY_FONT_BLACK, v3Type } from './tokens'

// Nunito's descent is about 0.35em and its digits stand about 0.71em above the
// baseline. iOS and Android keep the descent when a line box is shorter than
// the face and trim the ascent, so a box under ~1.06em cuts the top off a
// digit. The ratios below leave room for that plus accents and rounding.
const DISPLAY_RATIO = 1.15
const BLACK_RATIO = 1.12

describe('v3 type ramp', () => {
  const steps = Object.entries(v3Type) as [string, { fontSize: number; lineHeight: number }][]

  it.each(steps.filter(([, s]) => s.fontSize >= 40))(
    '%s, a display-size step, has room above its digits',
    (_name, style) => {
      expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize * DISPLAY_RATIO)
    },
  )

  it.each(
    steps.filter(([, s]) => (s as { fontFamily?: string }).fontFamily === DISPLAY_FONT_BLACK),
  )('%s, set in Nunito Black, is not clipped at the top', (_name, style) => {
    expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize * BLACK_RATIO)
  })

  it('names both display-size steps', () => {
    expect(steps.filter(([, s]) => s.fontSize >= 40).map(([n]) => n)).toEqual([
      'numeral',
      'display',
    ])
  })
})
