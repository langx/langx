import { useTheme, type PartnerHue } from '../../lib/theme'

/**
 * A product page's colour: Copilot's blue, or one of the partner hues —
 * Venus's sky, LangX Token's lime, Transparency's mint.
 *
 * Token's lime is a decision, not a default: it is the wallet's, which the
 * spark already stands on, so the page and the place it leads to look like
 * one thing; and a warm gold or orange reads as money, which the brief says
 * a token must never look like. token.langx.io and the website draw the
 * token in their own warm colours. That is theirs to change; it is not a
 * reason for this page to follow them.
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
