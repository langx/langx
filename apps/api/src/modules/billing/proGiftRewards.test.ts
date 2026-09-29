import { PRO_GIFT_RULES, shiftDayKey, utcDayKey } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Profile } from '../profiles/profiles'
import type { Referral } from '../referrals/referrals'
import { settleReferral } from '../referrals/settle'
import { recordCheckIn, recordQualifyingAction } from '../tokens/streak'
import { queueReferralGifts } from './proGiftRewards'
import type { ProGift } from './proGifts'

/**
 * The two earned gifts: a streak milestone, and invitees who became real
 * users. Both only write a pending row — these tests read the rows, and
 * `proGifts.test.ts` covers what becomes of one.
 */
describe('earned gifts of Pro', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let db: Db

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_pro_gift_rewards_test')
    db = handle.db
    await ensureIndexes(db)
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.proGifts,
      COLLECTIONS.referrals,
      COLLECTIONS.tokenLedger,
      COLLECTIONS.tokenAggregates,
      COLLECTIONS.streakDays,
    ]) {
      await db.collection(name).deleteMany({})
    }
  })

  async function person(overrides: Partial<Profile> = {}): Promise<Profile> {
    const _id = new ObjectId()
    const userId = _id.toHexString()
    const now = new Date()
    await db
      .collection(COLLECTIONS.user)
      .insertOne({ _id, email: `${userId}@example.com`, emailVerified: true })
    const profile: Profile = {
      _id: userId,
      handle: `u${userId.slice(-8)}`,
      displayName: 'Sofia',
      birthDate: '1995-06-15',
      gender: 'undisclosed',
      nativeLanguages: [{ code: 'es' }],
      learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      interests: [],
      settings: { discoverable: true, notifications: true },
      privacy: { incognito: false },
      entitlement: { tier: 'free', updatedAt: now },
      quota: { initiations: [], translations: [], media: [] },
      streak: { current: 0, longest: 0, lastQualifiedDay: null },
      stats: { lastActiveAt: now, messagesSent: 0 },
      createdAt: now,
      updatedAt: now,
      ...overrides,
    }
    await db.collection<Profile>(COLLECTIONS.profiles).insertOne(profile)
    return profile
  }

  const giftsOf = (userId: string) =>
    db.collection<ProGift>(COLLECTIONS.proGifts).find({ userId }).sort({ _id: 1 }).toArray()
  const reread = async (userId: string) =>
    (await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })) as Profile

  describe('streak milestones', () => {
    const today = new Date()
    const yesterday = shiftDayKey(utcDayKey(today), -1)

    it('queues a month on the action that reaches 100 days', async () => {
      const profile = await person({
        streak: { current: 99, longest: 99, lastQualifiedDay: yesterday, lastActionDay: yesterday },
      })

      const result = await recordQualifyingAction(db, profile, today)
      expect(result.current).toBe(100)

      const gifts = await giftsOf(profile._id)
      expect(gifts).toHaveLength(1)
      expect(gifts[0]).toMatchObject({
        _id: `streak:100:${profile._id}`,
        months: 1,
        source: 'streak',
        status: 'pending',
        endsAt: null,
      })
      expect((await reread(profile._id)).proGiftStreaks).toEqual([100])
    })

    /** Already past both on the day this shipped — a v1 restore, say. */
    it('queues every rung a long streak has passed, once', async () => {
      const profile = await person({
        streak: {
          current: 400,
          longest: 400,
          lastQualifiedDay: yesterday,
          lastActionDay: yesterday,
        },
      })

      await recordQualifyingAction(db, profile, today)
      const gifts = await giftsOf(profile._id)
      expect(gifts.map((g) => [g._id, g.months])).toEqual([
        [`streak:100:${profile._id}`, 1],
        [`streak:365:${profile._id}`, 3],
      ])

      // The next day's claim finds the markers and writes nothing.
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
      await recordQualifyingAction(db, await reread(profile._id), tomorrow)
      expect(await giftsOf(profile._id)).toHaveLength(2)
    })

    it('pays nothing for opening the app', async () => {
      const profile = await person({
        streak: { current: 99, longest: 99, lastQualifiedDay: yesterday, lastActionDay: yesterday },
      })
      await recordCheckIn(db, profile, today)
      expect(await giftsOf(profile._id)).toHaveLength(0)
    })
  })

  describe('referrals', () => {
    const now = new Date()
    const year = now.getUTCFullYear()

    async function activated(referrerId: string, count: number, at: Date = now) {
      for (let i = 0; i < count; i++) {
        await db.collection<Referral>(COLLECTIONS.referrals).insertOne({
          _id: new ObjectId().toHexString(),
          referrerId,
          referrerHandle: 'ref',
          source: 'link',
          createdAt: at,
          activatedAt: at,
        })
      }
    }

    it('queues a month for every third activation this year, the one settling included', async () => {
      const referrer = await person()
      await activated(referrer._id, 2)
      const inviteeId = new ObjectId().toHexString()
      await db.collection<Referral>(COLLECTIONS.referrals).insertOne({
        _id: inviteeId,
        referrerId: referrer._id,
        referrerHandle: 'ref',
        source: 'link',
        createdAt: now,
      })

      expect(await queueReferralGifts(db, referrer._id, inviteeId, now)).toBe(1)
      const gifts = await giftsOf(referrer._id)
      expect(gifts).toHaveLength(1)
      expect(gifts[0]).toMatchObject({
        _id: `referral:${referrer._id}:${year}:1`,
        months: PRO_GIFT_RULES.referral.monthsPerGift,
        source: 'referral',
      })

      // Settling the same invitee again — before or after the latch — is the same key.
      await queueReferralGifts(db, referrer._id, inviteeId, now)
      expect(await giftsOf(referrer._id)).toHaveLength(1)
    })

    it('stops at the yearly cap and does not count last year', async () => {
      const referrer = await person()
      await activated(referrer._id, 20)
      await activated(referrer._id, 9, new Date(Date.UTC(year - 1, 5, 1)))

      expect(await queueReferralGifts(db, referrer._id, 'nobody', now)).toBe(
        PRO_GIFT_RULES.referral.maxGiftsPerYear,
      )
      expect(await giftsOf(referrer._id)).toHaveLength(PRO_GIFT_RULES.referral.maxGiftsPerYear)
    })

    /** Through `settleReferral`, the way a message send reaches it. */
    async function readyInvitee(referrerId: string): Promise<string> {
      const invitee = await person({ referredBy: referrerId })
      await db.collection<Referral>(COLLECTIONS.referrals).insertOne({
        _id: invitee._id,
        referrerId,
        referrerHandle: 'ref',
        source: 'link',
        createdAt: now,
      })
      await db.collection(COLLECTIONS.tokenLedger).insertOne({
        userId: invitee._id,
        kind: 'message',
        amount: 5,
        refId: new ObjectId().toHexString(),
        createdAt: now,
      })
      return invitee._id
    }

    it('rewards before it locks when an activation completes a group', async () => {
      const referrer = await person()
      await activated(referrer._id, 2)
      const inviteeId = await readyInvitee(referrer._id)

      await settleReferral(db, inviteeId, now)

      const referral = await db
        .collection<Referral>(COLLECTIONS.referrals)
        .findOne({ _id: inviteeId })
      expect(referral?.activatedAt).toBeDefined()
      expect(await giftsOf(referrer._id)).toHaveLength(1)
    })

    it('gives a frozen referrer nothing', async () => {
      const referrer = await person({ tokenFrozenAt: new Date() })
      await activated(referrer._id, 2)
      const inviteeId = await readyInvitee(referrer._id)

      await settleReferral(db, inviteeId, now)
      expect(await giftsOf(referrer._id)).toHaveLength(0)
    })
  })
})
