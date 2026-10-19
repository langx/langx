import { PRO_WEEK_RULES, localDayKey, shiftDayKey } from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { translator } from '../../i18n'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import type { Message } from '../chat/conversations'
import { ensureOfficialAccounts } from '../official/accounts'
import type { OfficialDelivery } from '../official/deliver'
import type { Profile } from '../profiles/profiles'
import type { StreakDay } from '../tokens/streakDays'
import { createFakeRevenueCat } from './fakeRevenueCat'
import { queueStreakGifts } from './proGiftRewards'
import {
  proGiftKey,
  queueProGift,
  runProGiftPass,
  type ProGift,
  type ProGiftDeps,
} from './proGifts'
import { proWeekRefusal, queueProWeekExtension, readProWeekRecap, startProWeek } from './proWeek'

const DAY = 24 * 60 * 60 * 1000

/**
 * The Pro Week, against a real database and the fake store: who is given it,
 * that it is once, that it says nothing, that the second week is earned only
 * by real practice and stacks on the first, and that the recap is never shown
 * to anybody who pays.
 */
describe('the Pro Week', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let db: Db
  let email: CapturingEmailSender
  let fanned: { delivery: OfficialDelivery; push: boolean }[]
  let deps: ProGiftDeps

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_pro_week_test')
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
      COLLECTIONS.messages,
      COLLECTIONS.conversations,
      COLLECTIONS.streakDays,
    ]) {
      await db.collection(name).deleteMany({})
    }
    await ensureOfficialAccounts(db, 'http://localhost:4000')
    email = new CapturingEmailSender()
    fanned = []
    deps = {
      revenueCat: createFakeRevenueCat(),
      email,
      fanOut: (delivery, { push }) => {
        fanned.push({ delivery, push })
        return Promise.resolve()
      },
      warn: () => undefined,
    }
  })

  async function person(fields: Partial<Profile> = {}, user: Record<string, unknown> = {}) {
    const _id = new ObjectId()
    const userId = _id.toHexString()
    const now = new Date()
    await db
      .collection(COLLECTIONS.user)
      .insertOne({ _id, email: `${userId}@example.com`, emailVerified: true, ...user })
    const row: Profile = {
      _id: userId,
      handle: `u${userId.slice(-8)}`,
      displayName: 'Sofia',
      birthDate: '1995-06-15',
      gender: 'undisclosed',
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      interests: [],
      settings: { discoverable: true, notifications: true },
      privacy: { incognito: false },
      entitlement: { tier: 'free', updatedAt: now },
      quota: { initiations: [], translations: [], media: [] },
      streak: { current: 0, longest: 0, lastQualifiedDay: null },
      stats: { lastActiveAt: now, messagesSent: 0 },
      timezone: 'UTC',
      createdAt: now,
      updatedAt: now,
      ...fields,
    }
    await db.collection<Profile>(COLLECTIONS.profiles).insertOne(row)
    return row
  }

  const read = (id: string) =>
    db.collection<Profile & { proWelcome?: unknown }>(COLLECTIONS.profiles).findOne({ _id: id })
  const giftsOf = (userId: string) =>
    db.collection<ProGift>(COLLECTIONS.proGifts).find({ userId }).sort({ _id: 1 }).toArray()

  describe('who is given it', () => {
    it('gives a new adult account a week of Pro, granted at once', async () => {
      const sofia = await person()
      const now = new Date()
      expect(await startProWeek(db, deps, sofia, now)).toBe(true)

      const stored = await read(sofia._id)
      expect(stored?.entitlement).toMatchObject({ tier: 'pro', store: 'gift' })
      expect(stored?.proWeek?.startedAt).toEqual(now)
      expect(stored?.proWeek?.endsAt).toEqual(new Date(now.getTime() + 7 * DAY))
      const [week] = await giftsOf(sofia._id)
      expect(week).toMatchObject({ source: 'welcome', welcome: 1, status: 'granted', weeks: 1 })
    })

    it('says nothing at all: no letter, no push, no mail, no "You\'re Pro now"', async () => {
      const sofia = await person()
      await startProWeek(db, deps, sofia)
      await runProGiftPass(db, deps)

      expect(await db.collection<Message>(COLLECTIONS.messages).countDocuments({})).toBe(0)
      expect(fanned).toEqual([])
      expect(email.messages).toEqual([])
      expect((await read(sofia._id))?.proWelcome).toBeUndefined()
    })

    it('is once per person, and the index says so whatever the key', async () => {
      const sofia = await person()
      expect(await startProWeek(db, deps, sofia)).toBe(true)
      expect(await startProWeek(db, deps, sofia)).toBe(false)

      await expect(
        db.collection<ProGift>(COLLECTIONS.proGifts).insertOne({
          _id: `some-other-key:${sofia._id}`,
          userId: sofia._id,
          months: 0,
          weeks: 1,
          source: 'welcome',
          welcome: 1,
          status: 'pending',
          endsAt: null,
          lockedUntil: new Date(),
          attempts: 0,
          createdAt: new Date(),
        }),
      ).rejects.toBeInstanceOf(MongoServerError)
      expect(await giftsOf(sofia._id)).toHaveLength(1)
    })

    it('never goes to a guest, a minor, a Pro account or a returning v1 account', async () => {
      const now = new Date()
      const seventeen = `${now.getUTCFullYear() - 17}-01-01`
      const cases: [Partial<Profile>, Record<string, unknown>, string][] = [
        [{ guest: true }, {}, 'guest'],
        [{ birthDate: seventeen }, {}, 'minor'],
        [{ entitlement: { tier: 'pro', store: 'promotional', updatedAt: now } }, {}, 'pro'],
        [{}, { precreatedFromV1: { at: now } }, 'returning'],
      ]
      for (const [fields, user, why] of cases) {
        const row = await person(fields, user)
        expect(await proWeekRefusal(db, row, now), why).toBe(why)
        expect(await startProWeek(db, deps, row, now), why).toBe(false)
        expect(await giftsOf(row._id), why).toEqual([])
        expect((await read(row._id))?.proWeek, why).toBeUndefined()
      }
    })
  })

  describe('the second week', () => {
    /** One square of the streak calendar, `daysAgo` local days before today. */
    async function square(
      userId: string,
      daysAgo: number,
      source: StreakDay['source'] = 'activity',
      actions = 1,
    ) {
      const day = shiftDayKey(localDayKey(new Date(), 'UTC'), -daysAgo)
      await db
        .collection<StreakDay>(COLLECTIONS.streakDays)
        .insertOne({ _id: `${userId}:${day}`, userId, day, source, actions })
    }

    /** A week that began `daysAgo` days ago, granted then, with its end a week later. */
    async function weekStartedDaysAgo(daysAgo: number) {
      const started = new Date(Date.now() - daysAgo * DAY - 60_000)
      const sofia = await person({ streak: { current: 7, longest: 7, lastQualifiedDay: null } })
      await startProWeek(db, deps, sofia, started)
      return sofia
    }

    it('is earned by seven days of real practice inside the week', async () => {
      const sofia = await weekStartedDaysAgo(6)
      for (let ago = 6; ago >= 0; ago--) await square(sofia._id, ago)

      expect(await queueProWeekExtension(db, sofia, new Date())).toBe(true)
      expect((await read(sofia._id))?.proGiftStreaks).toContain(PRO_WEEK_RULES.extensionStreakDays)
    })

    it('counts no day that was only opened, bought back, or bridged by a freeze', async () => {
      for (const gap of ['checkIn', 'purchase', 'freeze'] as const) {
        const sofia = await weekStartedDaysAgo(6)
        for (let ago = 6; ago >= 0; ago--) {
          if (ago !== 3) await square(sofia._id, ago)
          else if (gap === 'checkIn') await square(sofia._id, ago, 'checkIn', 0)
          else if (gap === 'purchase') await square(sofia._id, ago, 'purchase', 1)
          // A freeze writes no square at all.
        }
        expect(await queueProWeekExtension(db, sofia, new Date()), gap).toBe(false)
      }
    })

    it('holds the streak rung back while the week runs, and owes it after', async () => {
      // Seven days on the streak counter, one of them only opened.
      const sofia = await weekStartedDaysAgo(6)
      for (let ago = 6; ago >= 0; ago--)
        await square(sofia._id, ago, ago === 2 ? 'checkIn' : 'activity', ago === 2 ? 0 : 1)

      await queueStreakGifts(db, { ...sofia, streak: { ...sofia.streak, current: 7 } }, new Date())
      expect((await giftsOf(sofia._id)).map((row) => row._id)).toEqual([
        proGiftKey.welcome(1, sofia._id),
      ])

      // After the week: the streak's own rule, as for anybody.
      await queueStreakGifts(
        db,
        { ...sofia, streak: { ...sofia.streak, current: 8 } },
        new Date(Date.now() + 2 * DAY),
      )
      expect((await giftsOf(sofia._id)).map((row) => row._id)).toContain(
        proGiftKey.streak(7, sofia._id),
      )
    })

    it('stacks on the first week, and never as a third', async () => {
      const sofia = await weekStartedDaysAgo(6)
      for (let ago = 6; ago >= 0; ago--) await square(sofia._id, ago)
      const first = (await read(sofia._id))?.proWeek?.endsAt
      if (!first) throw new Error('the first week was not granted')

      await queueStreakGifts(db, { ...sofia, streak: { ...sofia.streak, current: 7 } }, new Date())
      await runProGiftPass(db, deps)

      const rows = await giftsOf(sofia._id)
      expect(rows.map((row) => row._id).sort()).toEqual(
        [proGiftKey.welcome(1, sofia._id), proGiftKey.welcome(2, sofia._id)].sort(),
      )
      const second = rows.find((row) => row.welcome === 2)
      expect(second?.endsAt).toEqual(new Date(first.getTime() + 7 * DAY))
      const stored = await read(sofia._id)
      expect(stored?.proWeek).toMatchObject({ endsAt: second?.endsAt, extended: true })
      // Still nothing said about it.
      expect(email.messages).toEqual([])
      expect(fanned).toEqual([])
    })
  })

  describe('the reminders', () => {
    it('names the week and the plan screen the day before, and nothing else', async () => {
      const sofia = await person()
      const started = new Date(Date.now() - 6 * DAY - 13 * 60 * 60 * 1000)
      await startProWeek(db, deps, sofia, started)

      await runProGiftPass(db, deps)
      const [note] = await db
        .collection<Message>(COLLECTIONS.messages)
        .find({ clientId: { $regex: '^proGiftReminder:day:' } })
        .toArray()
      const [before] = translator('tr')('proGift.reminderDayWelcome', { date: '§' }).split('§')
      expect(note?.body.startsWith(before ?? '§')).toBe(true)
      expect(fanned.map((f) => f.push)).toEqual([true])
      expect(email.messages).toEqual([])
    })
  })

  describe('the recap', () => {
    async function weekEnding(inHours: number, fields: Partial<Profile> = {}) {
      const endsAt = new Date(Date.now() + inHours * 60 * 60 * 1000)
      return person({
        proWeek: { startedAt: new Date(endsAt.getTime() - 7 * DAY), endsAt },
        ...fields,
      })
    }

    it('is due on the last day, and counts only what the free plan does not do', async () => {
      const sofia = await weekEnding(12, {
        learning: [
          { code: 'en', level: 'intermediate', priority: 1 },
          { code: 'es', level: 'beginner', priority: 2 },
        ],
        giftLanguages: ['es'],
      })
      const recap = await readProWeekRecap(db, sofia)
      expect(recap).toMatchObject({
        ended: false,
        extended: false,
        extraChats: 0,
        translatedSends: 0,
        languages: ['es'],
      })
    })

    it('is not due before the last day, nor long after the end, nor twice', async () => {
      expect(await readProWeekRecap(db, await weekEnding(48))).toBeNull()
      expect(await readProWeekRecap(db, await weekEnding(-8 * 24))).toBeNull()
      const seen = await weekEnding(12)
      await db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: seen._id }, { $set: { 'proWeek.recapSeenAt': new Date() } })
      const stored = await read(seen._id)
      if (!stored) throw new Error('vanished')
      expect(await readProWeekRecap(db, stored)).toBeNull()
    })

    it('never shows to a subscriber, a free week included, nor to a lifetime', async () => {
      const inAMonth = new Date(Date.now() + 30 * DAY)
      for (const entitlement of [
        { tier: 'pro', store: 'app_store', periodType: 'normal', expiresAt: inAMonth },
        { tier: 'pro', store: 'play_store', periodType: 'trial', expiresAt: inAMonth },
        { tier: 'pro', store: 'promotional' },
      ] as const) {
        const row = await weekEnding(-2, {
          entitlement: { ...entitlement, willRenew: true, updatedAt: new Date() },
        })
        expect(await readProWeekRecap(db, row), entitlement.store).toBeNull()
      }
      // The same week, ended, on the free plan: due.
      expect(await readProWeekRecap(db, await weekEnding(-2))).not.toBeNull()
    })

    it('waits for the gift that actually ends Pro', async () => {
      const sofia = await weekEnding(12)
      await queueProGift(db, {
        _id: proGiftKey.code('summer', sofia._id),
        userId: sofia._id,
        months: 1,
        source: 'code',
      })
      expect(await readProWeekRecap(db, sofia)).toBeNull()
    })
  })
})
