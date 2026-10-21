/**
 * Generated faces for accounts without a photo.
 *
 * The palette lives here rather than in the app's theme or the API's route
 * because both draw from it: the server renders the picture and the app draws
 * it, and a colour that drifted between them would be a face that changed
 * hue depending on who asked.
 */
export const GENERATED_AVATAR_BACKGROUNDS = ['3b6cf6', '009f70', 'f79009', 'ffc409'] as const

/** Every value a profile's `gender` can hold. */
export type AvatarGender = 'female' | 'male' | 'other' | 'undisclosed' | null

/**
 * Mild steering, and only one lever.
 *
 * Notionists' hair variants are unnamed (`variant01`…`variant63`), so there is
 * nothing to steer with there without hard-coding somebody's idea of which
 * number looks like which gender. The beard is the one option the style names
 * outright, so it is the only one taken.
 *
 * `other` and `undisclosed` get the untouched defaults on purpose: an account
 * that kept the field private must not be rendered as a third visible
 * category, which would disclose the very thing it declined to say.
 */
export function avatarOptionsFor(gender: AvatarGender): { beardProbability?: number } {
  if (gender === 'male') return { beardProbability: 60 }
  if (gender === 'female') return { beardProbability: 0 }
  return {}
}

/**
 * Where the app asks for one. Takes an account id, like the QR helpers take a
 * handle: the route generates from the id and nothing else, so a caller cannot
 * ask it to draw something it chose.
 */
