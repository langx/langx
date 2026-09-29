import {
  effectivePlanTier,
  normalizePlanTier,
  type BillingPeriodType,
  type ProGiftSource,
  type ProWelcomeSource,
  type StoredPlanTier,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import type { ProGift } from './proGifts'

/**
 * A "You're Pro now" screen waiting to be seen: when the edge happened, why,
 * and — for a grant of a fixed length — how many months it was.
 */
export interface ProWelcome {
  at: Date
  source: ProWelcomeSource
  months?: number
}

/** What a caller says about a welcome; `at` is the moment it is written. */
export type ProWelcomeDetails = Pick<ProWelcome, 'source' | 'months'>

/** The parts of a stored or about-to-be-stored entitlement the edge reads. */
export interface EntitlementForEdge {
  tier: StoredPlanTier
  expiresAt?: Date | null | undefined
  willRenew?: boolean | undefined
  store?: string | null | undefined
  periodType?: BillingPeriodType | null | undefined
}

/**
 * How long after its end a subscription that was due to renew still counts as
 * the same subscription when it comes back.
 *
 * A renewal is not always recorded before the old period ends: the webhook can
 * be late, and a client refresh after a night offline lands after it. Measured
 * by `effectivePlanTier` alone that pre-image is free, and every such monthly
 * renewal would tell a subscriber of a year "You're Pro now". Sixty days is
 * Apple's billing retry, the longer of the two stores' — a card fixed inside
 * it is a renewal too, not a welcome.
 */
export const LATE_RENEWAL_MS = 60 * 24 * 60 * 60 * 1000

/**
 * Whether this write is the edge into Pro: the account was not Pro a moment
 * ago, by the same expiry rule every guard applies, and now it is.
 *
 * Measured on the stored pre-image through `effectivePlanTier`, not on its
 * raw tier, so a subscription whose `EXPIRATION` never arrived — stored as Pro
 * with an end date long past — still counts as free when somebody buys again.
 * The one carve-out is `LATE_RENEWAL_MS`: an expired paid entitlement that
 * was going to renew, coming back soon after, is its own renewal.
 *
 * `before` is `null` when there was no profile to write to, and then there is
 * nobody to welcome either.
 */
export function becamePro(
  before: EntitlementForEdge | null | undefined,
  after: EntitlementForEdge,
  now: Date = new Date(),
): boolean {
  if (!before) return false
  if (effectivePlanTier(after.tier, after.expiresAt) === 'free') return false
  if (effectivePlanTier(before.tier, before.expiresAt) !== 'free') return false
  return !isLateRenewal(before, now)
}

function isLateRenewal(before: EntitlementForEdge, now: Date): boolean {
  if (normalizePlanTier(before.tier) === 'free') return false
  if (before.willRenew !== true || !before.expiresAt) return false
  return now.getTime() - before.expiresAt.getTime() < LATE_RENEWAL_MS
}

/**
 * Why this entitlement is Pro, as the welcome screen says it.
 *
 * `gift` and `promotional` are both grants nobody paid for — RevenueCat's
 * webhook spells every one `PROMOTIONAL`, the subscriber record says `gift`
 * for one that ends — and which kind of grant it was lives only in the grant's
 * own record, so that is asked (`giftWelcomeFor`). That is also what stops a
 * webhook racing a gift from calling it a purchase: the store it reads is the
 * gift's.
 *
 * `intro` is a discounted paid period, so it is a purchase.
 */
export async function welcomeFor(
  db: Db,
  userId: string,
  entitlement: EntitlementForEdge,
): Promise<ProWelcomeDetails> {
  const store = entitlement.store?.toLowerCase()
  if (store === 'gift' || store === 'promotional') return giftWelcomeFor(db, userId)
  if (entitlement.periodType === 'trial') return { source: 'trial' }
  return { source: 'purchase' }
}

/**
 * What a grant says about itself: an operator's gift, an invite reward or a
 * streak reward, and for how many months.
 *
 * Read off the newest granted `proGifts` row — `grantProGift` flips the row
 * to `granted` before it refreshes the entitlement, so the edge that refresh
 * crosses already finds the gift that caused it. A grant with no row (the v1
 * lifetime gift, or one given by hand in RevenueCat) is a plain `gift` with
 * no length.
 */
export async function giftWelcomeFor(db: Db, userId: string): Promise<ProWelcomeDetails> {
  const latest = await db
    .collection<ProGift>(COLLECTIONS.proGifts)
    .find({ userId, status: 'granted' }, { projection: { source: 1, months: 1 } })
    .sort({ grantedAt: -1, _id: -1 })
    .limit(1)
    .next()
  if (!latest) return { source: 'gift' }
  return { source: GIFT_WELCOME_SOURCE[latest.source], months: latest.months }
}

/**
 * How each kind of gift titles its welcome. A `Record` over every source, so
 * a new way to be given Pro cannot ship without deciding what it says.
 */
export const GIFT_WELCOME_SOURCE: Record<ProGiftSource, ProWelcomeSource> = {
  admin: 'gift',
  referral: 'referral',
  streak: 'streak',
}

/**
 * Leaves a welcome for the app to show. A newer one replaces an older one
 * nobody has seen yet: the latest reason is the one worth saying.
 *
 * Exported for the paths that grant Pro without passing through an edge —
 * a gift on top of a subscription, the plan merge — as well as for the edge.
 */
export async function markProWelcome(
  db: Db,
  userId: string,
  details: ProWelcomeDetails,
  now: Date = new Date(),
): Promise<void> {
  const welcome: ProWelcome = {
    at: now,
    source: details.source,
    ...(details.months ? { months: details.months } : {}),
  }
  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne({ _id: userId }, { $set: { proWelcome: welcome } })
}

/**
 * The one helper both billing paths call after writing an entitlement, with
 * the pre-image the write returned. Resolves to whether a welcome was left.
 *
 * Idempotent across the two paths racing each other by construction: each
 * write is a `findOneAndUpdate`, so exactly one of them sees the free
 * pre-image.
 */
export async function welcomeIfBecamePro(
  db: Db,
  userId: string,
  before: EntitlementForEdge | null | undefined,
  after: EntitlementForEdge,
  now: Date = new Date(),
): Promise<boolean> {
  if (!becamePro(before, after, now)) return false
  await markProWelcome(db, userId, await welcomeFor(db, userId, after), now)
  return true
}

/**
 * Clears the welcome the app has just shown — only if it is still the same
 * one. A welcome written between the read and the tap has a different `at`
 * and survives, so a gift that lands while "You're Pro now" is on screen is
 * still announced. Resolves to whether anything was cleared.
 */
export async function acknowledgeProWelcome(db: Db, userId: string, at: Date): Promise<boolean> {
  const result = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne({ _id: userId, 'proWelcome.at': at }, { $unset: { proWelcome: '' } })
  return result.modifiedCount > 0
}
