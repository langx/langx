import { loadAsset as readAsset } from '../../lib/assets'

/**
 * The images the page draws, and the only names its route will serve.
 *
 * All three are downscales of `langx/branding`'s masters, which are 1024px
 * tall and about 145KB each — the right size for a store listing and the wrong
 * one for a logo drawn 30 pixels high. `docs/insight.md` records where they
 * came from, because a resized copy is the kind of file somebody later mistakes
 * for the original.
 */
export const INSIGHT_IMAGES = ['lockup.png', 'lockup-dark.png', 'icon.png'] as const
export type InsightImage = (typeof INSIGHT_IMAGES)[number]

const loadAsset = (relative: string): Promise<Buffer> => readAsset(relative, 'Insight asset')

let page: string | null = null

/**
 * The public stats page. It is a static document that fetches `/public/stats`
 * for its numbers, so the file never has to be rendered and a deploy is the
 * only thing that changes it — read once and held.
 */
export async function readInsightPage(): Promise<string> {
  if (page === null) page = (await loadAsset('insight.html')).toString('utf8')
  return page
}

let images: Map<InsightImage, Buffer> | null = null

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
async function loadImages(): Promise<Map<InsightImage, Buffer>> {
  if (images) return images
  const loaded = new Map<InsightImage, Buffer>()
  for (const name of INSIGHT_IMAGES) {
    loaded.set(name, await loadAsset(name))
  }
  images = loaded
  return loaded
}

export async function readInsightImage(name: InsightImage): Promise<Buffer> {
  const image = (await loadImages()).get(name)
  if (!image) throw new Error(`Insight asset not found: ${name}`)
  return image
}
