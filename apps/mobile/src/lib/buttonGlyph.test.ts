import { describe, expect, it } from 'vitest'
import { buttonGlyphSize } from './buttonGlyph'
import { PRODUCT_TEXT_SCALE } from './productPage'
import { v3Icon } from './theme/tokens'

describe('buttonGlyphSize', () => {
  it('leaves the glyph at its own size when nothing grows it', () => {
    expect(buttonGlyphSize(v3Icon.md, 1)).toBe(v3Icon.md)
    expect(buttonGlyphSize(v3Icon.md, 1, PRODUCT_TEXT_SCALE.text)).toBe(v3Icon.md)
  })

  it('grows it with the reader’s text size, to a whole point', () => {
    expect(buttonGlyphSize(v3Icon.md, 1.3, PRODUCT_TEXT_SCALE.text)).toBe(26)
    expect(buttonGlyphSize(v3Icon.sm, 1.35)).toBe(Math.round(v3Icon.sm * 1.35))
  })

  it('never grows it past the words’ own cap', () => {
    // The Pro card's and the invite's pills cap their words at `text`; a
    // glyph scale above that would leave the glyph larger than its label.
    const cap = PRODUCT_TEXT_SCALE.text
    expect(buttonGlyphSize(v3Icon.md, cap + 1, cap)).toBe(Math.round(v3Icon.md * cap))
  })

  it('takes the scale as it is when the button has no cap', () => {
    expect(buttonGlyphSize(v3Icon.lg, 3)).toBe(v3Icon.lg * 3)
  })
})
