import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
/**
 * Up out of `dist/` when bundled, and up out of `src/modules/insights` when
 * run from source — the same probe `modules/cards/render.ts` uses, and for the
 * same reason: what differs between the two is the build layout, not the
 * environment. The Dockerfile copies `apps/api/assets` to `dist/assets`; a
 * file only ever `readFile`d at runtime is invisible to esbuild and to
 * `pnpm deploy`, so it reaches the image by that line alone.
 */
const ASSET_ROOTS = [
  join(HERE, '../../../assets'),
  join(HERE, '../../assets'),
  join(HERE, 'assets'),
]

/**
 * The images the page draws, and the only names its route will serve.
 *
 * All three are downscales of `langx/branding`'s masters, which are 1024px
 * tall and about 145KB each — the right size for a store listing and the wrong
 * one for a logo drawn 30 pixels high. `docs/insights.md` records where they
 * came from, because a resized copy is the kind of file somebody later mistakes
 * for the original.
 */
export const INSIGHTS_IMAGES = ['lockup.png', 'lockup-dark.png', 'icon.png'] as const
export type InsightsImage = (typeof INSIGHTS_IMAGES)[number]

async function loadAsset(relative: string): Promise<Buffer> {
  for (const root of ASSET_ROOTS) {
    try {
      return await readFile(join(root, relative))
    } catch {
      continue
    }
  }
  throw new Error(`Insights asset not found: ${relative}`)
}

let page: string | null = null

/**
 * The public stats page. It is a static document that fetches `/public/stats`
 * for its numbers, so the file never has to be rendered and a deploy is the
 * only thing that changes it — read once and held.
 */
export async function readInsightsPage(): Promise<string> {
  if (page === null) page = (await loadAsset('insights.html')).toString('utf8')
  return page
}

let images: Map<InsightsImage, Buffer> | null = null

/**
 * All three images, read together the first time any one of them is asked for.
 *
 * Together rather than on demand, and that is the load-bearing part: the only
 * strings that ever reach the filesystem are the constants above, walked in a
 * loop, so a name arriving from a request selects a buffer already in memory
 * and never becomes part of a path. The route validates that name against this
 * same list, which is enough to be safe and not enough to be *obviously* safe
 * — CodeQL read the earlier version, which passed the request's own string to
 * `readFile`, as a path injection and was right to. Reading all three costs
 * nothing worth weighing: they are about 18KB, and a page load asks for two.
 */
async function loadImages(): Promise<Map<InsightsImage, Buffer>> {
  if (images) return images
  const loaded = new Map<InsightsImage, Buffer>()
  for (const name of INSIGHTS_IMAGES) {
    loaded.set(name, await loadAsset(name))
  }
  images = loaded
  return loaded
}

export async function readInsightsImage(name: InsightsImage): Promise<Buffer> {
  const image = (await loadImages()).get(name)
  if (!image) throw new Error(`Insights asset not found: ${name}`)
  return image
}
