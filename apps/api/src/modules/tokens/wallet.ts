import {
  ERROR_CODES,
  STREAK_FREEZE_SKU,
  STREAK_RESTORE_SKU,
  TOKEN_RULES,
  findCosmetic,
  meetsRequirement,
  localDayKey,
  periodKeys,
  shiftDayKey,
  streakRestorePrice,
  type Wallet,
  utcDayKey,
} from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Profile } from '../profiles/profiles'
import { streakDay } from './streak'
import {
  isRepairable,
  listStreakDays,
  repairsInMonth,
  streakDayId,
  streakFromDays,
  streakHeadDay,
  type StreakDay,
} from './streakDays'
import { countCorrectionsWritten } from './corrections'
import { readAggregates, type TokenLedgerEntry } from './ledger'

export function walletOf(profile: Profile, earned: number): Wallet {
  const spent = profile.tokenSpent ?? 0
  return {
    earned,
    spent,
    balance: earned - spent,
    streakFreezes: profile.streakFreezes ?? 0,
    owned: profile.cosmetics ?? [],
    ...(profile.equipped ? { equipped: profile.equipped } : {}),
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

  if (sku === STREAK_RESTORE_SKU) return restoreStreak(db, profile, earned)

  const isFreeze = sku === STREAK_FREEZE_SKU
  const cosmetic = isFreeze ? undefined : findCosmetic(sku)
  if (!isFreeze && !cosmetic) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, `Unknown item: ${sku}`)
  }
  const price = isFreeze ? TOKEN_RULES.sinks.streakFreeze : (cosmetic?.price ?? 0)

  if (!isFreeze && (profile.cosmetics ?? []).includes(sku)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You already own this item')
  }

  /*
   * A condition beyond the price, in the same shape as the two checks above
   * it: a pre-check that throws, mirrored where it can be inside the atomic
   * filter below.
   *
   * `streak.longest` lives on the profile and is re-checked atomically.
   * Corrections are counted from the ledger and cannot be — but both numbers
   * only ever grow, so a value read a moment ago can only be an *under*
   * estimate. The check can refuse a purchase that would now succeed; it can
   * never let one through that should not.
   */
  if (cosmetic?.requires) {
    const corrections = cosmetic.requires.corrections
      ? await countCorrectionsWritten(db, userId)
      : 0
    const progress = { longestStreak: profile.streak?.longest ?? 0, corrections }
    if (!meetsRequirement(cosmetic.requires, progress)) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_FAILED,
        `${sku} has to be earned before it can be bought`,
      )
    }
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
      // The half of the gate that is a field on this document, re-checked
      // where it counts. The correction count is not one, so it stays a
      // pre-check — see above for why that is safe.
      ...(cosmetic?.requires?.longestStreak !== undefined
        ? { 'streak.longest': { $gte: cosmetic.requires.longestStreak } }
        : {}),
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

  await recordSpend(db, userId, sku, price)

  return { sku, price, wallet: walletOf(updated, earned) }
}

/**
 * Audit only. Negative amount, and `awardTokens` is bypassed on purpose: a
 * spend must not touch `tokenAggregates`, or buying a frame would drop the
 * buyer down every leaderboard. The table ranks token earned, not token held.
 *
 * Written after the balance change, never before: losing this row leaves the
 * visible state correct and the history incomplete, which is the right way
 * round.
 */
async function recordSpend(db: Db, userId: string, sku: string, price: number): Promise<void> {
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

/**
 * Brings a returning v1 user's streak back to life.
 *
 * `legacyRestore.ts` has said "`frozenStreak` is what they can buy back" since
 * it was written, and there was no way to buy it — the number only reached
 * `streak.longest`, where it sat as a record. So the welcome-back screen could
 * say "your best was 12 days" and offer nothing.
 *
 * Once only, and `restoredFromV1.streakRestoredAt` is the latch — the same
 * conditional-update pattern `markRestored` and the acknowledgement use. It is
 * part of the atomic filter, not just checked above it, so two taps cannot
 * both charge.
 *
 * `lastQualifiedDay` is set to **today**: they bought the streak, so it is
 * alive today and they have to act tomorrow to keep it. Dating it yesterday
 * would break the streak the moment they close the app, which is a poor thing
 * to sell someone.
 */
async function restoreStreak(db: Db, profile: Profile, earned: number): Promise<PurchaseResult> {
  const frozen = profile.restoredFromV1?.frozenStreak ?? 0
  if (!profile.restoredFromV1 || frozen <= 0) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'You have no v1 streak to restore')
  }
  if (profile.restoredFromV1.streakRestoredAt) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Your streak has already been restored')
  }

  const price = streakRestorePrice(frozen)
  const today = streakDay(profile, new Date())

  const updated = await db.collection<Profile>(COLLECTIONS.profiles).findOneAndUpdate(
    {
      _id: profile._id,
      $expr: { $lte: [{ $add: [{ $ifNull: ['$tokenSpent', 0] }, price] }, earned] },
      'restoredFromV1.streakRestoredAt': { $exists: false },
    },
    {
      $inc: { tokenSpent: price },
      $set: {
        'streak.current': frozen,
        'streak.longest': Math.max(profile.streak.longest, frozen),
        'streak.lastQualifiedDay': today,
        'restoredFromV1.streakRestoredAt': new Date(),
      },
    },
    { returnDocument: 'after' },
  )

  if (!updated) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `Not enough token — restoring your streak costs ${price}, you have ${earned - (profile.tokenSpent ?? 0)}`,
    )
  }

  await recordSpend(db, profile._id, STREAK_RESTORE_SKU, price)
  return { sku: STREAK_RESTORE_SKU, price, wallet: walletOf(updated, earned) }
}

