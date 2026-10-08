import { addMonthsUtc } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { translator } from '../../i18n'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import type { Message } from '../chat/conversations'
import { suppressEmail } from '../notifications/suppressions'
import { ensureOfficialAccounts } from '../official/accounts'
import type { OfficialDelivery } from '../official/deliver'
import type { Profile } from '../profiles/profiles'
import { createFakeRevenueCat } from './fakeRevenueCat'
import { giftWelcomeFor } from './proWelcome'
import {
  grantProGiftNow,
  proGiftKey,
  queueProGift,
  runProGiftPass,
  type ProGift,
  type ProGiftDeps,
} from './proGifts'

const DAY = 24 * 60 * 60 * 1000

/**
 * Gifts of Pro, end to end against a real database and the fake store: the
 * row, the grant, the stored entitlement, and what the person is told —
 * and the three ways that could go wrong twice: a double click, two machines,
 * and a retry after a timeout.
 */
describe('gifts of Pro', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let db: Db

  let email: CapturingEmailSender
  let fanned: { delivery: OfficialDelivery; push: boolean }[]
  let grants: { userId: string; endsAt: Date }[]
  let failNext: number
  let warnings: string[]
  let deps: ProGiftDeps

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_pro_gifts_test')
    db = handle.db
    await ensureIndexes(db)
    await ensureOfficialAccounts(db, 'http://localhost:4000')
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
      COLLECTIONS.emailSuppressions,
    ]) {
      await db.collection(name).deleteMany({})
    }
    await ensureOfficialAccounts(db, 'http://localhost:4000')

    email = new CapturingEmailSender()
    fanned = []
    grants = []
    failNext = 0
    warnings = []
    const store = createFakeRevenueCat()
    deps = {
      revenueCat: {
        ...store,
        grantPromotionalEntitlement: async (userId, entitlementId, endsAt) => {
          grants.push({ userId, endsAt })
          if (failNext > 0) {
            failNext--
            throw new Error('RevenueCat is down')
          }
          await store.grantPromotionalEntitlement(userId, entitlementId, endsAt)
        },
      },
      email,
      fanOut: (delivery, { push }) => {
        fanned.push({ delivery, push })
        return Promise.resolve()
      },
      warn: (_error, message) => warnings.push(message),
    }
  })

  async function person(
    opts: { entitlement?: Partial<Profile['entitlement']>; verified?: boolean } = {},
  ): Promise<string> {
    const _id = new ObjectId()
    const userId = _id.toHexString()
    const now = new Date()
    await db
      .collection(COLLECTIONS.user)
      .insertOne({ _id, email: `${userId}@example.com`, emailVerified: opts.verified ?? true })
    await db.collection<Profile>(COLLECTIONS.profiles).insertOne({
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
      entitlement: { tier: 'free', updatedAt: now, ...opts.entitlement },
      quota: { initiations: [], translations: [], media: [] },
      streak: { current: 0, longest: 0, lastQualifiedDay: null },
      stats: { lastActiveAt: now, messagesSent: 0 },
      createdAt: now,
      updatedAt: now,
    })
    return userId
  }

  const gift = (id: string) => db.collection<ProGift>(COLLECTIONS.proGifts).findOne({ _id: id })
  const profile = (id: string) =>
    db.collection<Profile & { proWelcome?: unknown }>(COLLECTIONS.profiles).findOne({ _id: id })
  const messagesTo = async (clientIdPrefix: string) =>
    db
      .collection<Message>(COLLECTIONS.messages)
      .find({ clientId: { $regex: `^${clientIdPrefix}` } })
      .toArray()

  async function adminGift(userId: string, months: number, now = new Date()) {
    return queueProGift(
      db,
      { _id: proGiftKey.admin(userId, now, months), userId, months, source: 'admin' },
      now,
    )
  }

  describe('granting', () => {
    it('grants through RevenueCat, stores the gift and says so in three places', async () => {
      const userId = await person()
      const now = new Date()
      const { gift: row } = await adminGift(userId, 3, now)

      const result = await runProGiftPass(db, deps, now)
      expect(result.sent).toBeGreaterThanOrEqual(1)

      const granted = await gift(row._id)
      expect(granted).toMatchObject({ status: 'granted', attempts: 1 })
      expect(granted?.endsAt).toEqual(addMonthsUtc(now, 3))
      expect(grants).toEqual([{ userId, endsAt: addMonthsUtc(now, 3) }])

      const stored = await profile(userId)
      expect(stored?.entitlement).toMatchObject({ tier: 'pro', store: 'gift', willRenew: false })
      expect(stored?.proWelcome).toMatchObject({ source: 'gift', months: 3 })

      const [message] = await messagesTo(`proGift:${row._id}`)
      // The reader is a Turkish speaker; the letter is in their language.
      // Three paragraphs: why, what Pro opens with "and more" under the list,
      // and until when. The intro leads, because it is also the push preview.
      const t = translator('tr')
      const paragraphs = message?.body.split('\n\n') ?? []
      expect(paragraphs).toHaveLength(3)
      expect(paragraphs[0]).toBe(t('proGift.introAdmin', { count: 3 }))
      expect(paragraphs[1]).toBe(`${t('proGift.perks')}\n${t('proGift.andMore')}`)
      const [, afterDate] = t('proGift.until', { date: '§' }).split('§')
      expect(paragraphs[2]?.endsWith(afterDate ?? '§')).toBe(true)
      expect(fanned).toHaveLength(1)
      expect(fanned[0]?.push).toBe(true)
      expect(email.messages).toHaveLength(1)
      expect(email.messages[0]?.subject).toBe(translator('tr')('email.proGiftSubject'))
    })

    it('treats a double click as the same gift', async () => {
      const userId = await person()
      const now = new Date()
      const first = await adminGift(userId, 1, now)
      const second = await adminGift(userId, 1, now)

      expect(first.created).toBe(true)
      expect(second.created).toBe(false)
      await runProGiftPass(db, deps, now)
      expect(grants).toHaveLength(1)
      expect(await messagesTo('proGift:')).toHaveLength(1)
    })

    it('grants once when both machines run the pass together', async () => {
      const userId = await person()
      const now = new Date()
      await adminGift(userId, 1, now)

      await Promise.all([runProGiftPass(db, deps, now), runProGiftPass(db, deps, now)])
      expect(grants).toHaveLength(1)
      expect(await messagesTo('proGift:')).toHaveLength(1)
    })

    it('asks for the same end on the retry after a failure', async () => {
      const userId = await person()
      const now = new Date()
      const { gift: row } = await adminGift(userId, 1, now)
      failNext = 1

      const first = await runProGiftPass(db, deps, now)
      expect(first.failed).toBe(1)
      const waiting = await gift(row._id)
      expect(waiting?.status).toBe('pending')
      expect(waiting?.lockedUntil.getTime()).toBeGreaterThan(now.getTime())
      expect(waiting?.lockedBy).toBeUndefined()

      // Nothing happens while the backoff runs.
      await runProGiftPass(db, deps, new Date(now.getTime() + 60_000))
      expect(grants).toHaveLength(1)

      const later = new Date(now.getTime() + 60 * 60_000)
      await runProGiftPass(db, deps, later)
      expect(grants).toHaveLength(2)
      expect(grants[1]?.endsAt).toEqual(grants[0]?.endsAt)
      expect((await gift(row._id))?.status).toBe('granted')
    })

    it('stacks a second gift on the end of the first', async () => {
      const userId = await person()
      const now = new Date()
      await adminGift(userId, 1, now)
      await queueProGift(
        db,
        { _id: proGiftKey.streak(365, userId), userId, months: 3, source: 'streak' },
        now,
      )

      await runProGiftPass(db, deps, now)
      expect(grants.map((g) => g.endsAt)).toEqual([
        addMonthsUtc(now, 1),
        addMonthsUtc(addMonthsUtc(now, 1), 3),
      ])
    })

    it('gives the streak week a week, and says so in weeks', async () => {
      const userId = await person()
      const now = new Date()
      const { gift: row } = await queueProGift(
        db,
        { _id: proGiftKey.streak(7, userId), userId, months: 0, weeks: 1, source: 'streak' },
        now,
      )

      await runProGiftPass(db, deps, now)
      expect(grants.map((g) => g.endsAt)).toEqual([new Date(now.getTime() + 7 * DAY)])

      const [message] = await messagesTo(`proGift:${row._id}`)
      expect(message?.body).toContain(
        translator('tr')('proGift.introStreakWeeks', { count: 1, days: 7 }),
      )
      // No month count: the welcome falls back to the title without a length.
      const welcome = (await profile(userId))?.proWelcome
      expect(welcome).toMatchObject({ source: 'streak' })
      expect(welcome?.months).toBeUndefined()
    })

    it('gives nothing on top of a lifetime', async () => {
      const userId = await person({ entitlement: { tier: 'pro', store: 'promotional' } })
      const { gift: row } = await adminGift(userId, 1)

      const result = await runProGiftPass(db, deps)
      expect(result.skipped).toBe(1)
      expect(await gift(row._id)).toMatchObject({ status: 'skipped', skippedReason: 'lifetime' })
      expect(grants).toHaveLength(0)
    })

    it('tells a subscriber the gift does not stop their billing', async () => {
      const userId = await person({
        entitlement: {
          tier: 'pro',
          store: 'app_store',
          willRenew: true,
          expiresAt: new Date(Date.now() + 10 * DAY),
        },
      })
      const { gift: row } = await adminGift(userId, 1)
      await grantProGiftNow(db, deps, row._id)

      const [message] = await messagesTo(`proGift:${row._id}`)
      const [before] = translator('tr')('proGift.untilPaying', { date: '§' }).split('§')
      expect(message?.body).toContain(before)

      // No free→Pro edge here, so the gift leaves its own welcome.
      expect((await profile(userId))?.proWelcome).toMatchObject({ source: 'gift', months: 1 })
    })

    /**
     * From free, the refresh crosses the edge and `welcomeIfBecamePro` writes
     * the welcome — through `giftWelcomeFor`, which reads this row. The gift
     * must not write a second one on top: counted on the change stream,
     * because a second write of the same shape is otherwise invisible.
     */
    it('leaves one welcome from free, written by the edge, titled by the gift', async () => {
      const userId = await person()
      const stream = db
        .collection(COLLECTIONS.profiles)
        .watch([
          { $match: { 'documentKey._id': userId, operationType: 'update' } },
          { $match: { 'updateDescription.updatedFields.proWelcome': { $exists: true } } },
        ])
      const writes: unknown[] = []
      stream.on('change', (change) => writes.push(change))
      await new Promise((resolve) => setTimeout(resolve, 200))

      await queueProGift(
        db,
        { _id: proGiftKey.streak(100, userId), userId, months: 1, source: 'streak' },
        new Date(),
      )
      await runProGiftPass(db, deps)
      await new Promise((resolve) => setTimeout(resolve, 500))
      await stream.close()

      expect(writes).toHaveLength(1)
      expect((await profile(userId))?.proWelcome).toMatchObject({ source: 'streak', months: 1 })
    })

    it('writes no mail to an unproved or suppressed address', async () => {
      const unproved = await person({ verified: false })
      const suppressed = await person()
      await suppressEmail(db, { email: `${suppressed}@example.com`, reason: 'complained' })
      await adminGift(unproved, 1)
      await adminGift(suppressed, 1)

      await runProGiftPass(db, deps)
      expect(await messagesTo('proGift:')).toHaveLength(2)
      expect(email.messages).toHaveLength(0)
    })
  })

  describe('reminders and the end', () => {
    async function granted(
      userId: string,
      endsAt: Date,
      extra: Partial<ProGift> = {},
    ): Promise<ProGift> {
      const row: ProGift = {
        _id: `admin:${userId}:${endsAt.toISOString()}:1`,
        userId,
        months: 1,
        source: 'admin',
        status: 'granted',
        endsAt,
        lockedUntil: new Date(0),
        attempts: 1,
        createdAt: new Date(endsAt.getTime() - 30 * DAY),
        grantedAt: new Date(endsAt.getTime() - 30 * DAY),
        ...extra,
      }
      await db.collection<ProGift>(COLLECTIONS.proGifts).insertOne(row)
      return row
    }

    const giftEntitlement = (endsAt: Date): Partial<Profile['entitlement']> => ({
      tier: 'pro',
      store: 'gift',
      willRenew: false,
      expiresAt: endsAt,
    })

    it('a week out: a note and a mail, no knock, once', async () => {
      const now = new Date()
      const endsAt = new Date(now.getTime() + 5 * DAY)
      const userId = await person({ entitlement: giftEntitlement(endsAt) })
      const row = await granted(userId, endsAt)

      await runProGiftPass(db, deps, now)
      await runProGiftPass(db, deps, now)

      expect(await messagesTo(`proGiftReminder:week:${row._id}`)).toHaveLength(1)
      expect(fanned.map((f) => f.push)).toEqual([false])
      expect(email.messages).toHaveLength(1)
      expect((await gift(row._id))?.remindedAt?.week).toBeDefined()
    })

    it('the day before: a note with a knock, and the week note is not sent late', async () => {
      const now = new Date()
      const endsAt = new Date(now.getTime() + 20 * 60 * 60 * 1000)
      const userId = await person({ entitlement: giftEntitlement(endsAt) })
      const row = await granted(userId, endsAt)

      await runProGiftPass(db, deps, now)

      expect(await messagesTo(`proGiftReminder:day:${row._id}`)).toHaveLength(1)
      expect(await messagesTo(`proGiftReminder:week:${row._id}`)).toHaveLength(0)
      expect(fanned.map((f) => f.push)).toEqual([true])
      expect(email.messages).toHaveLength(0)
    })

    /** Granted already inside the week window: "ends in a week" would follow "here is a week". */
    it('sends a week-long gift no week note, but the day-before one', async () => {
      const grantedAt = new Date()
      const endsAt = new Date(grantedAt.getTime() + 7 * DAY)
      const userId = await person({ entitlement: giftEntitlement(endsAt) })
      const row = await granted(userId, endsAt, {
        _id: proGiftKey.streak(7, userId),
        months: 0,
        weeks: 1,
        source: 'streak',
        createdAt: grantedAt,
        grantedAt,
      })

      await runProGiftPass(db, deps, new Date(grantedAt.getTime() + 60 * 60 * 1000))
      expect(await messagesTo('proGiftReminder:')).toHaveLength(0)
      expect(email.messages).toHaveLength(0)

      await runProGiftPass(db, deps, new Date(endsAt.getTime() - 20 * 60 * 60 * 1000))
      expect(await messagesTo(`proGiftReminder:day:${row._id}`)).toHaveLength(1)
    })

    it('says nothing about an end a later gift has moved', async () => {
      const now = new Date()
      const endsAt = new Date(now.getTime() + 5 * DAY)
      const userId = await person({ entitlement: giftEntitlement(endsAt) })
      await granted(userId, endsAt)
      await granted(userId, new Date(endsAt.getTime() + 30 * DAY))

      await runProGiftPass(db, deps, now)
      expect(await messagesTo('proGiftReminder:')).toHaveLength(0)
    })

    it('says nothing to somebody who has started paying meanwhile', async () => {
      const now = new Date()
      const endsAt = new Date(now.getTime() + 5 * DAY)
      const userId = await person({
        entitlement: {
          tier: 'pro',
          store: 'play_store',
          willRenew: true,
          expiresAt: new Date(now.getTime() + 25 * DAY),
        },
      })
      await granted(userId, endsAt)

      await runProGiftPass(db, deps, now)
      expect(await messagesTo('proGiftReminder:')).toHaveLength(0)
    })

    it('at the end: refreshes to free and thanks them once', async () => {
      const now = new Date()
      const endsAt = new Date(now.getTime() - 60_000)
      const userId = await person({ entitlement: giftEntitlement(endsAt) })
      const row = await granted(userId, endsAt, {
        remindedAt: { week: new Date(), day: new Date() },
      })

      await runProGiftPass(db, deps, now)
      await runProGiftPass(db, deps, now)

      expect(await messagesTo(`proGiftEnded:${row._id}`)).toHaveLength(1)
      expect((await profile(userId))?.entitlement.tier).toBe('free')
      expect((await gift(row._id))?.endedNotifiedAt).toBeDefined()
    })

    it('does not say "ended" while Pro carries on', async () => {
      const now = new Date()
      const endsAt = new Date(now.getTime() - 60_000)
      const userId = await person({ entitlement: giftEntitlement(endsAt) })
      await deps.revenueCat.grantLifetimeEntitlement(userId, 'pro')
      await granted(userId, endsAt, { remindedAt: { week: new Date(), day: new Date() } })

      await runProGiftPass(db, deps, now)
      expect(await messagesTo('proGiftEnded:')).toHaveLength(0)
    })
  })
})

describe('giftWelcomeFor', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_gift_welcome_test')
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  const row = (over: Partial<ProGift>): ProGift => ({
    _id: 'x',
    userId: 'u1',
    months: 1,
    source: 'admin',
    status: 'granted',
    endsAt: new Date(),
    lockedUntil: new Date(0),
    attempts: 1,
    createdAt: new Date(),
    grantedAt: new Date(),
    ...over,
  })

  it('is a plain gift when no row explains the grant', async () => {
    expect(await giftWelcomeFor(handle.db, 'nobody')).toEqual({ source: 'gift' })
  })

  it('reads the newest granted row, not a pending one', async () => {
    await handle.db
      .collection<ProGift>(COLLECTIONS.proGifts)
      .insertMany([
        row({ _id: 'a', source: 'admin', months: 6, grantedAt: new Date('2026-01-01') }),
        row({ _id: 'b', source: 'referral', months: 1, grantedAt: new Date('2026-09-01') }),
        row({ _id: 'c', source: 'streak', months: 3, status: 'pending' }),
      ])
    expect(await giftWelcomeFor(handle.db, 'u1')).toEqual({ source: 'referral', months: 1 })
  })
})
