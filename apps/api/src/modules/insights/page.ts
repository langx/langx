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

const kept = new Map<string, Buffer>()

/** Read once and held: none of these changes between deploys. */
async function readOnce(relative: string): Promise<Buffer> {
  const already = kept.get(relative)
  if (already) return already
  const file = await loadAsset(relative)
  kept.set(relative, file)
  return file
}

/**
 * The public stats page. It is a static document that fetches `/public/stats`
 * for its numbers, so the file never has to be rendered and a deploy is the
 * only thing that changes it.
 */
export async function readInsightsPage(): Promise<string> {
  return (await readOnce('insights.html')).toString('utf8')
}

export async function readInsightsImage(name: InsightsImage): Promise<Buffer> {
  return readOnce(name)
}
