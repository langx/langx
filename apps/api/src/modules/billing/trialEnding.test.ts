import {
  DEFAULT_APP_CONFIG,
  SUPPORTED_LOCALES,
  TRIAL_REMINDER_DAYS_BEFORE,
  trialReminderDay,
  type Locale,
} from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { trialEndingEmail, type CancelPath } from '../../email/templates'
import { translator } from '../../i18n'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { invalidateAppConfigCache, updateAppConfig } from '../appConfig/appConfig'
import { claimOnce } from '../notifications/ledger'
import { suppressEmail } from '../notifications/suppressions'
import { LoggingPushSender } from '../push/devices'
import type { BillingNotifier } from './notify'
import { cancelPathFor, runTrialEndingPass, trialReminderReaches } from './trialEnding'

const HOUR = 60 * 60 * 1000
/** 14:00 UTC on the 23rd: waking hours in UTC, and two days before the 25th. */
const NOW = new Date('2026-10-23T14:00:00Z')
/** A trial ending on the 25th, UTC — its reminder is due on the 23rd. */
const ENDS = new Date('2026-10-25T10:00:00Z')

describe('the trial-ending reminder', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let email: CapturingEmailSender
  let push: LoggingPushSender
  let senders: BillingNotifier

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'trial_ending_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  async function setFlag(on: boolean): Promise<void> {
    await updateAppConfig(handle.db, {
      flags: { ...DEFAULT_APP_CONFIG.flags, trialEndingReminder: on },
    })
    invalidateAppConfigCache()
  }

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.devices,
      COLLECTIONS.notificationLedger,
      COLLECTIONS.subscriptions,
      COLLECTIONS.emailSuppressions,
      COLLECTIONS.appConfig,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    invalidateAppConfigCache()
    // Every case below is about the reminder once it is switched on; the one
    // that is not says so.
    await setFlag(true)
    email = new CapturingEmailSender()
    push = new LoggingPushSender()
    senders = { email, push, logger: { error: vi.fn() } }
  })

  async function trialist(
    opts: {
      endsAt?: Date
      timezone?: string
      store?: string
      willRenew?: boolean
      periodType?: string | null
      birthDate?: string
      notifications?: unknown
      verified?: boolean
      device?: boolean | { pushEnabled: false }
      deviceLocale?: Locale
    } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(-10)}`,
      displayName: 'Sofia R.',
      birthDate: opts.birthDate ?? '1994-05-20',
      timezone: opts.timezone ?? 'UTC',
      nativeLanguages: [{ code: 'en' }],
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
      entitlement: {
        tier: 'pro',
        willRenew: opts.willRenew ?? true,
        store: opts.store ?? 'app_store',
        expiresAt: opts.endsAt ?? ENDS,
        ...(opts.periodType === null ? {} : { periodType: opts.periodType ?? 'trial' }),
        updatedAt: NOW,
      },
      createdAt: new Date(NOW.getTime() - 3 * 24 * HOUR),
    } as never)
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: `${userId}@example.com`,
      emailVerified: opts.verified ?? true,
    })
    if (opts.device !== false && opts.device !== undefined) {
      await handle.db.collection(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: `ExponentPushToken[${userId.slice(-12)}]`,
        platform: 'ios',
        locale: opts.deviceLocale ?? 'en',
        ...(opts.device === true ? {} : { pushEnabled: false }),
        createdAt: NOW,
        updatedAt: NOW,
      })
    }
    return userId
  }

  it('reminds on the day it is due, by mail and on the phone, with the date and the store’s steps', async () => {
    const userId = await trialist({ device: true })

    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 1 })

    expect(email.messages).toHaveLength(1)
    const mail = email.messages[0]
    expect(mail?.to).toBe(`${userId}@example.com`)
    expect(mail?.subject).toBe('Your LangX Pro trial ends on October 25, 2026')
    expect(mail?.text).toContain('Settings → your name → Subscriptions → LangX')
    expect(mail?.html).toContain('Plan: Pro')
    // No unsubscribe footer: there is no switch behind it.
    expect(mail?.headers?.['List-Unsubscribe']).toBeUndefined()

    expect(push.sent).toHaveLength(1)
    expect(push.sent[0]?.title).toBe('Your free trial ends on October 25, 2026')
    expect(push.sent[0]?.data).toEqual({ kind: 'billing' })
  })

  it('says nothing before the reminder day, and nothing once the trial has ended', async () => {
    // The 26th's reminder is due on the 24th.
    await trialist({ endsAt: new Date('2026-10-26T10:00:00Z') })
    await trialist({ endsAt: new Date(NOW.getTime() - HOUR) })

    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
    expect(await handle.db.collection(COLLECTIONS.notificationLedger).countDocuments()).toBe(0)

    // The next day the first one is due.
    const tomorrow = new Date(NOW.getTime() + 24 * HOUR)
    expect(await runTrialEndingPass(handle.db, senders, tomorrow)).toEqual({ sent: 1 })
  })

  /**
   * A trial seen for the first time inside its last two days — a short one,
   * or the switch turned on mid-trial — is still told, at the next waking
   * hour, rather than never.
   */
  it('catches up on a trial that is already inside the window', async () => {
    await trialist({ endsAt: new Date(NOW.getTime() + 20 * HOUR) })
    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
  })

  it('waits for waking hours on the reader’s own clock', async () => {
    // 14:00 UTC is 03:00 in Pago Pago (UTC−11): not a time for mail.
    await trialist({ timezone: 'Pacific/Pago_Pago' })
    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 0 })

    // Nine in the morning there is 20:00 UTC.
    const morning = new Date('2026-10-23T20:00:00Z')
    expect(await runTrialEndingPass(handle.db, senders, morning)).toEqual({ sent: 1 })
  })

  /**
   * The reminder day is the reader's, which is what lets the paywall promise
   * a date. In Toronto this trial ends on the evening of the 25th; in UTC it
   * is already the 26th, and the UTC reader's reminder is a day later.
   */
  it('counts the days on the reader’s calendar, as the paywall does', async () => {
    const endsAt = new Date('2026-10-26T02:00:00Z')
    const toronto = await trialist({ endsAt, timezone: 'America/Toronto' })
    await trialist({ endsAt, timezone: 'UTC' })

    expect(trialReminderDay(endsAt, 'America/Toronto')).toBe('2026-10-23')
    expect(trialReminderDay(endsAt, 'UTC')).toBe('2026-10-24')

    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(email.messages[0]?.to).toBe(`${toronto}@example.com`)
    expect(email.messages[0]?.subject).toContain('October 25')
  })

  it('reminds once per trial, however many ticks land in the day', async () => {
    const userId = await trialist({ device: true })

    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
    expect(
      await runTrialEndingPass(handle.db, senders, new Date(NOW.getTime() + 5 * HOUR)),
    ).toEqual({ sent: 0 })
    expect(email.messages).toHaveLength(1)
    expect(push.sent).toHaveLength(1)

    // The claim is the trial's end day, so the webhook's and a refresh's
    // slightly different copies of the same expiry are one trial, not two.
    const ledger = await handle.db.collection(COLLECTIONS.notificationLedger).find().toArray()
    expect(ledger.map((row) => row._id)).toEqual([`billing.trialEnding:${userId}:2026-10-25`])
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne(
        { _id: userId as never },
        { $set: { 'entitlement.expiresAt': new Date(ENDS.getTime() + 400) } },
      )
    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  /**
   * Billing, so no switch: every notification switch off, the marketing week
   * used up and the evening's digest already gone change nothing.
   */
  it('asks no preference and is held back by no marketing rule', async () => {
    const off = await trialist({ notifications: false, device: true })
    const promotionsOff = await trialist({
      notifications: { promotions: { push: false, email: false } },
    })
    const day = '2026-10-23'
    for (const userId of [off, promotionsOff]) {
      await claimOnce(handle.db, 'dailyDigest', userId, day)
      await claimOnce(handle.db, 'promo.photo', userId, 'once')
    }

    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 2 })
    expect(push.sent).toHaveLength(1)
  })

  /**
   * Minors are handled as every billing notice handles them: the store
   * charges a sixteen-year-old's subscription like anybody's, so they are
   * told like anybody — no age check, unlike the streak repair push.
   */
  it('tells a sixteen-year-old exactly as it tells an adult', async () => {
    await trialist({ birthDate: '2010-03-01', device: true })
    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(email.messages).toHaveLength(1)
    expect(push.sent).toHaveLength(1)
  })

  it('says nothing to a cancelled trial, a paying plan or one nobody labelled', async () => {
    await trialist({ willRenew: false })
    await trialist({ periodType: 'normal' })
    await trialist({ periodType: null })
    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('says nothing about a sandbox or TestFlight trial', async () => {
    const userId = await trialist()
    await handle.db.collection(COLLECTIONS.subscriptions).insertOne({
      eventId: 'sandbox-trial',
      userId,
      type: 'INITIAL_PURCHASE',
      store: 'APP_STORE',
      productId: 'p',
      expiresAt: ENDS,
      environment: 'SANDBOX',
      createdAt: NOW,
    })
    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  // Since 3.0 the monthly plan has the free week too; the pass never reads the
  // product, so a monthly trial is reminded exactly like a yearly one.
  it.each(['langx_fluent_monthly', 'langx_fluent_yearly'])(
    'reminds a trial on %s the same way',
    async (productId) => {
      const userId = await trialist()
      await handle.db.collection(COLLECTIONS.subscriptions).insertOne({
        eventId: `trial-${productId}`,
        userId,
        type: 'INITIAL_PURCHASE',
        store: 'APP_STORE',
        productId,
        expiresAt: ENDS,
        environment: 'PRODUCTION',
        createdAt: NOW,
      })
      expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
      expect(email.messages[0]?.subject).toBe('Your LangX Pro trial ends on October 25, 2026')
    },
  )

  it('skips a suppressed address but still reaches the phone', async () => {
    const userId = await trialist({ device: true })
    await suppressEmail(handle.db, { email: `${userId}@example.com`, reason: 'bounced' })
    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(email.messages).toHaveLength(0)
    expect(push.sent).toHaveLength(1)
  })

  /**
   * Nobody to tell is not a claim: a phone signed in tomorrow still gets the
   * reminder while the trial runs.
   */
  it('claims nothing for somebody it cannot reach', async () => {
    const userId = await trialist({ verified: false, device: { pushEnabled: false } })
    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
    expect(await handle.db.collection(COLLECTIONS.notificationLedger).countDocuments()).toBe(0)

    await handle.db
      .collection(COLLECTIONS.devices)
      .updateOne({ userId }, { $set: { pushEnabled: true } })
    expect(
      await runTrialEndingPass(handle.db, senders, new Date(NOW.getTime() + 2 * HOUR)),
    ).toEqual({ sent: 1 })
  })

  /** A merge sends nobody anything: switching it on is the decision. */
  it('sends nothing while its flag is off, which is how it ships', async () => {
    await setFlag(false)
    await trialist({ device: true })
    expect(DEFAULT_APP_CONFIG.flags.trialEndingReminder).toBe(false)
    expect(await runTrialEndingPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
    expect(await handle.db.collection(COLLECTIONS.notificationLedger).countDocuments()).toBe(0)
  })

  describe('trialReminder, the paywall’s question', () => {
    it('is false while the flag is off, whatever the channels', async () => {
      await setFlag(false)
      const userId = await trialist({ device: true })
      expect(await trialReminderReaches(handle.db, userId)).toBe(false)
    })

    it('is true with a phone that can be reached, or a proved address', async () => {
      const phone = await trialist({ verified: false, device: true })
      const mail = await trialist({ verified: true })
      expect(await trialReminderReaches(handle.db, phone)).toBe(true)
      expect(await trialReminderReaches(handle.db, mail)).toBe(true)
    })

    it('is false with only a silenced phone and an unproved or suppressed address', async () => {
      const silenced = await trialist({ verified: false, device: { pushEnabled: false } })
      const suppressed = await trialist({ verified: true })
      await suppressEmail(handle.db, { email: `${suppressed}@example.com`, reason: 'complained' })
      expect(await trialReminderReaches(handle.db, silenced)).toBe(false)
      expect(await trialReminderReaches(handle.db, suppressed)).toBe(false)
    })
  })
})

describe('which store’s steps', () => {
  it('reads both spellings the entitlement is written in', () => {
    expect(cancelPathFor('APP_STORE')).toBe('appStore')
    expect(cancelPathFor('app_store')).toBe('appStore')
    expect(cancelPathFor('mac_app_store')).toBe('appStore')
    expect(cancelPathFor('PLAY_STORE')).toBe('playStore')
    expect(cancelPathFor('rc_billing')).toBe('web')
    expect(cancelPathFor('STRIPE')).toBe('web')
  })

  it('gives anything else the general line rather than another store’s steps', () => {
    expect(cancelPathFor('amazon')).toBe('other')
    expect(cancelPathFor('fake_store')).toBe('other')
    expect(cancelPathFor(undefined)).toBe('other')
  })
})

/**
 * Rule 22's Billing class: the date, the plan and how to cancel, and nothing
 * that sells. These words are checked in the language each is in, so a
 * translation cannot drift into an argument for keeping the plan.
 */
describe('the words of the trial reminder', () => {
  const selling: Record<Locale, RegExp> = {
    en: /upgrade|unlock|don.t lose|miss out|one tap|keep (pro|your plan|my plan)|see the plans|offer|discount|save\b/i,
    tr: /yükselt|kilidini|kaçırma|tek dokunuş|planlara bak|indirim|fırsat/i,
    es: /mejora|desbloque|no pierdas|un toque|ver los planes|oferta|descuento/i,
    ru: /улучш|разблок|не упуст|одно касание|посмотреть тарифы|скидк|предложени/i,
    ar: /ترقية|لا تفوت|نقرة واحدة|اطّلع على الخطط|خصم/,
    fr: /améliore|débloque|ne manquez|ne rate|un geste|voir les formules|offre|réduction|remise/i,
    de: /upgrade|freischalt|verpass|ein tipp|tarife ansehen|angebot|rabatt/i,
    'pt-BR': /melhore|desbloque|não perca|um toque|ver os planos|oferta|desconto/i,
  }
  const cancels: CancelPath[] = ['appStore', 'playStore', 'web', 'other']

  it.each(SUPPORTED_LOCALES)('%s states facts and sells nothing', (locale) => {
    const t = translator(locale)
    const date = '⟨date⟩'
    const words = [
      t('push.billingTrialEndingTitle', { date }),
      t('push.billingTrialEndingBody'),
      t('email.billing.trialEndingTitle', { date }),
      t('email.billing.trialEndingBody', { date }),
      t('email.billing.trialEndingButton'),
      t('email.billing.trialEndingCancelAppStore'),
      t('email.billing.trialEndingCancelPlayStore'),
      t('email.billing.trialEndingCancelWeb'),
      t('email.billing.trialEndingCancelOther'),
    ]
    for (const text of words) {
      expect(text).not.toMatch(selling[locale])
      // No amount is invented: the store's price is the store's to state.
      expect(text).not.toMatch(/[$€£¥₺₽₹]|\d+[.,]\d\d\b/)
      expect(text).not.toMatch(/\{\w+\}/)
    }
    // The date is in the sentence that says when.
    expect(t('email.billing.trialEndingBody', { date })).toContain(date)

    for (const cancel of cancels) {
      const mail = trialEndingEmail(locale, { date, tier: 'Pro', cancel })
      expect(mail.html).not.toContain('/paywall')
      expect(mail.text).not.toContain('/paywall')
      expect(mail.html).toContain('/settings/plan')
      const links = [...mail.html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((match) => match[1])
      for (const href of links) {
        // The plan screen, and the "get the app" panel every mail ends with.
        expect(href === undefined || /\/settings\/plan$|get\.langx\.io/.test(href), href).toBe(true)
      }
    }
  })

  it('names the lead time it is built on', () => {
    expect(TRIAL_REMINDER_DAYS_BEFORE).toBe(2)
  })
})