export interface RepairResult {
  day: string
  price: number
  streak: { current: number; longest: number }
  wallet: Wallet
  repairsLeftThisMonth: number
}

/**
 * Buys back one missed day.
 *
 * Two writes, in two collections, so there is no single atomic update to lean
 * on the way a cosmetic purchase does — the money is on `profiles.tokenSpent`
 * and the day is a `streakDays` document. The order is what makes that safe:
 * insert the day first, because its `_id` is `<userId>:<day>` and a duplicate
 * key is a far better "already filled" check than a read could ever be, then
 * charge, and delete the day again if the charge does not go through. The
 * reverse order could take the tokens and fail to fill the square, which is
 * the failure worth designing against.
 */
export async function repairDay(db: Db, userId: string, day: string): Promise<RepairResult> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const profile = await profiles.findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const now = new Date()
  const timeZone = profile.timezone ?? 'UTC'
  const today = localDayKey(now, timeZone)

  if (!isRepairable(day, today, timeZone, now)) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `Only the last ${TOKEN_RULES.sinks.dayRepairMaxAgeDays} days, and not today — today is earned`,
    )
  }

  const used = await repairsInMonth(db, userId, day)
  if (used >= TOKEN_RULES.sinks.dayRepairPerMonth) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `You have used both repairs for ${day.slice(0, 7)}`,
    )
  }

  const price = TOKEN_RULES.sinks.dayRepair
  const days = db.collection<StreakDay>(COLLECTIONS.streakDays)
  try {
    await days.insertOne({
      _id: streakDayId(userId, day),
      userId,
      day,
      source: 'purchase',
      actions: 0,
    })
  } catch {
    // The only way `insertOne` fails here is the unique `_id`, which is
    // exactly "that day is already filled".
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'That day is already filled')
  }

  const earned = (await readAggregates(db, userId)).all
  const charged = await profiles.findOneAndUpdate(
    {
      _id: userId,
      $expr: { $lte: [{ $add: [{ $ifNull: ['$tokenSpent', 0] }, price] }, earned] },
    },
    { $inc: { tokenSpent: price } },
    { returnDocument: 'after' },
  )

  if (!charged) {
    // Hand the day back rather than leaving a square nobody paid for.
    await days.deleteOne({ _id: streakDayId(userId, day) })
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `Not enough token — a repair costs ${price}, you have ${earned - (profile.tokenSpent ?? 0)}`,
    )
  }

  await recordSpend(db, userId, `dayRepair:${day}`, price)

  /**
   * Recomputed from the filled days, not incremented. A repair can join two
   * runs that were never adjacent while they were being lived, so the only way
   * to know the new length is to walk them.
   */
  const window = await listStreakDays(db, userId, shiftDayKey(today, -400), today)
  const filled = new Set(window.map((d) => d.day))
  const walked = streakFromDays(filled, today)

  /**
   * `lastQualifiedDay` has to move with the streak, and forgetting it made the
   * purchase worthless.
   *
   * `recordQualifyingAction` reads this field twice: `nextStreak` uses it to
   * decide whether today continues the run, and `missedExactlyOne` uses it to
   * decide whether a banked freeze is owed. Leaving it on the day *before* the
   * gap meant the next message after a repair saw a day it had already been
   * paid to fill still missing — so `nextStreak` found no adjacency and reset
   * the streak to 1, and a user holding a freeze spent that too, bridging a day
   * they had just bought. Three hundred tokens for nothing, twice over.
   */
  const head = streakHeadDay(filled, today)

  /**
   * `$max`, not `$set`, and it is doing two jobs.
   *
   * The race: `walked` was computed from a read three awaits ago, so a message
   * that landed in between would be rolled back by a plain `$set`. `$max` can
   * only move a value forward, so the later write wins whichever order they
   * arrive in.
   *
   * The floor: `streakDays` only started existing when the map shipped, so an
   * older account has a streak counter and no history behind it, and the walk
   * would price a two-hundred-day run at zero. Buying a repair must never be
   * able to take a streak away. `$max` says exactly that, in the database,
   * instead of a `Math.max` over a value that may already be stale.
   *
   * `longest` takes the same floor: it is `>= current` by invariant, and maxing
   * both by the same number keeps it that way.
   */
  const after = await profiles.findOneAndUpdate(
    { _id: userId },
    {
      $max: {
        'streak.current': walked,
        'streak.longest': walked,
        // Day keys are `YYYY-MM-DD`, so BSON's string comparison is
        // chronological — and `null` sorts below any string, so a profile that
        // has never qualified still moves forward.
        ...(head === null ? {} : { 'streak.lastQualifiedDay': head }),
      },
      $set: { updatedAt: now },
    },
    { returnDocument: 'after' },
  )

  const streak = after?.streak ?? profile.streak
  return {
    day,
    price,
    // Read back rather than reported from the local walk, since `$max` is what
    // decided the answer and a concurrent message may have raised it further.
    streak: { current: streak.current, longest: streak.longest },
    wallet: walletOf(after ?? charged, earned),
    repairsLeftThisMonth: TOKEN_RULES.sinks.dayRepairPerMonth - used - 1,
  }
}
