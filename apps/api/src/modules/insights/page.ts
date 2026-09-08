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

let page: string | null = null

/**
 * The public stats page, read once. It is a static document that fetches
 * `/public/stats` for its numbers, so the file never has to be rendered and a
 * deploy is the only thing that changes it.
 */
export async function readInsightsPage(): Promise<string> {
  if (page !== null) return page
  for (const root of ASSET_ROOTS) {
    try {
      page = await readFile(join(root, 'insights.html'), 'utf8')
      return page
    } catch {
      continue
    }
  }
  throw new Error('Insights page not found: insights.html')
}
