import type { DefaultAvatar, DefaultAvatarCut, DefaultAvatarSize } from '@langx/shared'
import { renderAsync } from '@resvg/resvg-js'
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

/**
 * Renders in flight, by cache key. Two requests for a face that is not
 * cached yet — a chat list opening on two phones, a CDN miss fanning out —
 * share one render rather than each paying for it.
 */
const inFlight = new Map<string, Promise<Buffer>>()

/**
 * At most this many renders run at once; the rest wait their turn.
 *
 * resvg's async render runs on libuv's thread pool, which is four threads
 * shared with every file read and DNS lookup the process makes. Two leaves
 * the others free, so a burst of cold faces slows faces down and nothing
 * else — the event loop never runs a render at all.
 */
export const MAX_CONCURRENT_RENDERS = 2

/**
 * Renders allowed to queue behind the running ones. Past this the answer is
 * "busy, try again" rather than a longer queue: a queue that grows without
 * bound is a stall that has only been moved into memory, and every waiter is
 * an open request. A list of thirty cold faces fits; a flood does not.
 */
export const MAX_WAITING_RENDERS = 32

/** Thrown when the render queue is full; the route answers 503. */
export class RenderBusyError extends Error {
  constructor() {
    super('Avatar renderer is busy')
    this.name = 'RenderBusyError'
  }
}

let running = 0
const waiting: (() => void)[] = []

/**
 * Runs `work` in one of the render slots.
 *
 * A finishing render hands its slot straight to the next waiter rather than
 * freeing it: freed, the slot would sit open for the microtask between the
 * waiter being woken and it running, and a newly arrived render would take it
 * — three at once where two were meant.
 */
export async function withRenderSlot<T>(work: () => Promise<T>): Promise<T> {
  if (running < MAX_CONCURRENT_RENDERS) {
    running++
  } else {
    if (waiting.length >= MAX_WAITING_RENDERS) throw new RenderBusyError()
    // Woken holding the slot the finishing render passed on.
    await new Promise<void>((resolve) => waiting.push(resolve))
  }
  try {
    return await work()
  } finally {
    const next = waiting.shift()
    if (next) next()
    else running--
  }
}

/** For tests: how many renders are running or waiting. */
export function renderLoad(): { running: number; waiting: number; inFlight: number } {
  return { running, waiting: waiting.length, inFlight: inFlight.size }
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
  const pending = inFlight.get(key)
  if (pending) return pending

  const render = (async () => {
    const lib = await loadAvatarLibrary()
    const face = findFace(lib, avatar.pool, avatar.index)
    if (!face) throw new Error(`Unknown default avatar: ${avatar.pool}${avatar.index}`)
    const svg = composeSvg(lib, { face, ground: avatar.ground, size, cut })
    // Off the event loop: a 480px face is tens of milliseconds of rasterising,
    // and done synchronously it stalls every other request on the process.
    const rendered = await withRenderSlot(() =>
      renderAsync(svg, { fitTo: { mode: 'width', value: size } }),
    )
    const png = Buffer.from(rendered.asPng())
    remember(key, png)
    return png
  })().finally(() => inFlight.delete(key))
  inFlight.set(key, render)
  return render
}
