import {
  GIFT_CODE_PATTERN,
  GIFT_CODE_RULES,
  normalizeGiftCode,
  type AdminGiftCodeCreateInput,
  type GiftCodeRejection,
} from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { holdsLifetime, proGiftKey, queueProGift, type ProGift } from './proGifts'

/**
 * Gift codes: one word, handed out by an operator, worth months of Pro to
 * anybody who types it into the paywall — once.
 *
 * A code does not grant anything itself. A redemption becomes a `proGifts`
 * row keyed `code:<codeId>:<userId>`, and from there it is the same gift an
 * operator gives by hand: the same stacking of end dates, the same letter,
 * the same reminders. What lives here is only the door: which codes exist,
 * who has been through them, and how fast anybody may knock.
 *
 * **The cap is a conditional increment, not a count.** "Fifty redemptions"
 * holds under fifty simultaneous taps because the only write that takes one
 * is `$inc` on a document whose filter still says there is one left — the
 * fifty-first matches nothing. Nothing reads a count and then writes.
 *
 * **Once per person is the unique index.** The redemption row is written
 * *before* the count is taken, so a double tap lands on
 * `giftCodeRedemptions.code_user_unique` rather than on a second month; and a
 * row whose count then could not be taken is removed again. Doing it in that
 * order means the only thing a failed claim ever has to undo is its own row —
 * never somebody else's view of how many are left.
 */

export interface GiftCode {
  /** A uuid. The code itself can be retired and reissued; the id cannot. */
  _id: string
  /** Normalised: upper case, no spaces — see `normalizeGiftCode`. Unique. */
  code: string
  months: number
  /** `null` means no cap. */
  maxRedemptions: number | null
  redemptions: number
  /** `null` means no last day. */
  expiresAt: Date | null
  active: boolean
  createdBy: string
  createdAt: Date
  /** The operator's own reason. Never shown to anybody redeeming it. */
  note?: string
}

export interface GiftCodeRedemption {
  /** The gift's own key, `code:<codeId>:<userId>`, so the two can be read across. */
  _id: string
  codeId: string
  userId: string
  at: Date
}

interface GiftCodeAttempt {
  userId: string
  at: Date
}

function codes(db: Db) {
  return db.collection<GiftCode>(COLLECTIONS.giftCodes)
}

function redemptions(db: Db) {
  return db.collection<GiftCodeRedemption>(COLLECTIONS.giftCodeRedemptions)
}

function attempts(db: Db) {
  return db.collection<GiftCodeAttempt>(COLLECTIONS.giftCodeAttempts)
}

function isDuplicateKey(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000
}

const HOUR_MS = 60 * 60 * 1000

// ── the operator's side ────────────────────────────────────────────────────

/** A new code, or `null` when that spelling is already taken. */
export async function createGiftCode(
  db: Db,
  input: AdminGiftCodeCreateInput,
  createdBy: string,
  now: Date = new Date(),
): Promise<GiftCode | null> {
  const row: GiftCode = {
    _id: randomUUID(),
    code: normalizeGiftCode(input.code),
    months: input.months,
    maxRedemptions: input.maxRedemptions ?? null,
    redemptions: 0,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    active: true,
    createdBy,
    createdAt: now,
    ...(input.note ? { note: input.note } : {}),
  }
  try {
    await codes(db).insertOne(row)
  } catch (error) {
    if (isDuplicateKey(error)) return null
    throw error
  }
  return row
}

/** Every code, newest first — the panel's list. */
export function listGiftCodes(db: Db, limit = 200): Promise<GiftCode[]> {
  return codes(db).find().sort({ createdAt: -1 }).limit(limit).toArray()
}

export function getGiftCode(db: Db, id: string): Promise<GiftCode | null> {
  return codes(db).findOne({ _id: id })
}

/**
 * Switches a code off or back on. Off is the operator's stop button: nothing
 * already redeemed is taken back, and the count stays where it was.
 */
export function setGiftCodeActive(db: Db, id: string, active: boolean): Promise<GiftCode | null> {
  return codes(db).findOneAndUpdate({ _id: id }, { $set: { active } }, { returnDocument: 'after' })
}

export interface GiftCodeRedemptionView {
  userId: string
  handle: string | null
  displayName: string | null
  at: Date
  /** Where the gift it became has got to — `null` if the row is gone with the account. */
  giftStatus: ProGift['status'] | null
}

/**
 * Who redeemed a code, newest first, with enough of each person to find them
 * in the panel. A deleted account's redemption goes with it; the count on the
 * code does not, because it counts what was given, not who is still here.
 */
export async function listGiftCodeRedemptions(
  db: Db,
  codeId: string,
  limit = 200,
): Promise<GiftCodeRedemptionView[]> {
  const rows = await redemptions(db).find({ codeId }).sort({ at: -1 }).limit(limit).toArray()
  const userIds = rows.map((row) => row.userId)
  const [people, gifts] = await Promise.all([
    db
      .collection<Profile>(COLLECTIONS.profiles)
      .find({ _id: { $in: userIds } }, { projection: { handle: 1, displayName: 1 } })
      .toArray(),
    db
      .collection<ProGift>(COLLECTIONS.proGifts)
      .find({ _id: { $in: rows.map((row) => row._id) } }, { projection: { status: 1 } })
      .toArray(),
  ])
  const byId = new Map(people.map((person) => [person._id, person]))
  const statusOf = new Map(gifts.map((gift) => [gift._id, gift.status]))
  return rows.map((row) => ({
    userId: row.userId,
    handle: byId.get(row.userId)?.handle ?? null,
    displayName: byId.get(row.userId)?.displayName ?? null,
    at: row.at,
    giftStatus: statusOf.get(row._id) ?? null,
  }))
}

