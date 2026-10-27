/**
 * The address a product page's link card prints under its name, from the URL
 * the card opens — `https://token.langx.io/tr/` reads "token.langx.io/tr".
 *
 * Derived rather than passed in beside the URL, so the address a person reads
 * is always the one they are taken to: a card that says one site and opens
 * another is exactly what a page about trust cannot have. The scheme and a
 * trailing slash are dropped because they say nothing a reader needs; the
 * path stays, because `/tr` is the reader's own language and worth seeing.
 */
export function linkAddress(url: string): string {
  return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '')
}

/**
 * How far each kind of text on a product page grows with the reader's text
 * size (`maxFontSizeMultiplier`), in one table so the order of sizes holds at
 * every setting: the product's name is never smaller than a section heading,
 * a heading never smaller than a row's title, and a row's title never smaller
 * than the sentences under it. Capped one by one, they crossed — at the
 * largest size the name stopped at 48pt while a row's title grew to 61, and
 * the page's hierarchy turned upside down.
 *
 * Each cap is also where the role's longest word still fits the narrowest
 * column it stands in on a 375pt phone, so a word wraps whole rather than
 * breaking in the middle ("milestone/s", "token.langx.i/o").
 * `productPage.test.ts` holds the order.
 */
export const PRODUCT_TEXT_SCALE = {
  /**
   * The product's name: Title, 32pt, to 48. "Transparency" is about 309pt
   * wide there, inside the 343pt column of a stacked header.
   */
  name: 1.5,
  /** A section's heading: Headline, 22pt, to 44. */
  heading: 2,
  /**
   * A row's title: Button, 17pt, to 41. "Corrections" and "milestones" still
   * fit the words column of a row whose square stands above them.
   */
  rowTitle: 2.4,
  /**
   * Everything read as a sentence — a tagline, a row's line, a question, an
   * answer, the facts: Callout, 16pt, to 32, well under a row's title. A
   * question shares its row with a chevron, and "cryptocurrency?" at 40pt
   * broke in the middle there; at 32 it is whole.
   */
  text: 2,
  /**
   * The link's address, one string with no space to wrap at:
   * "token.langx.io/pt-br" in Caption still fits the link row at 1.6×.
   */
  address: 1.6,
  /**
   * Glyphs, and the shapes that carry them — a row's square, a chevron, the
   * link's arrow, a step's disc and its number — so they grow with the words
   * they mark rather than staying specks beside them. They stop at 2×, past
   * which a chevron starts taking the words' room.
   */
  glyph: 2,
} as const