export function generatedAvatarUrl(apiBaseUrl: string, seed: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/public/avatar/${encodeURIComponent(seed)}`
}

/*
 * ---------------------------------------------------------------------------
 * v3 default faces
 *
 * 144 drawn faces in three pools of 48, served as PNG by the API from parts
 * kept in `apps/api/assets/avatars`. What lives here is the arithmetic both
 * sides need: which pool a gender draws from, the hash a profile falls back on
 * before it has a stored assignment, and the short string that names one face
 * on one ground so a URL can carry it.
 * ---------------------------------------------------------------------------
 */

/** W, M and N: woman, man, and the neutral pool everybody else draws from. */
export const DEFAULT_AVATAR_POOLS = ['W', 'M', 'N'] as const
export type DefaultAvatarPool = (typeof DEFAULT_AVATAR_POOLS)[number]

/** Faces per pool, numbered 1…48 as on the master sheet. */
export const DEFAULT_AVATAR_POOL_SIZE = 48

/**
 * The six partner grounds, in hash order: tan, lime, mint, aqua, sky, lilac.
 * The same hues the v3 kit's `partnerHueFor` draws from, kept as literals
 * here because the server renders them and has no theme.
 */
export const DEFAULT_AVATAR_GROUNDS = [
  '#ff9f52',
  '#b8e15c',
  '#5fdc98',
  '#48d3d0',
  '#74b9ff',
  '#bba4ff',
] as const

/**
 * The only pixel sizes the route renders. A free size parameter would be a
 * cache of unbounded width; four steps cover 24pt at 1x up to a 160pt hero at
 * 3x, and the client rounds up to the nearest.
 */
export const DEFAULT_AVATAR_SIZES = [48, 96, 160, 480] as const
export type DefaultAvatarSize = (typeof DEFAULT_AVATAR_SIZES)[number]

/**
 * Which face a profile wears: a pool, a 1-based index into it, a ground, and
 * whether the person chose it themselves (a chosen face survives a gender
 * change; an assigned one follows it).
 */
export interface DefaultAvatar {
  pool: DefaultAvatarPool
  index: number
  ground: number
  picked?: boolean
}

/**
 * `female` → W, `male` → M, and everything else → N.
 *
 * `other`, `undisclosed`, no answer and any value this build has never heard
 * of all share one pool on purpose: if declining to say drew a different face
 * from never being asked, the picture would disclose the very thing declined.
 * Typed as `unknown` because it is called on stored data, which can hold
 * whatever an older or newer build wrote.
 */
export function poolFor(gender: unknown): DefaultAvatarPool {
  if (gender === 'female') return 'W'
  if (gender === 'male') return 'M'
  return 'N'
}

/**
 * FNV-1a, 32-bit. Not for security: an even, stable spread from an id, the
 * same in Node and Hermes, with no dependency. ObjectIds share their leading
 * timestamp bytes, so anything that only looked at a prefix would bunch up.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** The ground a profile sits on unless it was given or picked another. */
export function hashGround(id: string): number {
  return fnv1a(`ground:${id}`) % DEFAULT_AVATAR_GROUNDS.length
}

/**
 * The face a profile wears before anything was stored for it — a fresh
 * account between sign-up and its first write, a profile the backfill has not
 * reached, an id nobody holds. Pure, so every screen draws the same face.
 */
export function hashFallback(id: string, gender: unknown): DefaultAvatar {
  return {
    pool: poolFor(gender),
    index: (fnv1a(`face:${id}`) % DEFAULT_AVATAR_POOL_SIZE) + 1,
    ground: hashGround(id),
  }
}

/**
 * The face a new profile is given: the least used in its pool among recent
 * sign-ups, so a wave of people joining together do not wear the same face.
 *
 * `counts[i]` is how many recent profiles in the pool wear face `i + 1`.
 * Ties go to the face nearest after the id's own hash, so with no history at
 * all the answer is exactly the hash, and two sign-ups racing on the same
 * counts still usually differ. Returns a 1-based index.
 */
export function pickLeastUsed(counts: readonly number[], id: string): number {
  const start = (fnv1a(`face:${id}`) % DEFAULT_AVATAR_POOL_SIZE) + 1
  let best = start
  let fewest = Infinity
  for (let step = 0; step < DEFAULT_AVATAR_POOL_SIZE; step++) {
    const index = ((start - 1 + step) % DEFAULT_AVATAR_POOL_SIZE) + 1
    const count = counts[index - 1] ?? 0
    if (count < fewest) {
      fewest = count
      best = index
    }
  }
  return best
}

/**
 * Bumped when the art itself changes, so every `v=` the clients hold stops
 * matching and the immutable cache entries behind them are bypassed.
 */
export const DEFAULT_AVATAR_ART_REVISION = 1

/**
 * The URL token naming one face on one ground, e.g. `1-W07-3`: art revision,
 * pool and index, ground. Public on purpose — the face is already what every
 * viewer sees — and carried as `?v=` so a changed face is a new URL.
 */
export function defaultAvatarRev(avatar: DefaultAvatar): string {
  return `${DEFAULT_AVATAR_ART_REVISION}-${avatar.pool}${String(avatar.index).padStart(2, '0')}-${avatar.ground}`
}

const REV = /^(\d+)-([WMN])(\d\d)-(\d)$/

/** The inverse of `defaultAvatarRev`, or null for anything it did not write. */
export function parseDefaultAvatarRev(rev: string): DefaultAvatar | null {
  const match = REV.exec(rev)
  if (!match) return null
  const [, art, pool, index, ground] = match
  if (Number(art) !== DEFAULT_AVATAR_ART_REVISION) return null
  const i = Number(index)
  const g = Number(ground)
  if (i < 1 || i > DEFAULT_AVATAR_POOL_SIZE || g >= DEFAULT_AVATAR_GROUNDS.length) return null
  return { pool: pool as DefaultAvatarPool, index: i, ground: g }
}

/**
 * The three cuts of one face, chosen by the size it is *displayed* at:
 * `full` (ground texture) at 96pt and up, `flat` from 64pt, and below that
 * `small` — flat, with the figure 15% larger so the face carries the
 * shoulders' pixels. A linocut stroke at 40pt is under a point wide and reads
 * as dirt on the ground, not as a texture.
 */
export const DEFAULT_AVATAR_CUTS = ['small', 'flat', 'full'] as const
export type DefaultAvatarCut = (typeof DEFAULT_AVATAR_CUTS)[number]

export function defaultAvatarCutFor(points: number): DefaultAvatarCut {
  if (points >= 96) return 'full'
  if (points >= 64) return 'flat'
  return 'small'
}

/** The smallest rendered size that covers `points × pixelRatio`. */
export function defaultAvatarSizeFor(points: number, pixelRatio = 1): DefaultAvatarSize {
  const want = points * pixelRatio
  return DEFAULT_AVATAR_SIZES.find((size) => size >= want) ?? 480
}

/**
 * Where a v3 face is fetched from, for a face displayed at `points` on a
 * screen of `pixelRatio`. `rev` is optional: without it the server looks the
 * face up and the answer is cached for a day; with it the URL names the face
 * and is cached for good.
 */
export function defaultAvatarUrl(
  apiBaseUrl: string,
  seed: string,
  points: number,
  pixelRatio = 1,
  rev?: string | null,
): string {
  const size = defaultAvatarSizeFor(points, pixelRatio)
  const cut = defaultAvatarCutFor(points)
  const base = `${apiBaseUrl.replace(/\/$/, '')}/public/avatar/v3/${encodeURIComponent(seed)}?s=${size}&c=${cut}`
  return rev ? `${base}&v=${encodeURIComponent(rev)}` : base
}