// ── the person's side ──────────────────────────────────────────────────────

export type GiftCodeRedeemOutcome =
  | { kind: 'redeemed'; gift: ProGift; giftCode: GiftCode }
  | { kind: 'rejected'; reason: GiftCodeRejection }
  /** Too many attempts this hour; `retryAt` is when the oldest one leaves the window. */
  | { kind: 'throttled'; retryAt: Date }

/**
 * Counts this attempt and says whether it is one too many.
 *
 * Written first and counted second, so two attempts racing each see the
 * other: the eleventh is refused however close together they arrive. Every
 * attempt counts, a right code included — the window is about how fast
 * somebody may knock, not about how often they are wrong.
 */
async function throttle(db: Db, userId: string, now: Date): Promise<Date | null> {
  await attempts(db).insertOne({ userId, at: now })
  const since = new Date(now.getTime() - HOUR_MS)
  const made = await attempts(db).countDocuments({ userId, at: { $gt: since } })
  if (made <= GIFT_CODE_RULES.attemptsPerHour) return null
  const oldest = await attempts(db)
    .find({ userId, at: { $gt: since } })
    .sort({ at: 1 })
    .limit(1)
    .next()
  return new Date((oldest?.at ?? now).getTime() + HOUR_MS)
}

/** Why a code that looked redeemable a moment ago could not be claimed. */
function claimRefusal(code: GiftCode | null, now: Date): GiftCodeRejection {
  if (!code) return 'unknown'
  if (!code.active) return 'inactive'
  if (code.expiresAt && code.expiresAt <= now) return 'expired'
  return 'exhausted'
}

/**
 * Redeems `raw` for `userId`: checks the code and the person, takes one
 * redemption under the cap, and queues the gift. The caller grants it —
 * `grantProGiftNow`, as the operator's button does — so the answer can say
 * whether it landed.
 */
export async function redeemGiftCode(
  db: Db,
  input: { userId: string; code: string },
  now: Date = new Date(),
): Promise<GiftCodeRedeemOutcome> {
  const { userId } = input
  const throttled = await throttle(db, userId, now)
  if (throttled) return { kind: 'throttled', retryAt: throttled }

  const reject = (reason: GiftCodeRejection): GiftCodeRedeemOutcome => ({
    kind: 'rejected',
    reason,
  })

  const spelled = normalizeGiftCode(input.code)
  if (!GIFT_CODE_PATTERN.test(spelled)) return reject('unknown')
  const giftCode = await codes(db).findOne({ code: spelled })
  if (!giftCode) return reject('unknown')
  if (!giftCode.active) return reject('inactive')
  if (giftCode.expiresAt && giftCode.expiresAt <= now) return reject('expired')

  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: userId }, { projection: { official: 1, entitlement: 1, deletedAt: 1 } })
  if (!profile || profile.deletedAt) return reject('unknown')
  if (profile.official) return reject('official')
  if (holdsLifetime(profile.entitlement)) return reject('lifetime')

  const key = proGiftKey.code(giftCode._id, userId)
  // Before the cap, so somebody who took one of the last fifty hears "you
  // already used it" rather than "they have run out".
  if (await redemptions(db).findOne({ _id: key }, { projection: { _id: 1 } })) {
    return reject('used')
  }
  if (giftCode.maxRedemptions !== null && giftCode.redemptions >= giftCode.maxRedemptions) {
    return reject('exhausted')
  }

  try {
    await redemptions(db).insertOne({ _id: key, codeId: giftCode._id, userId, at: now })
  } catch (error) {
    if (isDuplicateKey(error)) return reject('used')
    throw error
  }

  const claimed = await codes(db).findOneAndUpdate(
    {
      _id: giftCode._id,
      active: true,
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        {
          $or: [{ maxRedemptions: null }, { $expr: { $lt: ['$redemptions', '$maxRedemptions'] } }],
        },
      ],
    },
    { $inc: { redemptions: 1 } },
    { returnDocument: 'after' },
  )
  if (!claimed) {
    await redemptions(db).deleteOne({ _id: key })
    return reject(claimRefusal(await codes(db).findOne({ _id: giftCode._id }), now))
  }

  try {
    const { gift } = await queueProGift(
      db,
      { _id: key, userId, months: claimed.months, source: 'code', code: claimed.code },
      now,
    )
    return { kind: 'redeemed', gift, giftCode: claimed }
  } catch (error) {
    // Nothing was given, so nothing may be spent: hand the redemption and
    // the count back, and let the person try again.
    await redemptions(db).deleteOne({ _id: key })
    await codes(db).updateOne({ _id: giftCode._id }, { $inc: { redemptions: -1 } })
    throw error
  }
}
