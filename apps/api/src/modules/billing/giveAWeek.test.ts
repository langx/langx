import {
  DEFAULT_APP_CONFIG,
  PRO_GIFT_RULES,
  TOKEN_RULES,
  referralWeekSlotsPerYear,
} from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { translator } from '../../i18n'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { invalidateAppConfigCache, updateAppConfig } from '../appConfig/appConfig'
import type { Message } from '../chat/conversations'
import { ensureOfficialAccounts } from '../official/accounts'
import type { Profile } from '../profiles/profiles'
import type { Referral } from '../referrals/referrals'
import { settleReferral } from '../referrals/settle'
import { createFakeRevenueCat } from './fakeRevenueCat'
import { queueReferralWeek } from './proGiftRewards'
import {
  isDuplicateOf,
  proGiftKey,
  queueProGift,
  runProGiftPass,
  type ProGift,
  type ProGiftDeps,
} from './proGifts'

const DAY = 24 * 60 * 60 * 1000
const WEEK = 7 * DAY

/**
 * "Give a week, get a week" (`flags.giveAWeek`): what an activation earns
 * while the switch is on, what it earns while it is off, and that each week
 * is given once, inside the yearly cap, stacked on whatever Pro is already
 * running — from the settle that a message send reaches through to the
 * letter @langx writes.
 */
