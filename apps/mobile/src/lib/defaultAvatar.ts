import {
  DEFAULT_AVATAR_GROUNDS,
  DEFAULT_AVATAR_POOL_SIZE,
  DEFAULT_AVATAR_POOLS,
  defaultAvatarRev,
  defaultAvatarUrl,
  generatedAvatarUrl,
  hashFallback,
  parseDefaultAvatarRev,
  type DefaultAvatar,
} from '@langx/shared'

/**
 * Where an avatar's picture comes from: the photo, else the drawn face.
 *
 * Under `flags.v3Home` the face is the v3 PNG, asked for at the nearest size
 * that covers `size × pixelRatio` and in the cut for `size` as displayed;
 * otherwise today's Notionists SVG. `rev`, when known, names the face so the
 * picture is cached for good.
 *
 * Pure, with the pixel ratio and the API base passed in, so vitest can run it
 * without react-native.
 */
export function avatarSource({
  url,
  seed,
  size,
  rev,
  v3,
  pixelRatio,
  apiBase,
  maxPixels,
}: {
  url: string | undefined
  seed: string | undefined
  size: number
  rev: string | undefined
  v3: boolean
  pixelRatio: number
  apiBase: string
  /**
   * The most pixels worth fetching, for a grid that draws many faces small:
   * 64pt at 3x would otherwise ask for 480 apiece where 160 is plenty.
   */
  maxPixels?: number | undefined
}): string | undefined {
  if (url) return url
  if (!seed) return undefined
  const ratio = maxPixels ? Math.min(pixelRatio, maxPixels / size) : pixelRatio
  return v3 ? defaultAvatarUrl(apiBase, seed, size, ratio, rev) : generatedAvatarUrl(apiBase, seed)
}

/**
 * The face the signed-in person wears: what the server stored, or — before
 * anything was stored — the same hash the server falls back on, so the Me
 * screen and everybody else's screens agree.
 */
export function ownDefaultAvatar(me: {
  _id: string
  gender: unknown
  defaultAvatar?: DefaultAvatar | undefined
}): DefaultAvatar {
  return me.defaultAvatar ?? hashFallback(me._id, me.gender)
}

/** Its `?v=` token, for `Avatar`'s `defaultAvatarRev`. */
export function ownDefaultAvatarRev(me: Parameters<typeof ownDefaultAvatar>[0]): string {
  return defaultAvatarRev(ownDefaultAvatar(me))
}

/** The same face on another ground, for a picker that shows variety. */
function onGround(pool: DefaultAvatar['pool'], index: number, ground: number): DefaultAvatar {
  return { pool, index, ground: ground % DEFAULT_AVATAR_GROUNDS.length }
}

/**
 * The onboarding picker's row: the face already worn, then `count` more from
 * the same pool. Spread through the pool rather than its neighbours (W08,
 * W09…), so the choice on offer is wide; each on its own ground, which is
 * the ground the pick will keep.
 */
export function pickerFaces(current: DefaultAvatar, count = 8): DefaultAvatar[] {
  const step = Math.floor(DEFAULT_AVATAR_POOL_SIZE / (count + 1))
  const others = Array.from({ length: count }, (_, k) => {
    const index = ((current.index - 1 + step * (k + 1)) % DEFAULT_AVATAR_POOL_SIZE) + 1
    return onGround(current.pool, index, current.ground + k + 1)
  })
  return [{ pool: current.pool, index: current.index, ground: current.ground }, ...others]
}

/**
 * Every face, pool by pool, for "See all". The person's own pool first: it
 * is the likeliest choice, and nothing about the other two is hidden.
 *
 * The face worn now is shown on the ground it is worn on, so the sheet opens
 * with it selected; every other face is spread over the grounds so the grid
 * is not one colour.
 */
export function allFaces(current: DefaultAvatar): DefaultAvatar[] {
  const pools = [current.pool, ...DEFAULT_AVATAR_POOLS.filter((pool) => pool !== current.pool)]
  return pools.flatMap((pool, p) =>
    Array.from({ length: DEFAULT_AVATAR_POOL_SIZE }, (_, i) =>
      pool === current.pool && i + 1 === current.index
        ? { pool, index: current.index, ground: current.ground }
        : onGround(pool, i + 1, i + p),
    ),
  )
}

/**
 * A face as a string that is equal whenever the face is: what a hook depends
 * on instead of the object. `ownDefaultAvatar` builds a new object on every
 * render when nothing is stored, so an effect keyed on the object would run
 * on every render — and the picker's "start from the worn face" effect would
 * keep throwing the person's selection away while the sheet is open.
 */
export function faceKey(face: DefaultAvatar): string {
  return defaultAvatarRev(face)
}

/** The face a `faceKey` names; the key is always one this module wrote. */
export function faceFromKey(key: string): DefaultAvatar {
  return parseDefaultAvatarRev(key) ?? { pool: 'N', index: 1, ground: 0 }
}

/** Same face on the same ground. */
export function sameFace(a: DefaultAvatar, b: DefaultAvatar): boolean {
  return a.pool === b.pool && a.index === b.index && a.ground === b.ground
}
