import {
  ERROR_CODES,
  STREAK_FREEZE_SKU,
  TOKEN_RULES,
  findCosmetic,
  periodKeys,
  utcDayKey,
  type Wallet,
} from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Profile } from '../profiles/profiles'
import { readAggregates, type TokenLedgerEntry } from './ledger'

export function walletOf(profile: Profile, earned: number): Wallet {
  const spent = profile.tokenSpent ?? 0
  return {
    earned,
    spent,
    balance: earned - spent,
    streakFreezes: profile.streakFreezes ?? 0,
    owned: profile.cosmetics ?? [],
  }
}

export async function getWallet(db: Db, userId: string): Promise<Wallet> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
  const earned = await readAggregates(db, userId)
  return walletOf(profile, earned.all)
}

export interface PurchaseResult {
  sku: string
  price: number
  wallet: Wallet
}

/**
 * Spends token on the only two things it can buy: a streak freeze, or a cosmetic.
 *
 * Race safety works the same way `consumeQuota` does — one atomic
 * `findOneAndUpdate` whose filter re-checks affordability against the document
 * MongoDB is about to write. `earned` is read first and passed in as a
 * literal, which is safe in one direction only and that is the direction we
 * need: it can only grow while we work, so a stale value under-states the
 * balance and can only ever reject a purchase the user could just retry. It
 * can never let one through that they couldn't afford.
 *
 * The grant and the deduction are the *same* update, so there is no window
 * where a user is charged without receiving the item. The ledger row is
 * written afterwards, purely for audit: losing it would leave the visible
 * state correct and the history incomplete, which is the right way round.
 */
export async function purchase(db: Db, userId: string, sku: string): Promise<PurchaseResult> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const profile = await profiles.findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const earned = (await readAggregates(db, userId)).all

  const isFreeze = sku === STREAK_FREEZE_SKU
  const cosmetic = isFreeze ? undefined : findCosmetic(sku)
  if (!isFreeze && !cosmetic) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, `Unknown item: ${sku}`)
  }
  const price = isFreeze ? TOKEN_RULES.sinks.streakFreeze : (cosmetic?.price ?? 0)

  if (!isFreeze && (profile.cosmetics ?? []).includes(sku)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You already own this item')
  }
  if (isFreeze && (profile.streakFreezes ?? 0) >= TOKEN_RULES.sinks.maxBankedStreakFreezes) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `You can bank at most ${TOKEN_RULES.sinks.maxBankedStreakFreezes} streak freezes`,
    )
  }

  const grant = isFreeze
    ? { $inc: { tokenSpent: price, streakFreezes: 1 } }
    : { $inc: { tokenSpent: price }, $addToSet: { cosmetics: sku } }

  const updated = await profiles.findOneAndUpdate(
    {
      _id: userId,
      $expr: { $lte: [{ $add: [{ $ifNull: ['$tokenSpent', 0] }, price] }, earned] },
      // Re-checked inside the atomic filter, not just above: two concurrent
      // buys of the same cosmetic would otherwise both pass the read-time
      // check and charge twice for one item.
      ...(isFreeze
        ? { streakFreezes: { $not: { $gte: TOKEN_RULES.sinks.maxBankedStreakFreezes } } }
        : { cosmetics: { $ne: sku } }),
    },
    grant,
    { returnDocument: 'after' },
  )

  if (!updated) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `Not enough token — ${sku} costs ${price}, you have ${earned - (profile.tokenSpent ?? 0)}`,
    )
  }

  // Audit only. Negative amount, and `awardTokens` is bypassed on purpose: a spend
  // must not touch `tokenAggregates`, or buying a frame would drop the buyer down
  // every leaderboard. The table ranks token earned, not token held.
  const at = new Date()
  const keys = periodKeys(at)
  await db.collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger).insertOne({
    _id: new ObjectId(),
    userId,
    kind: 'spend',
    amount: -price,
    // Not idempotent by design, and it must not be: buying two frames is two
    // real events. The unique index only covers rows that carry a `refId`
    // meaning "this exact thing", which a spend does not.
    refId: `${sku}:${at.toISOString()}`,
    day: utcDayKey(at),
    week: keys.week,
    month: keys.month,
    year: keys.year,
    createdAt: at,
  })

  return { sku, price, wallet: walletOf(updated, earned) }
}

/** Spends one banked freeze, atomically. `false` means there was none to spend. */
export async function consumeStreakFreeze(db: Db, userId: string): Promise<boolean> {
  const result = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOneAndUpdate(
      { _id: userId, streakFreezes: { $gte: 1 } },
      { $inc: { streakFreezes: -1 } },
      { returnDocument: 'after' },
    )
  return result !== null
}
