import type { DefaultAvatar, DefaultAvatarCut, DefaultAvatarSize } from '@langx/shared'
import { Resvg } from '@resvg/resvg-js'
import { composeSvg, findFace } from './compose'
import { loadAvatarLibrary } from './library'

/**
 * Rendered PNGs, least recently used first out.
 *
 * Bounded by bytes, not entries: a 480px face is ~40× a 48px one, and the
 * whole space (144 faces × 6 grounds × 4 sizes × 3 cuts) would not fit in a
 * small machine's memory at the large end. 32MB holds every face a busy day
 * asks for at the list sizes; a miss costs one resvg render, a few ms at
 * 160px, and the CDN in front of the API absorbs most repeats anyway.
 */
const CACHE_BYTES = 32 * 1024 * 1024

const cache = new Map<string, Buffer>()
let cachedBytes = 0

function remember(key: string, png: Buffer): void {
  cache.set(key, png)
  cachedBytes += png.length
  for (const [oldest, value] of cache) {
    if (cachedBytes <= CACHE_BYTES) break
    cache.delete(oldest)
    cachedBytes -= value.length
  }
}

/** For tests: empty the cache so a render can be observed. */
export function clearAvatarCache(): void {
  cache.clear()
  cachedBytes = 0
}

export interface RenderInput {
  avatar: Pick<DefaultAvatar, 'pool' | 'index' | 'ground'>
  size: DefaultAvatarSize
  cut: DefaultAvatarCut
}

/** One face as a PNG, from the cache when it has been drawn before. */
export async function renderDefaultAvatar({ avatar, size, cut }: RenderInput): Promise<Buffer> {
  const key = `${avatar.pool}${avatar.index}:${avatar.ground}:${size}:${cut}`
  const hit = cache.get(key)
  if (hit) {
    // Re-insert so Map order stays least-recently-used first.
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const lib = await loadAvatarLibrary()
  const face = findFace(lib, avatar.pool, avatar.index)
  if (!face) throw new Error(`Unknown default avatar: ${avatar.pool}${avatar.index}`)
  const svg = composeSvg(lib, { face, ground: avatar.ground, size, cut })
  const png = Buffer.from(
    new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng(),
  )
  remember(key, png)
  return png
}
