/**
 * PROTOTYPE ONLY (branch proto/entrance-and-reward-toast) — never merge.
 *
 * Which variant the prototype draws, from the page's query string on the web
 * build (`?entrance=rise&reward=toast`), remembered in localStorage so a
 * client-side navigation or a reload keeps it.
 */
export type EntranceVariant = 'none' | 'rise' | 'spring'
export type RewardVariant = 'chip' | 'toast' | 'both'

function read(name: string): string | null {
  try {
    const fromUrl = new URLSearchParams(globalThis.location?.search ?? '').get(name)
    if (fromUrl) {
      globalThis.localStorage?.setItem(`proto.${name}`, fromUrl)
      return fromUrl
    }
    return globalThis.localStorage?.getItem(`proto.${name}`) ?? null
  } catch {
    return null
  }
}

export function entranceVariant(): EntranceVariant {
  const value = read('entrance')
  return value === 'rise' || value === 'spring' ? value : 'none'
}

export function rewardVariant(): RewardVariant {
  const value = read('reward')
  return value === 'toast' || value === 'both' ? value : 'chip'
}

/** Synchronous on the web, so the very first frame already knows. */
export function prefersReducedMotionNow(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    return false
  }
}
