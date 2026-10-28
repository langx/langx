/**
 * The size a button's glyph is drawn at: its size step's own (`base`), grown
 * by `glyphScale` — the reader's text size as a row's glyphs take it
 * (`useGlyphScale`) — but never past `cap`, the button's own
 * `maxFontSizeMultiplier`, so the glyph does not outgrow the words beside
 * it. Rounded, as every glyph size is a whole point.
 *
 * Without a cap the scale is taken as it is; a scale of 1 leaves the glyph at
 * its own size, which is every button that does not ask.
 */
export function buttonGlyphSize(base: number, glyphScale: number, cap?: number): number {
  return Math.round(base * Math.min(glyphScale, cap ?? glyphScale))
}
