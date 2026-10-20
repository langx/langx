import { COSMETIC_TONES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { frameColor, frameColors, palettes, v3, type ColorScheme } from './tokens'

const SCHEMES: ColorScheme[] = ['light', 'dark']

describe('frameColor', () => {
  it('draws every known tone in the colour it was sold as', () => {
    for (const scheme of SCHEMES) {
      for (const tone of COSMETIC_TONES) {
        expect(frameColor(scheme, tone), `${scheme} ${tone}`).toBe(frameColors[scheme][tone])
      }
    }
  })

  /**
   * The rule the art sheet set for every frame's edge. Only the six tones that
   * arrived with it are held to it here: the older ten were picked before it,
   * and several sit under 3:1 on white.
   */
  it('gives each tone added with the art 3:1 on both grounds of its scheme', () => {
    const lum = (hex: string) => {
      const [r, g, b] = (hex.slice(1).match(/../g) ?? []).map((h) => {
        const c = parseInt(h, 16) / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
    }
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
      return (hi! + 0.05) / (lo! + 0.05)
    }
    for (const scheme of SCHEMES) {
      const grounds = [
        palettes[scheme].colors.bg,
        palettes[scheme].colors.surface,
        v3[scheme].colors.bg,
        v3[scheme].colors.surface,
      ]
      for (const tone of ['blush', 'moss', 'indigo', 'plum', 'vermilion', 'walnut'] as const) {
        for (const ground of grounds) {
          const colour = frameColors[scheme][tone]
          expect(ratio(colour, ground), `${scheme} ${tone} on ${ground}`).toBeGreaterThanOrEqual(3)
        }
      }
    }
  })

  it('draws a tone this build has never heard of as a plain ink ring', () => {
    for (const scheme of SCHEMES) {
      const ink = palettes[scheme].colors.ink
      expect(frameColor(scheme, 'cobalt')).toBe(ink)
      expect(frameColor(scheme, '')).toBe(ink)
      // Names on Object.prototype are not tones either.
      expect(frameColor(scheme, 'constructor')).toBe(ink)
      expect(frameColor(scheme, 'toString')).toBe(ink)
    }
  })
})
