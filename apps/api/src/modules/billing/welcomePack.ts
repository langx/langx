import {
  PRO_WELCOME_PACKS,
  effectivePlanTier,
  welcomePackDelta,
  type PaidPlanTier,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { isPayingStore, type HeldEntitlement } from '../referrals/settle'

/**
 * Whether this entitlement is one the welcome pack is for: Pro bought in a
 * store, or a store's free week.
 *
 * It used to be any tier but free, which also meant every grant nobody paid
 * for — a streak's week, an operator's month, a gift code, three invitees'
 * month, the v1 lifetime gift — and each of them handed over the frames, the
 * title and two streak freezes. The pack is what a subscription comes with
 * ("a head start, not a shortcut"), and a freeze is a thing tokens buy: a
 * gift of Pro that also filled the wallet's shelf was a second gift nobody
 * decided to give.
 *
 * A store's free week counts on purpose. Starting one is a purchase decision
 * with a card behind it, and the pack is not taken back when a subscription
 * ends, so a trial that is cancelled keeps it — exactly as it always has.
 * The store decides it, not `periodType`: RevenueCat labels a lifetime
 * purchase with none, and every store row here is either paid or a free week.
 */
export function earnsWelcomePack(entitlement: HeldEntitlement): boolean {
  if (effectivePlanTier(entitlement.tier, entitlement.expiresAt) === 'free') return false
  return isPayingStore(entitlement.store)
}

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
 * to be idempotent under that. Only for an entitlement `earnsWelcomePack`
 * accepts: a gift of Pro is not a subscription.
 *
 * Idempotency has two layers, and the second is the one that matters.
 * `welcomePackAt` records which tier's pack has been given, so a plain refresh
 * does nothing. But the grant itself is `$addToSet` over items the profile
 * does not already own, so even a lost latch cannot hand out a second copy —
 * the worst case is a streak freeze, which is capped separately below.
 *
 * The latch is claimed by the grant's own filter, not by the read before it.
 * The webhook and the client's refresh both arrive within a second of a
 * purchase, and two calls that each read "not given yet" both handed over
 * the pack's freezes twice.
 *
 * Lapsing and re-subscribing grants nothing, because the items are still owned. Cosmetics are **not**
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

  // Already given — under either key. `pro_plus` is Polyglot's pack from
  // before the single plan, and it is the same pack; an ex-Fluent's missing
  // items are handed over once by `scripts/merge-pro-tiers.ts`, not here.
  const given = profile.welcomePackAt
  if (given?.pro || given?.pro_plus) {
    return { granted: false, cosmetics: [] }
  }

  const cosmetics = welcomePackDelta(tier, profile.cosmetics ?? [])
  const freezes = PRO_WELCOME_PACKS[tier].streakFreezes

  const claimed = await profiles.updateOne(
    {
      _id: userId,
      'welcomePackAt.pro': { $exists: false },
      'welcomePackAt.pro_plus': { $exists: false },
    },
    {
      ...(cosmetics.length > 0 ? { $addToSet: { cosmetics: { $each: [...cosmetics] } } } : {}),
      $inc: { streakFreezes: freezes },
      $set: { [`welcomePackAt.${tier}`]: new Date() },
    },
  )
  if (claimed.modifiedCount === 0) return { granted: false, cosmetics: [] }

  return { granted: true, cosmetics }
}
