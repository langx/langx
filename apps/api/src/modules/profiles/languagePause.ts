import {
  effectivePlanTier,
  nextGiftLanguages,
  pausedLanguageCodes,
  type PlanTier,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { effectiveTier } from './entitlement'
import type { Profile } from './profiles'

/**
 * Languages added during a gift of Pro, and paused for matching once it ends.
 *
 * Pro allows five languages a side and the free plan one. The cap is checked
 * on the way in only (`languageCapAllows`), and discovery used to match on
 * whatever was stored — so a gift of Pro could leave somebody matched on five
 * languages for good, which is the thing Pro sells. Now a language added while
 * the Pro was a gift is marked (`giftLanguages`), and once the plan is free
 * again the marked ones beyond the free allowance stop counting for matching
 * (`pausedLanguages`). They stay on the profile; they count again with Pro.
 *
 * `pausedLanguages` is stored rather than worked out per query because
 * discovery has to ask it of every *candidate*, in the query itself — see
 * `unpausedFit` in `discovery.ts`. It is written at the two moments it can
 * change: a language edit (`updateProfile`) and an entitlement write
 * (`refreshEntitlement`, which every gift's end passes through).
 */

/** Pro that is a gift right now: a dated grant, not a store purchase or a lifetime. */
export function heldOnGift(entitlement: Profile['entitlement'] | undefined): boolean {
  if (!entitlement || entitlement.store?.toLowerCase() !== 'gift') return false
  return effectivePlanTier(entitlement.tier, entitlement.expiresAt) !== 'free'
}

/** The `$set` and `$unset` paths that keep both markers right after a language write. */
export function languagePausePaths(
  current: Pick<Profile, 'nativeLanguages' | 'learning' | 'giftLanguages' | 'entitlement'>,
  next: Pick<Profile, 'nativeLanguages' | 'learning'>,
  tier: PlanTier,
): { set: Partial<Pick<Profile, 'giftLanguages' | 'pausedLanguages'>>; unset: Record<string, ''> } {
  const giftLanguages = nextGiftLanguages(current, next, heldOnGift(current.entitlement))
  const pausedLanguages = pausedLanguageCodes({ ...next, giftLanguages }, tier)
  const set: Partial<Pick<Profile, 'giftLanguages' | 'pausedLanguages'>> = {}
  const unset: Record<string, ''> = {}
  if (giftLanguages.length > 0) set.giftLanguages = giftLanguages
  else unset.giftLanguages = ''
  if (pausedLanguages.length > 0) set.pausedLanguages = pausedLanguages
  else unset.pausedLanguages = ''
  return { set, unset }
}

/**
 * Whether the free plan pauses any of this person's languages — asked by a
 * gift's reminders and its goodbye, so the pause is said before it happens
 * and when it does, rather than found as a quieter Discover. Installed builds
 * draw a paused language like any other, so these notes are the one place
 * every build hears of it.
 */
export async function languagesPauseOnFree(db: Db, userId: string): Promise<boolean> {
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne(
      { _id: userId, 'giftLanguages.0': { $exists: true } },
      { projection: { nativeLanguages: 1, learning: 1, giftLanguages: 1 } },
    )
  return profile !== null && pausedLanguageCodes(profile, 'free').length > 0
}

/**
 * Brings `pausedLanguages` in line with the plan held now. Run after every
 * entitlement write, so a gift that ends pauses its languages and a purchase
 * that follows brings them back. A no-op for everybody without gift languages,
 * which is nearly everybody, and it writes only when the answer changed.
 */
export async function reconcilePausedLanguages(db: Db, userId: string): Promise<void> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const profile = await profiles.findOne(
    { _id: userId },
    {
      projection: {
        nativeLanguages: 1,
        learning: 1,
        giftLanguages: 1,
        pausedLanguages: 1,
        entitlement: 1,
      },
    },
  )
  if (!profile?.giftLanguages?.length && !profile?.pausedLanguages?.length) return
  const paused = pausedLanguageCodes(profile, effectiveTier(profile))
  const stored = profile.pausedLanguages ?? []
  if (paused.length === stored.length && paused.every((code, i) => stored[i] === code)) return
  await profiles.updateOne(
    { _id: userId },
    paused.length > 0 ? { $set: { pausedLanguages: paused } } : { $unset: { pausedLanguages: '' } },
  )
}
