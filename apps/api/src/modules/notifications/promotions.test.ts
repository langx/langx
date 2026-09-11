import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { NotificationEmailContext } from '../../email/notify'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { LoggingPushSender } from '../push/devices'
import { claimCampaignRecipients } from './campaign'
import { runPromotionsPass } from './promotions'

const SECRET = 'p'.repeat(40)
const DAY = 24 * 60 * 60 * 1000
/** 12:00 UTC, so UTC is inside the reader's waking hours. */
const NOW = new Date('2026-09-14T12:00:00Z')

describe('the nudges that need permission', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let email: CapturingEmailSender
  let push: LoggingPushSender
  let senders: { email: NotificationEmailContext; push: LoggingPushSender }

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'promotions_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.devices,
      COLLECTIONS.notificationLedger,
      COLLECTIONS.emailCampaigns,
      COLLECTIONS.referrals,
      COLLECTIONS.tokenLedger,
      COLLECTIONS.tokenAggregates,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    email = new CapturingEmailSender()
    push = new LoggingPushSender()
    senders = {
      email: { sender: email, unsubscribeSecret: SECRET, apiBaseUrl: 'https://api.langx.io' },
      push,
    }
  })

  async function newProfile(
    opts: {
      avatar?: boolean
      createdDaysAgo?: number
      activeDaysAgo?: number
      notifications?: unknown
      streak?: { current: number; lastQualifiedDay: string | null }
      earned?: number
      spent?: number
      timezone?: string
      device?: boolean
      entitlement?: Record<string, unknown>
      churnedFrom?: { tier: string; at: Date }
      /** Kills the invite nudge, which every long-standing account qualifies for. */
      invited?: boolean
    } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(-10)}`,
      displayName: 'Sofia R.',
      timezone: opts.timezone ?? 'UTC',
      ...(opts.avatar ? { avatarUrl: 'https://media.langx.io/a.png' } : {}),
      settings: {
        discoverable: true,
        notifications: opts.notifications ?? { promotions: { push: true, email: true } },
      },
      nativeLanguages: [{ code: 'en' }],
      streak: opts.streak ?? { current: 0, longest: 0, lastQualifiedDay: null },
      stats: {
        lastActiveAt: new Date(NOW.getTime() - (opts.activeDaysAgo ?? 0) * DAY),
        messagesSent: 1,
      },
      ...(opts.spent ? { tokenSpent: opts.spent } : {}),
      ...(opts.entitlement ? { entitlement: opts.entitlement } : {}),
      ...(opts.churnedFrom ? { churnedFrom: opts.churnedFrom } : {}),
      createdAt: new Date(NOW.getTime() - (opts.createdDaysAgo ?? 40) * DAY),
    } as never)
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: `${userId}@example.com`,
      emailVerified: true,
    })
    if (opts.earned) {
      await handle.db.collection(COLLECTIONS.tokenAggregates).insertOne({
        _id: `${userId}:all:all`,
        userId,
        periodType: 'all',
        periodKey: 'all',
        tokens: opts.earned,
        updatedAt: NOW,
      } as never)
    }
    if (opts.invited) {
      await handle.db
        .collection(COLLECTIONS.referrals)
        .insertOne({ _id: `invitee-${userId}`, referrerId: userId, createdAt: NOW } as never)
    }
    if (opts.device) {
      await handle.db.collection(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: `ExponentPushToken[${userId.slice(-12)}]`,
        platform: 'ios',
        locale: 'en',
        createdAt: NOW,
        updatedAt: NOW,
      })
    }
    return userId
  }

  const subjects = () => email.messages.map((message) => message.subject)

  it('asks for a photo from an account two days old that has none', async () => {
    await newProfile({ createdDaysAgo: 3 })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(subjects()[0]).toContain('photo')
  })

  /**
   * Since the default opts people in, "no" has to be said — and when it is,
   * it is final. The bare `false` is the oldest shape and still means
   * silence everywhere.
   */
  it('says nothing to somebody who turned promotions off', async () => {
    await newProfile({ createdDaysAgo: 3, notifications: { promotions: { email: false } } })
    await newProfile({ createdDaysAgo: 3, notifications: false })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  /** One thing at a time; the cap keeps the next one a week away. */
  it('sends one nudge to somebody eligible for several', async () => {
    await newProfile({ createdDaysAgo: 3, activeDaysAgo: 7 })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(email.messages).toHaveLength(1)
    // And the same tick again finds them inside the gap.
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('respects the marketing gap a campaign already used up', async () => {
    const userId = await newProfile({ createdDaysAgo: 3 })
    await claimCampaignRecipients(handle.db, 'launch', [userId], new Date(NOW.getTime() - 2 * DAY))
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('waits for waking hours on the reader’s own clock', async () => {
    // 12:00 UTC is 03:00 in Anchorage, which is not a time to be nudged.
    await newProfile({ createdDaysAgo: 3, timezone: 'America/Anchorage' })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('offers the repair the day after a real streak broke, and only then', async () => {
    await newProfile({
      avatar: true,
      streak: { current: 9, lastQualifiedDay: '2026-09-13' },
      notifications: { streak: { push: true, email: true } },
    })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(subjects()[0]).toContain('9')

    // A streak of two is not worth a letter, and neither is one that broke a
    // week ago.
    email.messages.length = 0
    await handle.db.collection(COLLECTIONS.notificationLedger).deleteMany({})
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await newProfile({
      avatar: true,
      invited: true,
      streak: { current: 2, lastQualifiedDay: '2026-09-13' },
    })
    await newProfile({
      avatar: true,
      invited: true,
      streak: { current: 9, lastQualifiedDay: '2026-09-01' },
    })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('writes about tokens nobody has spent, and not about a small balance', async () => {
    await newProfile({ avatar: true, invited: true, earned: 900, spent: 100 })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(subjects()[0]).toContain('800')

    email.messages.length = 0
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await handle.db.collection(COLLECTIONS.notificationLedger).deleteMany({})
    await newProfile({ avatar: true, invited: true, earned: 150 })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('does not write about tokens somebody just spent', async () => {
    const userId = await newProfile({ avatar: true, invited: true, earned: 900 })
    await handle.db.collection(COLLECTIONS.tokenLedger).insertOne({
      userId,
      kind: 'spend',
      amount: -50,
      day: '2026-09-13',
      week: '2026-W37',
      month: '2026-09',
      createdAt: new Date(NOW.getTime() - 2 * DAY),
    })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  /**
   * The cell that made this letter writable at all: a trial ending and a
   * subscription ending are otherwise the same three fields, and before
   * `periodType` existed this would have gone to paying subscribers.
   */
  it('warns about a trial that ends in two days, and nobody else', async () => {
    await newProfile({
      avatar: true,
      invited: true,
      entitlement: {
        tier: 'pro',
        periodType: 'trial',
        willRenew: false,
        expiresAt: new Date(NOW.getTime() + 1.5 * DAY),
        updatedAt: NOW,
      },
    })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(subjects()[0]).toContain('free week')

    email.messages.length = 0
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await handle.db.collection(COLLECTIONS.notificationLedger).deleteMany({})
    // A paying subscriber whose plan ends on the same day.
    await newProfile({
      avatar: true,
      invited: true,
      entitlement: {
        tier: 'pro',
        periodType: 'normal',
        willRenew: false,
        expiresAt: new Date(NOW.getTime() + 1.5 * DAY),
        updatedAt: NOW,
      },
    })
    // A trial that converts on its own — the store will charge the card, and
    // saying so is the store's job.
    await newProfile({
      avatar: true,
      invited: true,
      entitlement: {
        tier: 'pro',
        periodType: 'trial',
        willRenew: true,
        expiresAt: new Date(NOW.getTime() + 1.5 * DAY),
        updatedAt: NOW,
      },
    })
    // And one RevenueCat never labelled: silence is the right answer to a
    // question nobody can answer.
    await newProfile({
      avatar: true,
      invited: true,
      entitlement: {
        tier: 'pro',
        willRenew: false,
        expiresAt: new Date(NOW.getTime() + 1.5 * DAY),
        updatedAt: NOW,
      },
    })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('asks somebody back a week after their plan ended, once', async () => {
    await newProfile({
      avatar: true,
      invited: true,
      churnedFrom: { tier: 'pro', at: new Date(NOW.getTime() - 7.5 * DAY) },
    })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(subjects()[0]).toContain('ended')

    // The same person tomorrow is outside the window, and the claim holds
    // besides.
    expect(await runPromotionsPass(handle.db, senders, new Date(NOW.getTime() + DAY))).toEqual({
      sent: 0,
    })
  })

  it('says nothing to somebody who churned and came back', async () => {
    await newProfile({
      avatar: true,
      invited: true,
      churnedFrom: { tier: 'pro', at: new Date(NOW.getTime() - 7.5 * DAY) },
      entitlement: { tier: 'pro', willRenew: true, updatedAt: NOW },
    })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('asks for an invite from somebody who stayed and has invited nobody', async () => {
    const userId = await newProfile({ avatar: true })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(subjects()[0]).toContain('Practising')

    email.messages.length = 0
    await handle.db.collection(COLLECTIONS.notificationLedger).deleteMany({})
    await handle.db.collection(COLLECTIONS.referrals).insertOne({
      _id: 'someone-else',
      referrerId: userId,
      createdAt: NOW,
    } as never)
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('buzzes the phone too, under the same switch', async () => {
    await newProfile({ createdDaysAgo: 3, device: true })
    await runPromotionsPass(handle.db, senders, NOW)
    expect(push.sent).toHaveLength(1)
    expect(push.sent[0]?.data.kind).toBe('promotion')

    // Email on, push off: the mail goes, the phone stays quiet.
    email.messages.length = 0
    push.sent.length = 0
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await handle.db.collection(COLLECTIONS.notificationLedger).deleteMany({})
    await newProfile({
      createdDaysAgo: 3,
      device: true,
      notifications: { promotions: { push: false, email: true } },
    })
    await runPromotionsPass(handle.db, senders, NOW)
    expect(email.messages).toHaveLength(1)
    expect(push.sent).toHaveLength(0)
  })
})
