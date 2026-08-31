import { PRO_WELCOME_PACKS, welcomePackDelta, type PaidPlanTier } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

/**
 * Hands a new subscriber the things token buys, once.
 *
 * Deliberately **not** token. Granting token for money is the one thing every
 * public claim about this economy rules out, and it is not only a wording
 * problem: a balance is `tokenAggregates.all` minus spending, and that
 * aggregate is exactly what the all-time leaderboard ranks. There is no way to
 * credit a balance without moving somebody up a table other people are
 * climbing by writing corrections.
 *
 * Called from `refreshEntitlement`, which is the single funnel every tier
 * change passes through — both the RevenueCat webhook and the client's
 * `POST /billing/refresh` fallback — so it runs on **every** refresh and has
 * to be idempotent under that.
 *
 * Idempotency has two layers, and the second is the one that matters.
 * `welcomePackAt` records which tier's pack has been given, so a plain refresh
 * does nothing. But the grant itself is `$addToSet` over items the profile
 * does not already own, so even a lost latch cannot hand out a second copy —
 * the worst case is a streak freeze, which is capped separately below.
 *
 * Upgrading pro → pro_plus grants the difference. Lapsing and re-subscribing
 * grants nothing, because the items are still owned. Cosmetics are **not**
 * taken back when a subscription ends: revoking them would change how somebody
 * looks at the moment they stop paying, which is a support ticket rather than
 * an incentive.
 */
export async function grantWelcomePack(
  db: Db,
  userId: string,
  tier: PaidPlanTier,
): Promise<{ granted: boolean; cosmetics: readonly string[] }> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const profile = await profiles.findOne(
    { _id: userId },
    { projection: { cosmetics: 1, streakFreezes: 1, welcomePackAt: 1 } },
  )
  if (!profile) return { granted: false, cosmetics: [] }

  // Already given for this tier, or for the higher one — pro_plus first means
  // a downgrade does not re-trigger pro's pack.
  const given = profile.welcomePackAt
  if (given?.pro_plus || (given?.pro && tier === 'pro')) {
    return { granted: false, cosmetics: [] }
  }

  const cosmetics = welcomePackDelta(tier, profile.cosmetics ?? [])
  const freezes = PRO_WELCOME_PACKS[tier].streakFreezes

  await profiles.updateOne(
    { _id: userId },
    {
      ...(cosmetics.length > 0 ? { $addToSet: { cosmetics: { $each: [...cosmetics] } } } : {}),
      $inc: { streakFreezes: freezes },
      $set: { [`welcomePackAt.${tier}`]: new Date() },
    },
  )

  return { granted: true, cosmetics }
}
