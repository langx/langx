import { COSMETIC_TONES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { frameColor, frameColors, palettes, type ColorScheme } from './tokens'

const SCHEMES: ColorScheme[] = ['light', 'dark']

describe('frameColor', () => {
  it('draws every known tone in the colour it was sold as', () => {
    for (const scheme of SCHEMES) {
      for (const tone of COSMETIC_TONES) {
        expect(frameColor(scheme, tone), `${scheme} ${tone}`).toBe(frameColors[scheme][tone])
      }
    }
  })

  it('draws a tone this build has never heard of as a plain ink ring', () => {
    for (const scheme of SCHEMES) {
      const ink = palettes[scheme].colors.ink
      expect(frameColor(scheme, 'indigo')).toBe(ink)
      expect(frameColor(scheme, '')).toBe(ink)
      // Names on Object.prototype are not tones either.
      expect(frameColor(scheme, 'constructor')).toBe(ink)
      expect(frameColor(scheme, 'toString')).toBe(ink)
    }
  })
})
