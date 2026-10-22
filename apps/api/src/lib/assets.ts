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
  return (await findAsset(relative, label)).bytes
}

/**
 * The bytes and the path they were read from. The path is for a library that
 * takes files rather than buffers — resvg's native binding loads fonts only
 * by path — so it gets the same file the bytes came from, not a second probe.
 */
export async function findAsset(
  relative: string,
  label = 'Asset',
): Promise<{ path: string; bytes: Buffer }> {
  for (const root of ASSET_ROOTS) {
    const path = join(root, relative)
    try {
      return { path, bytes: await readFile(path) }
    } catch {
      continue
    }
  }
  throw new Error(`${label} not found: ${relative}`)
}
