import { DEFAULT_APP_CONFIG } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { NotificationEmailContext } from '../../email/notify'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { invalidateAppConfigCache, updateAppConfig } from '../appConfig/appConfig'
import { LoggingPushSender } from '../push/devices'
import { claimCampaignRecipients } from './campaign'
import { runNewsletterPass } from './newsletter'
import { promotionsInOrder, runPromotionsPass } from './promotions'

const SECRET = 'p'.repeat(40)
const DAY = 24 * 60 * 60 * 1000
/** 12:00 UTC, so UTC is inside the reader's waking hours. */
const NOW = new Date('2026-09-14T20:00:00Z')

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
      COLLECTIONS.appConfig,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    invalidateAppConfigCache()
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
      refusals?: Date[]
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
      ...(opts.refusals ? { quotaRefusals: opts.refusals } : {}),
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

  /**
   * `MARKETING_MIN_GAP_DAYS` is a week, and `recentlyMarketed` is what enforces
   * it across senders — a read, followed by a `claimOnce` under a *different*
   * job key. The newsletter and the promotion pass both fire at
   * `PROMOTION_LOCAL_HOUR`, both gate on that read, and the scheduler runs the
   * whole array through `Promise.allSettled`. Its own comment says the ordering
   * in that array "would be a guarantee resting on nothing" — and there are two
   * API machines, so even running them in order inside one process would not
   * settle it.
   *
   * The third of the month, so `isSendingDay` is true and both are live.
   */
  it('sends one marketing mail when the newsletter and a promotion fire together', async () => {
    const sendingDay = new Date('2026-09-03T20:00:00Z')
    const userId = await newProfile({ createdDaysAgo: 30 })

    await Promise.all([
      runNewsletterPass(handle.db, senders.email, sendingDay),
      runPromotionsPass(handle.db, senders, sendingDay),
    ])

    const mine = email.messages.filter((message) => message.to === `${userId}@example.com`)
    expect(mine.map((message) => message.subject)).toHaveLength(1)
  })

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
    // The 13th was missed; the 12th was the last day that counted.
    await newProfile({
      avatar: true,
      earned: 900,
      device: true,
      streak: { current: 9, lastQualifiedDay: '2026-09-12' },
      notifications: { streak: { push: true, email: true } },
    })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(subjects()[0]).toContain('9')
    // The mail only: the repair's push is its own pass, which no mail holds back.
    expect(push.sent).toHaveLength(0)

    // A streak of two is not worth a letter, and neither is one that broke a
    // week ago.
    email.messages.length = 0
    await handle.db.collection(COLLECTIONS.notificationLedger).deleteMany({})
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await newProfile({
      avatar: true,
      invited: true,
      streak: { current: 2, lastQualifiedDay: '2026-09-12' },
    })
    await newProfile({
      avatar: true,
      invited: true,
      streak: { current: 9, lastQualifiedDay: '2026-09-01' },
    })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  /**
   * The old test of this nudge used exactly this profile and expected a mail:
   * it counted hours from noon UTC, so on the 14th a streak whose last day was
   * the 13th — alive, and due tonight's reminder — read as broken.
   */
  it('never tells somebody a streak broke while it is still alive', async () => {
    // Away eight days only so that no other nudge answers instead.
    await newProfile({
      avatar: true,
      invited: true,
      earned: 900,
      activeDaysAgo: 8,
      streak: { current: 9, lastQualifiedDay: '2026-09-13' },
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

  /**
   * D7. With the billing reminder switched on, somebody in a trial is told the
   * date and how to cancel by `billing/trialEnding.ts`, and is not marketed
   * to about it: a trialist already holds Pro. Every person this nudge could
   * match is in a trial, so it matches nobody — and the next nudge in the
   * table still gets its turn.
   */
  it('markets nothing to a trialist once the trial reminder is on', async () => {
    await updateAppConfig(handle.db, {
      flags: { ...DEFAULT_APP_CONFIG.flags, trialEndingReminder: true },
    })
    invalidateAppConfigCache()
    const trial = {
      tier: 'pro',
      periodType: 'trial',
      willRenew: false,
      expiresAt: new Date(NOW.getTime() + 1.5 * DAY),
      updatedAt: NOW,
    }
    await newProfile({ avatar: true, invited: true, entitlement: trial })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
    expect(
      await handle.db
        .collection(COLLECTIONS.notificationLedger)
        .countDocuments({ _id: { $regex: '^promo\\.trialEnding:' } } as never),
    ).toBe(0)

    // Somebody further down the table is still asked for what is theirs.
    await newProfile({ avatar: true, entitlement: trial })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(subjects()[0]).toContain('Practising')
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

  /**
   * The only nudge whose trigger is a refusal — which is why `consumeQuota`
   * had to start remembering them. Once is Tuesday; three times in three days
   * is a plan that no longer fits.
   */
  it('argues for a plan after three refusals, and not after two', async () => {
    const recent = [
      new Date(NOW.getTime() - 2 * DAY),
      new Date(NOW.getTime() - DAY),
      new Date(NOW.getTime() - 3600_000),
    ]
    await newProfile({ avatar: true, invited: true, refusals: recent })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(subjects()[0]).toContain('free limits')

    email.messages.length = 0
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await handle.db.collection(COLLECTIONS.notificationLedger).deleteMany({})
    await newProfile({ avatar: true, invited: true, refusals: recent.slice(0, 2) })
    // And three refusals from a fortnight ago are a bad week in March, not an
    // argument about a plan today.
    await newProfile({
      avatar: true,
      invited: true,
      refusals: recent.map((at) => new Date(at.getTime() - 14 * DAY)),
    })
    expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('never sells a plan to somebody who already has one', async () => {
    await newProfile({
      avatar: true,
      invited: true,
      refusals: [
        new Date(NOW.getTime() - 2 * DAY),
        new Date(NOW.getTime() - DAY),
        new Date(NOW.getTime() - 3600_000),
      ],
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

  describe('with promoPaywallLinks, the plans nudges open the paywall', () => {
    async function setPaywallLinks(on: boolean): Promise<void> {
      await updateAppConfig(handle.db, {
        flags: { ...DEFAULT_APP_CONFIG.flags, promoPaywallLinks: on },
      })
      invalidateAppConfigCache()
    }

    const refusals = () => [
      new Date(NOW.getTime() - 2 * DAY),
      new Date(NOW.getTime() - DAY),
      new Date(NOW.getTime() - 3600_000),
    ]
    const churnedFrom = () => ({ tier: 'pro', at: new Date(NOW.getTime() - 7.5 * DAY) })

    it.each([
      ['the free limits', 'nudge_limits', { refusals: refusals() }],
      ['a plan that ended', 'nudge_win_back', { churnedFrom: churnedFrom() }],
    ] as const)('%s: mail and push name %s', async (_name, source, state) => {
      await setPaywallLinks(true)
      await newProfile({ avatar: true, invited: true, device: true, ...state })
      expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
      expect(email.messages[0]?.text).toContain(`https://app.langx.io/paywall?source=${source}`)
      expect(push.sent).toHaveLength(1)
      expect(push.sent[0]?.data).toEqual({ kind: 'promotion', paywallSource: source })
    })

    it('leaves every link as it was with the switch off', async () => {
      await setPaywallLinks(false)
      await newProfile({ avatar: true, invited: true, device: true, refusals: refusals() })
      await newProfile({ avatar: true, invited: true, device: true, churnedFrom: churnedFrom() })
      expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 2 })
      for (const message of email.messages) {
        expect(message.text).toContain('https://app.langx.io/settings/plan')
        expect(message.text).not.toContain('/paywall')
      }
      expect(push.sent.map((sent) => sent.data)).toEqual([
        { kind: 'promotion' },
        { kind: 'promotion' },
      ])
    })

    it('moves no nudge that is not about the plans', async () => {
      await setPaywallLinks(true)
      await newProfile({ createdDaysAgo: 3, device: true })
      expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
      expect(email.messages[0]?.text).toContain('https://app.langx.io/me/edit')
      expect(push.sent[0]?.data).toEqual({ kind: 'promotion' })
    })

    /*
     * Only the landing moves. The same people, on the same evening, under the
     * same consent: somebody who has Pro, has promotions off, or is outside
     * the hour hears nothing on either side of the switch.
     */
    it('widens no audience', async () => {
      await setPaywallLinks(true)
      await newProfile({
        avatar: true,
        invited: true,
        device: true,
        refusals: refusals(),
        entitlement: { tier: 'pro', willRenew: true, updatedAt: NOW },
      })
      await newProfile({
        avatar: true,
        invited: true,
        device: true,
        refusals: refusals(),
        notifications: { promotions: { push: true, email: false } },
      })
      await newProfile({
        avatar: true,
        invited: true,
        device: true,
        churnedFrom: churnedFrom(),
        timezone: 'America/Anchorage',
      })
      expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
      expect(push.sent).toHaveLength(0)
    })
  })

  describe('with nudgeNoSilentDrops, nothing an eligible person is owed vanishes', () => {
    async function setNoSilentDrops(on: boolean): Promise<void> {
      await updateAppConfig(handle.db, {
        flags: { ...DEFAULT_APP_CONFIG.flags, nudgeNoSilentDrops: on },
      })
      invalidateAppConfigCache()
    }

    /**
     * A ledger row from some days back. `claimOnce` would stamp it with the
     * real clock, which is after this file's `NOW` and so reads as marketing
     * sent inside the gap.
     */
    async function saidBefore(
      job: string,
      userId: string,
      periodKey: string,
      daysAgo: number,
    ): Promise<void> {
      await handle.db.collection(COLLECTIONS.notificationLedger).insertOne({
        _id: `${job}:${userId}:${periodKey}`,
        sentOn: new Date(NOW.getTime() - daysAgo * DAY),
      } as never)
    }

    function capture() {
      const lines: { obj: object; msg: string }[] = []
      return { lines, logger: { info: (obj: object, msg: string) => lines.push({ obj, msg }) } }
    }

    async function forgetAllBut(keep: string): Promise<void> {
      email.messages.length = 0
      await handle.db
        .collection<{ _id: string }>(COLLECTIONS.notificationLedger)
        .deleteMany({ _id: { $ne: keep } })
    }

    /**
     * The order is the priority, and both are written down here so that a
     * reordering is a test change somebody has to mean.
     */
    it('walks money before idle tokens with the switch on, and the old order off', () => {
      const before = [
        'promo.photo',
        'promo.streakRepair',
        'promo.away7',
        'promo.away30',
        'promo.idleTokens',
        'promo.trialEnding',
        'promo.winBack',
        'promo.quotaHit',
        'promo.invite',
      ]
      const after = [
        'promo.photo',
        'promo.streakRepair',
        'promo.away7',
        'promo.away30',
        'promo.trialEnding',
        'promo.winBack',
        'promo.quotaHit',
        'promo.idleTokens',
        'promo.invite',
      ]
      expect(promotionsInOrder(false).map((promotion) => promotion.job)).toEqual(before)
      expect(promotionsInOrder(true).map((promotion) => promotion.job)).toEqual(after)
    })

    /**
     * The worst of them. A nudge already said that stays true — no photo yet
     * — claimed the evening's slot, sent nothing, and the claim restarted the
     * week's gap, so nothing below it in the table was ever said either.
     */
    it('lets the next nudge have the evening when the first was already said', async () => {
      const userId = await newProfile()
      const photo = `promo.photo:${userId}:once`
      await saidBefore('promo.photo', userId, 'once', 10)

      const off = capture()
      expect(await runPromotionsPass(handle.db, senders, NOW, off.logger)).toEqual({ sent: 0 })
      expect(off.lines.map((line) => line.obj)).toEqual([
        { pass: 'promotions', held: { 'promo.photo:said': 1 } },
      ])
      const slots = await handle.db
        .collection(COLLECTIONS.notificationLedger)
        .countDocuments({ _id: { $regex: '^promo\\.slot:' } } as never)
      expect(slots).toBe(1)

      await forgetAllBut(photo)
      await setNoSilentDrops(true)
      const on = capture()
      expect(await runPromotionsPass(handle.db, senders, NOW, on.logger)).toEqual({ sent: 1 })
      expect(subjects()).toEqual(['Practising is better with someone you know'])
      expect(on.lines).toHaveLength(0)
    })

    /**
     * "Away seven days" was true for one evening. Marketed three days before
     * it, the evening fell inside the gap and the nudge was gone by the time
     * the gap ended.
     */
    it('waits out the gap for a nudge whose day came inside it', async () => {
      const userId = await newProfile({ avatar: true, invited: true, activeDaysAgo: 7.5 })
      await saidBefore('promo.idleTokens', userId, '2026-09', 3)

      const tonight = capture()
      expect(await runPromotionsPass(handle.db, senders, NOW, tonight.logger)).toEqual({
        sent: 0,
      })
      expect(tonight.lines[0]?.obj).toEqual({
        pass: 'promotions',
        held: { 'promo.away7:gap': 1 },
      })
      // A count by nudge and reason, and nobody in it.
      expect(JSON.stringify(tonight.lines)).not.toContain(userId)

      // Five evenings on, the gap is over and the absence twelve days old.
      const later = new Date(NOW.getTime() + 5 * DAY)
      expect(await runPromotionsPass(handle.db, senders, later)).toEqual({ sent: 0 })
      await setNoSilentDrops(true)
      expect(await runPromotionsPass(handle.db, senders, later)).toEqual({ sent: 1 })
      expect(subjects()).toEqual(['People are still practising without you'])

      // Said once for the absence, however long the window stays open.
      const next = new Date(later.getTime() + DAY)
      expect(await runPromotionsPass(handle.db, senders, next)).toEqual({ sent: 0 })
    })

    it('gives the month away and the win-back the same wait', async () => {
      await setNoSilentDrops(true)
      await newProfile({ avatar: true, invited: true, activeDaysAgo: 33 })
      await newProfile({
        avatar: true,
        invited: true,
        activeDaysAgo: 1,
        churnedFrom: { tier: 'pro', at: new Date(NOW.getTime() - 12 * DAY) },
      })
      // Past the widened window: a month and a half away is not "a month".
      await newProfile({ avatar: true, invited: true, activeDaysAgo: 45 })

      expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 2 })
      expect(subjects().sort()).toEqual(
        ['We will stop writing after this', 'Your plan ended a week ago'].sort(),
      )
    })

    /**
     * The month away ends "this is the last we will say about it". With the
     * windows wider and a photo already asked for no longer holding the
     * evening, a plan that ended while somebody was away would otherwise be
     * sold to them once the gap after that letter ran out.
     */
    it('says nothing more after the farewell while the absence lasts', async () => {
      await setNoSilentDrops(true)
      const churnedFrom = { tier: 'pro', at: new Date(NOW.getTime() - 10 * DAY) }
      const away = await newProfile({ invited: true, activeDaysAgo: 37.5, churnedFrom })
      const lastActiveAt = new Date(NOW.getTime() - 37.5 * DAY).toISOString()
      await saidBefore('promo.away30', away, `away30:${lastActiveAt}`, 7.5)
      await saidBefore('promo.photo', away, 'once', 20)
      // Somebody who is still around was promised nothing; the win-back is theirs.
      await newProfile({ avatar: true, invited: true, activeDaysAgo: 2, churnedFrom })

      expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
      expect(subjects()).toEqual(['Your plan ended a week ago'])
      expect(email.messages[0]?.to).not.toBe(`${away}@example.com`)
    })

    /**
     * Idle tokens stays true for weeks; the win-back for its window. Above
     * it, tokens took the slot and the gap closed the win-back's window.
     */
    it('puts a plan that ended above tokens waiting', async () => {
      const churned = {
        avatar: true,
        invited: true,
        earned: 900,
        churnedFrom: { tier: 'pro', at: new Date(NOW.getTime() - 7.5 * DAY) },
      }
      await newProfile(churned)
      expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
      expect(subjects()).toEqual(['You have 900 tokens waiting'])

      email.messages.length = 0
      await handle.db.collection(COLLECTIONS.notificationLedger).deleteMany({})
      await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
      await setNoSilentDrops(true)
      await newProfile(churned)
      expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
      expect(subjects()).toEqual(['Your plan ended a week ago'])
    })

    /** Consent, the gap, the hour and the evening letter decide, as before. */
    it('widens no audience', async () => {
      await setNoSilentDrops(true)
      const marketed = await newProfile({ avatar: true, invited: true, activeDaysAgo: 10 })
      await saidBefore('promo.idleTokens', marketed, '2026-09', 2)
      await newProfile({
        avatar: true,
        invited: true,
        activeDaysAgo: 10,
        notifications: { promotions: { push: true, email: false } },
      })
      await newProfile({
        avatar: true,
        invited: true,
        activeDaysAgo: 10,
        timezone: 'America/Anchorage',
      })
      expect(await runPromotionsPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
      expect(push.sent).toHaveLength(0)
    })
  })
})
