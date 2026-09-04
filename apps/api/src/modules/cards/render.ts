import type { CardShape } from '@langx/shared'
import { Resvg } from '@resvg/resvg-js'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import satori from 'satori'

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

const HERE = dirname(fileURLToPath(import.meta.url))
/**
 * Up out of `dist/` when bundled, and up out of `src/modules/cards` when run
 * from source. Resolved by trying both rather than by branching on
 * `NODE_ENV`, because the thing that differs is the build layout and a flag
 * about the environment is only a proxy for it.
 */
const ASSET_ROOTS = [
  join(HERE, '../../../assets'),
  join(HERE, '../../assets'),
  join(HERE, 'assets'),
]

async function loadAsset(relative: string): Promise<Buffer> {
  for (const root of ASSET_ROOTS) {
    try {
      return await readFile(join(root, relative))
    } catch {
      continue
    }
  }
  throw new Error(`Card asset not found: ${relative}`)
}

let fonts: { name: string; data: Buffer; weight: 400 | 600 | 800; style: 'normal' }[] | null = null

/** Read once and kept: the two faces are ~260KB and every card needs both. */
async function loadFonts(): Promise<NonNullable<typeof fonts>> {
  if (fonts) return fonts
  const [extraBold, semiBold] = await Promise.all([
    loadAsset('fonts/Nunito_800ExtraBold.ttf'),
    loadAsset('fonts/Nunito_600SemiBold.ttf'),
  ])
  fonts = [
    { name: 'Nunito', data: extraBold, weight: 800, style: 'normal' },
    { name: 'Nunito', data: semiBold, weight: 600, style: 'normal' },
  ]
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
  const svg = await satori(element as Parameters<typeof satori>[0], {
    width,
    height,
    fonts: await loadFonts(),
  })
  // `fitTo` at the card's own width is a no-op that keeps resvg from guessing
  // a size from the SVG's own units.
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()
  return Buffer.from(png)
}
