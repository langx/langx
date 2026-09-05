import { ERROR_CODES, TOKEN_RULES, giftReadyAt, rollGift, type GiftClaim } from '@langx/shared'
import { randomInt } from 'node:crypto'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Profile } from '../profiles/profiles'
import { awardTokens, readAggregates } from './ledger'
import { walletOf } from './wallet'

/**
 * Open the hourly gift.
 *
 * The server owns both halves — whether, and how much. The claim is a single
 * conditional update on `profiles.lastGiftAt`: the filter *is* the cooldown
 * check, so two devices opening at once cannot both win, and there is no
 * window between reading the timestamp and writing it. `$not: { $gt }` rather
 * than `$lte` so that a profile which has never opened one (no field at all)
 * matches too.
 *
 * The amount is rolled after the claim, from `node:crypto`, so nothing the
 * client sends can influence it. A moderation freeze (`tokenFrozenAt`) still
 * consumes the hour and pays nothing — the same rule every award follows: the
 * act happens, the payout stops. An empty gift writes no ledger row, which is
 * the honest history; the `refId` is the claim's own timestamp, unique per
 * user because the claim made it so.
 */
export async function claimGift(
  db: Db,
  userId: string,
  at: Date = new Date(),
  roll: (maxExclusive: number) => number = (n) => randomInt(n),
): Promise<GiftClaim> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const threshold = new Date(at.getTime() - TOKEN_RULES.gift.cooldownMs)

  const claimed = await profiles.findOneAndUpdate(
    { _id: userId, lastGiftAt: { $not: { $gt: threshold } } },
    { $set: { lastGiftAt: at, updatedAt: at } },
    { returnDocument: 'after' },
  )

  if (!claimed) {
    const profile = await profiles.findOne({ _id: userId })
    if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
    const readyAt = giftReadyAt(profile.lastGiftAt, TOKEN_RULES.gift.cooldownMs, at) ?? at
    throw new ApiError(ERROR_CODES.RATE_LIMITED, 'Your next gift is not ready yet', {
      retryAt: readyAt.toISOString(),
    })
  }

  const amount = claimed.tokenFrozenAt ? 0 : rollGift(TOKEN_RULES.gift, roll).amount
  await awardTokens(db, {
    userId,
    kind: 'gift',
    amount,
    refId: `gift:${at.toISOString()}`,
    at,
  })

  const earned = await readAggregates(db, userId, at)
  return {
    amount,
    nextAt: new Date(at.getTime() + TOKEN_RULES.gift.cooldownMs).toISOString(),
    wallet: walletOf(claimed, earned.all),
  }
}
