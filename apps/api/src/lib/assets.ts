import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * Up out of `dist/` when bundled, and up out of `src/lib` when run from
 * source. Resolved by trying each rather than by branching on `NODE_ENV`,
 * because what differs between the two is the build layout and a flag about
 * the environment is only a proxy for it.
 *
 * The Dockerfile copies `apps/api/assets` to `dist/assets`; a file only ever
 * `readFile`d at runtime is invisible to esbuild and to `pnpm deploy`, so it
 * reaches the image by that line alone.
 *
 * One copy, because there are now three readers — the insight page, the share
 * cards and the official avatars — and a probe list that drifted would fail
 * only in the build layout nobody runs locally.
 */
const ASSET_ROOTS = [
  join(HERE, '../../../assets'),
  join(HERE, '../../assets'),
  join(HERE, 'assets'),
]

export async function loadAsset(relative: string, label = 'Asset'): Promise<Buffer> {
  for (const root of ASSET_ROOTS) {
    try {
      return await readFile(join(root, relative))
    } catch {
      continue
    }
  }
  throw new Error(`${label} not found: ${relative}`)
}
