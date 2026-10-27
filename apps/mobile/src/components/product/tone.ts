import type { ComponentType } from 'react'
import { toneWash } from '../../lib/productPage'
import { useTheme, type PartnerHue } from '../../lib/theme'

/**
 * A product page's colour: Copilot's blue, or one of the partner hues —
 * Venus's sky, LangX Token's warm hue, Transparency's green.
 *
 * Only these, so that a page cannot bring a colour of its own: the family
 * shares the palette the rest of the app is drawn in, and differs in which
 * colour it takes, its mark and its words.
 */
export type ProductTone = 'blue' | PartnerHue

/**
 * The product's own mark — the one a person already knows from the app —
 * drawn at the size and in the colour a block hands it: LangX Token's spark
 * (`TokenIcon` fits as it is), Venus's face, Copilot's tile. A picture ignores
 * `color`; a glyph takes it, so it is drawn in the page's text colour and
 * stays sharp on the field in both schemes.
 *
 * It fills the `size` square it is given. A mark that brings its own ground —
 * a tile, a disc — draws that ground at about four fifths of the square, so
 * on its page it weighs what a bare glyph weighs on another, and the four
 * heroes read as one family rather than one loud one.
 *
 * A component declared once beside the page, not an element: the hero and
 * the link card each draw it at their own size.
 */
export type ProductMark = ComponentType<{ size: number; color: string }>

/**
 * How thin the field is washed. The dark hues are a step deeper and the
 * ground under them near-black, so the light scheme's fraction there all but
 * vanishes; a little more keeps the two schemes equally quiet.
 */
const FIELD_STRENGTH = { light: 0.18, dark: 0.24 } as const

/**
 * The tone as a quiet field: the hero's ground, and the squares and discs
 * that carry the page's colour down the page.
 *
 * Never the full hue. A page about a product is read, not acted on, and a
 * block in the full colour is the loudest thing on any v3 screen; at a wash
 * the colour says whose page this is and leaves the mark to be seen first.
 * What sits on a field is the page's own `fg`, which clears it in both
 * schemes, so a page picks a tone and never a text colour.
 */
export function useToneField(tone: ProductTone): string {
  const { v3, scheme } = useTheme()
  return toneWash(tone === 'blue' ? v3.colors.blue : v3.hues[tone], FIELD_STRENGTH[scheme])
}
