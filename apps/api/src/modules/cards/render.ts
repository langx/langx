import type { CardShape } from '@langx/shared'
import { Resvg } from '@resvg/resvg-js'
import satori from 'satori'
import { findAsset, loadAsset as readAsset } from '../../lib/assets'

/** What `design.ts` builds: satori's element shape, without React. */
export interface CardNode {
  type: string
  props: Record<string, unknown> & { children?: (CardNode | string)[] | CardNode | string }
}

/**
 * The pixels behind each shape.
 *
 * The names live in `packages/shared` because the client picks one; the sizes
 * live here because only the renderer needs them. Story is 9:16 for a story,
 * wide is 16:9 for a timeline, square is the one that survives both badly.
 */
export const CARD_PIXELS: Record<CardShape, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  wide: { width: 1200, height: 675 },
}

const loadAsset = (relative: string): Promise<Buffer> => readAsset(relative, 'Card asset')

interface Fonts {
  /** What satori lays the text out with. */
  faces: { name: string; data: Buffer; weight: 400 | 600 | 800 | 900; style: 'normal' }[]
  /** The same four files, by path, for resvg. */
  files: string[]
}

let fonts: Fonts | null = null

/**
 * Read once and kept: the four faces are ~590KB and every render needs them.
 *
 * Nunito has no Arabic in it, so anything Arabic — a handle, a caption, the
 * labels on the Echo chart — came out as a row of empty boxes until Noto Sans
 * Arabic was added beside it. satori picks the first font it is handed that
 * has the glyph, so the third face is a fallback rather than a choice any
 * caller makes; it shapes and joins the letters properly, which was the part
 * worth checking before shipping a 190KB file to fix two words.
 */
async function loadFonts(): Promise<Fonts> {
  if (fonts) return fonts
  const [black, extraBold, semiBold, arabic] = await Promise.all([
    findAsset('fonts/Nunito_900Black.ttf', 'Card asset'),
    findAsset('fonts/Nunito_800ExtraBold.ttf', 'Card asset'),
    findAsset('fonts/Nunito_600SemiBold.ttf', 'Card asset'),
    findAsset('fonts/NotoSansArabic_600SemiBold.ttf', 'Card asset'),
  ])
  fonts = {
    faces: [
      // The recap's numerals and month name: the poster's one heavier weight.
      { name: 'Nunito', data: black.bytes, weight: 900, style: 'normal' },
      { name: 'Nunito', data: extraBold.bytes, weight: 800, style: 'normal' },
      { name: 'Nunito', data: semiBold.bytes, weight: 600, style: 'normal' },
      { name: 'Noto Sans Arabic', data: arabic.bytes, weight: 600, style: 'normal' },
    ],
    files: [black.path, extraBold.path, semiBold.path, arabic.path],
  }
  return fonts
}

let badge: string | null = null

/** The mark, as a data URI — satori has no filesystem of its own. */
export async function loadBadge(): Promise<string> {
  if (badge) return badge
  badge = `data:image/png;base64,${(await loadAsset('badge.png')).toString('base64')}`
  return badge
}

/**
 * Turns a satori element into a PNG.
 *
 * Two libraries because there is no one-step option that is not a browser:
 * satori lays flexbox out and emits SVG, resvg rasterises it. Both are the
 * standard pair for this, and neither needs a headless Chrome on the API box.
 */
export async function renderCard(element: CardNode, shape: CardShape): Promise<Buffer> {
  const { width, height } = CARD_PIXELS[shape]
  /*
   * satori types its first parameter as React's `ReactNode`, and what it
   * actually walks is `{ type, props }` — the shape `design.ts` builds. Casting
   * here rather than adding React to the API for one type: nothing in this
   * process renders components, and a dependency carried for a signature is a
   * dependency that gets used for other things later.
   */
  const { faces, files } = await loadFonts()
  const svg = await satori(element as Parameters<typeof satori>[0], {
    width,
    height,
    fonts: faces,
  })
  const png = new Resvg(svg, {
    // `fitTo` at the card's own width is a no-op that keeps resvg from
    // guessing a size from the SVG's own units.
    fitTo: { mode: 'width', value: width },
    /*
     * Left to its default, resvg scans every system font on every render, and
     * that scan was most of the cost — about 600ms a picture on a Mac, the
     * same scan #1904 took out of the avatars. Unlike a face, a card has
     * words on it, so instead of no fonts it gets exactly the four satori
     * was handed. satori 0.62 draws glyphs as paths, so today resvg finds no
     * text to set and the PNG is byte-for-byte the same either way; the files
     * are here so that if a `<text>` ever reaches resvg it is set in Nunito
     * or Noto rather than dropped, and never in whatever the host happens to
     * have installed.
     */
    font: { loadSystemFonts: false, fontFiles: files, defaultFontFamily: 'Nunito' },
  })
    .render()
    .asPng()
  return Buffer.from(png)
}
