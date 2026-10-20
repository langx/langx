import { COSMETICS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { PARTNER_HUES, v3, type ColorScheme } from './theme/tokens'
import { TITLE_ART, titleArtKey, type TitleKey } from './titleArt'

function luminance(hex: string): number {
  expect(hex).toMatch(/^#[0-9a-f]{6}$/i)
  const channel = (at: number): number => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const SCHEMES: ColorScheme[] = ['light', 'dark']
const KEYS = Object.keys(TITLE_ART) as TitleKey[]

/**
 * Where a badge is drawn: the profile's ground, the grey block, and the
 * partner hues behind the thread band and v3 Me's hero.
 */
function grounds(scheme: ColorScheme): string[] {
  const { colors, hues } = v3[scheme]
  return [colors.bg, colors.surface, ...PARTNER_HUES.map((hue) => hues[hue])]
}

describe('title badge art', () => {
  it('draws every title the catalogue sells', () => {
    const titles = COSMETICS.filter((c) => c.kind === 'title')
    expect(titles).toHaveLength(10)
    for (const title of titles) expect(titleArtKey(title.id), title.id).toBeDefined()
  })

  it('finds no art for an id it has never heard of', () => {
    expect(titleArtKey('title.unheard')).toBeUndefined()
    expect(titleArtKey('frame.gold')).toBeUndefined()
  })

  // Small capitals at 11–13 pt are body text, so 4.5:1, not the large-text 3.
  it.each(KEYS)('sets %s in a colour that reads on its ground', (key) => {
    const art = TITLE_ART[key]
    const ground = art.plaque?.fill ?? art.fill
    expect(contrast(art.text, ground)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(KEYS)('keeps the outline of %s at 3:1 on every ground', (key) => {
    const art = TITLE_ART[key]
    SCHEMES.forEach((scheme, i) => {
      for (const ground of grounds(scheme)) {
        const best = Math.max(contrast(art.fill, ground), contrast(art.edge[i]!, ground))
        expect(best, `${key} on ${ground} (${scheme})`).toBeGreaterThanOrEqual(3)
      }
    })
  })
})
