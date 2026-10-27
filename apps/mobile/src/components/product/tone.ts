import type { ReactNode } from 'react'
import { useTheme, type PartnerHue } from '../../lib/theme'

/**
 * A product page's colour: Copilot's blue, or one of the partner hues —
 * Venus's sky, LangX Token's lime (the wallet's own), Transparency's green.
 *
 * Only these, so that a page cannot bring a colour of its own: the family
 * shares the palette the rest of the app is drawn in, and differs in which
 * colour it takes, its mark and its words.
 */
export type ProductTone = 'blue' | PartnerHue

/**
 * The tone as a ground, and what is drawn on it — white on the blue, ink on a
 * hue in both schemes, as `HeroTile` does. A caller picks the tone and never
 * a text colour, so nothing on a product page can land unreadable on its own
 * colour.
 */
export function useToneColors(tone: ProductTone): { ground: string; on: string } {
  const { v3 } = useTheme()
  return tone === 'blue'
    ? { ground: v3.colors.blue, on: v3.colors.onBlue }
    : { ground: v3.hues[tone], on: v3.colors.ink }
}

/**
 * A drawing the family places and sizes: a product's mark (`PRODUCT_MARKS`),
 * or the app's own picture of a thing on a tile — the streak freeze's
 * six-armed mark (`FreezeGlyph`).
 *
 * A function rather than an element, so the family decides the size and the
 * colour — big in the hero, small in the link out, always in the tone's own
 * text colour — and a page cannot draw it too small or unreadable. A picture
 * (Venus) takes the size and ignores the colour.
 */
export type ProductArt = (look: { size: number; color: string }) => ReactNode