describe('give a week, get a week', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let db: Db
  let deps: ProGiftDeps

  const now = new Date()
  const year = now.getUTCFullYear()

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_give_a_week_test')
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
      COLLECTIONS.session,
      COLLECTIONS.devices,
      COLLECTIONS.proGifts,
      COLLECTIONS.referrals,
      COLLECTIONS.tokenLedger,
      COLLECTIONS.tokenAggregates,
      COLLECTIONS.conversations,
      COLLECTIONS.messages,
      COLLECTIONS.appConfig,
    ]) {
      await db.collection(name).deleteMany({})
    }
    invalidateAppConfigCache()
    await ensureOfficialAccounts(db, 'http://localhost:4000')

    const store = createFakeRevenueCat()
    deps = {
      revenueCat: store,
      email: new CapturingEmailSender(),
      fanOut: () => Promise.resolve(),
      warn: () => {},
    }
  })

  async function giveAWeek(on: boolean) {
    await updateAppConfig(db, { flags: { ...DEFAULT_APP_CONFIG.flags, giveAWeek: on } })
  }

  async function person(overrides: Partial<Profile> = {}): Promise<Profile> {
    const _id = new ObjectId()
    const userId = _id.toHexString()
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

  /**
   * An invitee one message away from activation: a referral row, and the
   * two-way conversation with somebody else that activation reads.
   */
  async function readyInvitee(referrerId: string, overrides: Partial<Profile> = {}) {
    const invitee = await person({ referredBy: referrerId, ...overrides })
    await db.collection<Referral>(COLLECTIONS.referrals).insertOne({
      _id: invitee._id,
      referrerId,
      referrerHandle: 'ref',
      source: 'link',
      createdAt: now,
    })
    const conversationId = new ObjectId()
    const participants = [invitee._id, new ObjectId().toHexString()].sort()
    await db.collection(COLLECTIONS.conversations).insertOne({
      _id: conversationId,
      participants,
      pairKey: participants.join(':'),
      bothSpoke: true,
    })
    await db.collection(COLLECTIONS.tokenLedger).insertOne({
      userId: invitee._id,
      kind: 'message',
      amount: 5,
      refId: `mutual:${conversationId.toHexString()}`,
      createdAt: now,
    })
    return invitee._id
  }

  /** Activations already on the record this year, under the old rule unless told otherwise. */
  async function activated(referrerId: string, count: number, fields: Partial<Referral> = {}) {
    for (let i = 0; i < count; i++) {
      await db.collection<Referral>(COLLECTIONS.referrals).insertOne({
        _id: new ObjectId().toHexString(),
        referrerId,
        referrerHandle: 'ref',
        source: 'link',
        createdAt: now,
        activatedAt: now,
        ...fields,
      })
    }
  }

  /** Slots of the referrer's year already taken by earlier activations. */
  async function weeksTaken(referrerId: string, count: number, inYear = year) {
    for (let slot = 1; slot <= count; slot++) {
      await queueProGift(
        db,
        {
          _id: proGiftKey.referralWeek(referrerId, inYear, slot),
          userId: referrerId,
          months: 0,
          weeks: 1,
          source: 'referral',
          invitee: new ObjectId().toHexString(),
        },
        now,
      )
    }
  }

  const giftsOf = (userId: string) =>
    db.collection<ProGift>(COLLECTIONS.proGifts).find({ userId }).sort({ _id: 1 }).toArray()
  const referralOf = (inviteeId: string) =>
    db.collection<Referral>(COLLECTIONS.referrals).findOne({ _id: inviteeId })
  const letter = async (giftId: string) =>
    (
      await db.collection<Message>(COLLECTIONS.messages).findOne({ clientId: `proGift:${giftId}` })
    )?.body.split('\n\n') ?? []

  describe('with the switch off', () => {
    it('rewards exactly as before: a month for every third, nothing for the friend', async () => {
      const referrer = await person()
      await activated(referrer._id, 2)
      const inviteeId = await readyInvitee(referrer._id)

      await settleReferral(db, inviteeId, now)

      const gifts = await giftsOf(referrer._id)
      expect(gifts.map((g) => [g._id, g.months, g.weeks ?? 0])).toEqual([
        [proGiftKey.referral(referrer._id, year, 1), PRO_GIFT_RULES.referral.monthsPerGift, 0],
      ])
      expect(gifts[0]?.invitee).toBeUndefined()
      expect(await giftsOf(inviteeId)).toHaveLength(0)
      const referral = await referralOf(inviteeId)
      expect(referral?.activatedAt).toBeDefined()
      expect(referral?.proReward).toBeUndefined()
    })

    /** Unset reads as off: a deployment whose stored flags predate the switch. */
    it('is off when the stored config has never heard of it', async () => {
      await db
        .collection<{ _id: string; [field: string]: unknown }>(COLLECTIONS.appConfig)
        .insertOne({
          _id: 'current',
          maintenance: DEFAULT_APP_CONFIG.maintenance,
          minVersion: DEFAULT_APP_CONFIG.minVersion,
          flags: { translationEnabled: true, discoveryEnabled: true, signupsEnabled: true },
          updatedAt: now,
        })
      invalidateAppConfigCache()
      const referrer = await person()
      const inviteeId = await readyInvitee(referrer._id)

      await settleReferral(db, inviteeId, now)
      expect(await giftsOf(referrer._id)).toHaveLength(0)
      expect(await giftsOf(inviteeId)).toHaveLength(0)
    })

    /**
     * An activation that earned a week has had its gift. Two of them plus the
     * one settling now would complete a month if the old count saw them.
     */
    it('does not count a week activation towards a month', async () => {
      const referrer = await person()
      await activated(referrer._id, 2, { proReward: 'week' })
      const inviteeId = await readyInvitee(referrer._id)

      await settleReferral(db, inviteeId, now)
      expect(await giftsOf(referrer._id)).toHaveLength(0)
    })
  })

  describe('with the switch on', () => {
    beforeEach(() => giveAWeek(true))

    it('gives a week each, and no month', async () => {
      const referrer = await person()
      await activated(referrer._id, 2)
      const inviteeId = await readyInvitee(referrer._id)

      await settleReferral(db, inviteeId, now)

      expect(await giftsOf(referrer._id)).toMatchObject([
        {
          _id: proGiftKey.referralWeek(referrer._id, year, 1),
          months: 0,
          weeks: PRO_GIFT_RULES.giveAWeek.referrerWeeks,
          source: 'referral',
          invitee: inviteeId,
          status: 'pending',
        },
      ])
      expect(await giftsOf(inviteeId)).toMatchObject([
        {
          _id: proGiftKey.invitedWeek(inviteeId),
          months: 0,
          weeks: PRO_GIFT_RULES.giveAWeek.inviteeWeeks,
          source: 'referral',
          invitee: inviteeId,
        },
      ])
      // The tokens are untouched: the week replaces the month, not the award.
      const referral = await referralOf(inviteeId)
      expect(referral).toMatchObject({
        proReward: 'week',
        activationAward: TOKEN_RULES.referral.activation,
      })
    })

    it('gives one week per activation, however many times it settles', async () => {
      const referrer = await person()
      const inviteeId = await readyInvitee(referrer._id)

      await Promise.all([
        settleReferral(db, inviteeId, now),
        settleReferral(db, inviteeId, now),
        settleReferral(db, inviteeId, now),
      ])
      // A crash between the gifts and the latch: the next settle runs it all again.
      await db
        .collection<Referral>(COLLECTIONS.referrals)
        .updateOne({ _id: inviteeId }, { $unset: { activatedAt: '' } })
      await settleReferral(db, inviteeId, now)

      expect(await giftsOf(referrer._id)).toHaveLength(1)
      expect(await giftsOf(inviteeId)).toHaveLength(1)
    })

    it('refuses a second week for one activation in another slot', async () => {
      const referrer = await person()
      const inviteeId = new ObjectId().toHexString()
      expect(await queueReferralWeek(db, referrer._id, inviteeId, now)).toBe('queued')

      // The index, not the read in front of it, is what holds.
      const second = queueProGift(
        db,
        {
          _id: proGiftKey.referralWeek(referrer._id, year, 2),
          userId: referrer._id,
          months: 0,
          weeks: 1,
          source: 'referral',
          invitee: inviteeId,
        },
        now,
      )
      const error: unknown = await second.then(
        () => null,
        (e: unknown) => e,
      )
      expect(isDuplicateOf(error, 'invitee')).toBe(true)
      expect(await queueReferralWeek(db, referrer._id, inviteeId, now)).toBe('already')
      expect(await giftsOf(referrer._id)).toHaveLength(1)
    })

    it('holds the yearly cap when activations race for the last week', async () => {
      const slots = referralWeekSlotsPerYear()
      const referrer = await person()
      await weeksTaken(referrer._id, slots - 1)
      const invitees = [
        await readyInvitee(referrer._id),
        await readyInvitee(referrer._id),
        await readyInvitee(referrer._id),
      ]

      await Promise.all(invitees.map((id) => settleReferral(db, id, now)))

      const weeks = await giftsOf(referrer._id)
      expect(weeks).toHaveLength(slots)
      expect(weeks.reduce((sum, g) => sum + (g.weeks ?? 0), 0)).toBeLessThanOrEqual(
        PRO_GIFT_RULES.giveAWeek.maxReferrerWeeksPerYear,
      )
      const last = weeks.find((g) => g._id === proGiftKey.referralWeek(referrer._id, year, slots))
      expect(invitees).toContain(last?.invitee)
      // Every friend still gets theirs: the cap is the referrer's.
      for (const id of invitees) expect(await giftsOf(id)).toHaveLength(1)
      expect(await queueReferralWeek(db, referrer._id, 'somebody-new', now)).toBe('capped')
    })

    it('opens the cap again with the calendar year', async () => {
      const referrer = await person()
      await weeksTaken(referrer._id, referralWeekSlotsPerYear(), year - 1)
      const inviteeId = await readyInvitee(referrer._id)

      await settleReferral(db, inviteeId, now)
      const thisYear = (await giftsOf(referrer._id)).filter((g) => g.invitee === inviteeId)
      expect(thisYear.map((g) => g._id)).toEqual([proGiftKey.referralWeek(referrer._id, year, 1)])
    })

    it('gives a frozen referrer nothing, and their friend a week', async () => {
      const referrer = await person({ tokenFrozenAt: now })
      const inviteeId = await readyInvitee(referrer._id)

      await settleReferral(db, inviteeId, now)
      expect(await giftsOf(referrer._id)).toHaveLength(0)
      expect(await giftsOf(inviteeId)).toHaveLength(1)
    })

    it('past the monthly limit: the friend’s week, not the referrer’s', async () => {
      const referrer = await person()
      await activated(referrer._id, 10)
      const inviteeId = await readyInvitee(referrer._id)

      await settleReferral(db, inviteeId, now)
      expect((await referralOf(inviteeId))?.unpaidReason).toBe('monthlyLimit')
      expect(await giftsOf(referrer._id)).toHaveLength(0)
      expect(await giftsOf(inviteeId)).toHaveLength(1)
    })

    it('gives neither side a week across a shared network', async () => {
      const referrer = await person()
      const inviteeId = await readyInvitee(referrer._id)
      for (const userId of [referrer._id, inviteeId]) {
        await db.collection(COLLECTIONS.session).insertOne({
          userId: new ObjectId(userId),
          token: new ObjectId().toHexString(),
          ipAddress: '203.0.113.7',
        })
      }

      await settleReferral(db, inviteeId, now)
      expect((await referralOf(inviteeId))?.unpaidReason).toBe('sharedNetwork')
      expect(await giftsOf(referrer._id)).toHaveLength(0)
      expect(await giftsOf(inviteeId)).toHaveLength(0)
    })

    /** A guest has no account to activate, so nothing is ever given for one. */
    it('gives nothing for a guest', async () => {
      const referrer = await person()
      const inviteeId = await readyInvitee(referrer._id, { guest: true })

      await settleReferral(db, inviteeId, now)
      expect(await giftsOf(referrer._id)).toHaveLength(0)
      expect(await giftsOf(inviteeId)).toHaveLength(0)
    })

    /** The referral rules have no age rule; a week follows them. */
    it('treats a 16-year-old like anyone else', async () => {
      const birthDate = `${year - 16}-01-01`
      const referrer = await person({ birthDate })
      const inviteeId = await readyInvitee(referrer._id, { birthDate })

      await settleReferral(db, inviteeId, now)
      expect(await giftsOf(referrer._id)).toHaveLength(1)
      expect(await giftsOf(inviteeId)).toHaveLength(1)
    })
  })

  describe('an activation keeps the rule it started under', () => {
    it('finishes a week after the switch goes off', async () => {
      const referrer = await person()
      await activated(referrer._id, 2)
      const inviteeId = await readyInvitee(referrer._id)
      // A settle that chose the week and crashed before giving it.
      await db
        .collection<Referral>(COLLECTIONS.referrals)
        .updateOne({ _id: inviteeId }, { $set: { proReward: 'week' } })
      await giveAWeek(false)

      await settleReferral(db, inviteeId, now)
      expect((await giftsOf(referrer._id)).map((g) => g._id)).toEqual([
        proGiftKey.referralWeek(referrer._id, year, 1),
      ])
      expect(await giftsOf(inviteeId)).toHaveLength(1)
    })

    it('never takes back a month already given', async () => {
      const referrer = await person()
      await activated(referrer._id, 2)
      await settleReferral(db, await readyInvitee(referrer._id), now)
      const month = proGiftKey.referral(referrer._id, year, 1)
      expect((await giftsOf(referrer._id)).map((g) => g._id)).toEqual([month])

      await giveAWeek(true)
      await settleReferral(db, await readyInvitee(referrer._id), now)
      expect((await giftsOf(referrer._id)).map((g) => g._id)).toEqual([
        month,
        proGiftKey.referralWeek(referrer._id, year, 1),
      ])
    })
  })

  describe('granting', () => {
    beforeEach(() => giveAWeek(true))

    it('stacks a week on the gift already running, and a second week on the first', async () => {
      const referrer = await person()
      const running = new Date(now.getTime() + 30 * DAY)
      await db.collection<ProGift>(COLLECTIONS.proGifts).insertOne({
        _id: proGiftKey.admin(referrer._id, now, 1),
        userId: referrer._id,
        months: 1,
        source: 'admin',
        status: 'granted',
        endsAt: running,
        lockedUntil: now,
        attempts: 1,
        createdAt: now,
        grantedAt: now,
      })

      await settleReferral(db, await readyInvitee(referrer._id), now)
      await runProGiftPass(db, deps, now)
      await settleReferral(db, await readyInvitee(referrer._id), now)
      await runProGiftPass(db, deps, now)

      const weeks = (await giftsOf(referrer._id)).filter((g) => g.invitee)
      expect(weeks.map((g) => [g.status, g.endsAt?.getTime()])).toEqual([
        ['granted', running.getTime() + WEEK],
        ['granted', running.getTime() + 2 * WEEK],
      ])
    })

    it('tells each side why, in a letter that sells nothing', async () => {
      const referrer = await person()
      const inviteeId = await readyInvitee(referrer._id)
      await settleReferral(db, inviteeId, now)
      await runProGiftPass(db, deps, now)

      // Both are Spanish speakers, so both letters are in Spanish.
      const t = translator('es')
      const [forReferrer, perksA, untilA] = await letter(
        proGiftKey.referralWeek(referrer._id, year, 1),
      )
      expect(forReferrer).toBe(t('proGift.introReferralWeeks', { count: 1 }))
      const [forFriend, perksB, untilB] = await letter(proGiftKey.invitedWeek(inviteeId))
      expect(forFriend).toBe(t('proGift.introInvitedWeeks', { count: 1 }))
      // The rest is the gift letter every door sends: what Pro opens, and
      // until when — a record of what was given, not an offer.
      for (const [perks, until] of [
        [perksA, untilA],
        [perksB, untilB],
      ]) {
        expect(perks).toBe(`${t('proGift.perks')}\n${t('proGift.andMore')}`)
        const [, afterDate] = t('proGift.until', { date: '§' }).split('§')
        expect(until?.endsWith(afterDate ?? '§')).toBe(true)
      }
    })

    /**
     * A promotional grant runs beside a store subscription rather than after
     * it, so a subscriber's week would change nothing: it is skipped, and
     * still takes its slot. Their friend's week is the friend's, and is given.
     */
    it('skips a subscriber’s week and still gives their friend one', async () => {
      const referrer = await person({
        entitlement: {
          tier: 'pro',
          store: 'app_store',
          willRenew: true,
          expiresAt: new Date(now.getTime() + 20 * DAY),
          updatedAt: now,
        },
      })
      const inviteeId = await readyInvitee(referrer._id)
      await settleReferral(db, inviteeId, now)
      await runProGiftPass(db, deps, now)

      expect(await giftsOf(referrer._id)).toMatchObject([
        { status: 'skipped', skippedReason: 'subscribed' },
      ])
      expect(await giftsOf(inviteeId)).toMatchObject([{ status: 'granted' }])
    })

    it('skips a lifetime referrer’s week and still gives their friend one', async () => {
      const referrer = await person({
        entitlement: { tier: 'pro', store: 'promotional', updatedAt: now },
      })
      const inviteeId = await readyInvitee(referrer._id)
      await settleReferral(db, inviteeId, now)
      await runProGiftPass(db, deps, now)

      expect(await giftsOf(referrer._id)).toMatchObject([
        { status: 'skipped', skippedReason: 'lifetime' },
      ])
      expect(await giftsOf(inviteeId)).toMatchObject([{ status: 'granted' }])
    })
  })
})
