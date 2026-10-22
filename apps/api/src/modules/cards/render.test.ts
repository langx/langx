import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/*
 * resvg scans every system font on each render unless told not to, and on a
 * Mac that scan was most of a card's raster step. A card has text, so it
 * cannot go without fonts the way an avatar does (#1904); it gets the four
 * bundled files instead.
 *
 * Structural, so it holds on any machine: the scan only costs much where the
 * system has many fonts to scan, so a timing test would pass on a bare CI
 * runner with the scan still on.
 */
describe('renderCard', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'render.ts'), 'utf8')
  const call = /new Resvg\(svg, \{[\s\S]*?\n {2}\}\)/.exec(source)?.[0] ?? ''

  it('tells resvg not to scan system fonts', () => {
    expect(call, 'the new Resvg call in render.ts').toMatch(/loadSystemFonts: false/)
  })

  it('hands resvg the bundled font files instead', () => {
    expect(call, 'the new Resvg call in render.ts').toMatch(/fontFiles: files/)
    // Every face satori gets, by path — an empty or shortened list would
    // leave resvg with nothing or less to set a stray <text> in.
    expect(source).toContain('files: [black.path, extraBold.path, semiBold.path, arabic.path]')
    for (const file of [
      'Nunito_900Black.ttf',
      'Nunito_800ExtraBold.ttf',
      'Nunito_600SemiBold.ttf',
      'NotoSansArabic_600SemiBold.ttf',
    ]) {
      expect(source, file).toContain(`'fonts/${file}'`)
    }
  })
})
