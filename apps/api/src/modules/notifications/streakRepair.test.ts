import {
  DEFAULT_APP_CONFIG,
  STREAK_REMINDER_LOCAL_HOUR,
  SUPPORTED_LOCALES,
  TOKEN_RULES,
  type Locale,
} from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { translator } from '../../i18n'
import { invalidateAppConfigCache, updateAppConfig } from '../appConfig/appConfig'
import { LoggingPushSender, type Device } from '../push/devices'
import { runStreakRepairPushPass } from './streakRepair'

/** A zone in which `now` reads as the evening hour both streak pushes use. */
function zoneWhereItIsReminderHour(now: Date): string {
  const offset = (now.getUTCHours() - STREAK_REMINDER_LOCAL_HOUR + 24) % 24
  if (offset === 0) return 'UTC'
  return offset <= 12 ? `Etc/GMT+${offset}` : `Etc/GMT-${24 - offset}`
}

describe('the streak repair push', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let push: LoggingPushSender
  /** 20:00 on the 14th in the zone below: the 13th was missed, the 12th was the last day. */
  const now = new Date('2026-09-14T14:00:00Z')
  const zone = zoneWhereItIsReminderHour(now)
  const missed = '2026-09-13'

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'streak_repair_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    push = new LoggingPushSender()
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.devices,
      COLLECTIONS.notificationLedger,
      COLLECTIONS.tokenAggregates,
      COLLECTIONS.streakDays,
      COLLECTIONS.appConfig,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    invalidateAppConfigCache()
    // Every case below is about what happens once it is switched on; the one
    // that is not says so.
    await updateAppConfig(handle.db, {
      flags: { ...DEFAULT_APP_CONFIG.flags, streakRepairPush: true },
    })
  })

  async function broken(
    opts: {
      current?: number
      lastQualifiedDay?: string
      streakFreezes?: number
      earned?: number
      spent?: number
      notifications?: unknown
      timezone?: string
      locale?: Locale
      withDevice?: boolean
      birthDate?: string | null
    } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(-10)}`,
      displayName: 'Sofia R.',
      ...(opts.birthDate === null ? {} : { birthDate: opts.birthDate ?? '1994-05-20' }),
      timezone: opts.timezone ?? zone,
      streak: {
        current: opts.current ?? 9,
        longest: 9,
        lastQualifiedDay: opts.lastQualifiedDay ?? '2026-09-12',
      },
      ...(opts.streakFreezes === undefined ? {} : { streakFreezes: opts.streakFreezes }),
      ...(opts.spent === undefined ? {} : { tokenSpent: opts.spent }),
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
    } as never)
    await handle.db.collection(COLLECTIONS.tokenAggregates).insertOne({
      _id: `${userId}:all:all`,
      userId,
      periodType: 'all',
      periodKey: 'all',
      tokens: opts.earned ?? TOKEN_RULES.sinks.dayRepair * 2,
      updatedAt: now,
    } as never)
    if (opts.withDevice !== false) {
      await handle.db.collection<Device>(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: `ExponentPushToken[${userId}]`,
        platform: 'ios',
        locale: opts.locale ?? 'en',
        createdAt: now,
        updatedAt: now,
      } as never)
    }
    return userId
  }

  it('offers the repair the evening after a streak broke, and opens the wallet', async () => {
    const userId = await broken()

    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 1 })
    expect(push.sent).toHaveLength(1)
    expect(push.sent[0]?.title).toBe('Pick your streak back up')
    expect(push.sent[0]?.body).toBe('A repair fills in yesterday, and your streak carries on.')
    // `wallet` is the kind every installed build routes to the wallet; the day
    // is what a build that knows this push opens the store on.
    expect(push.sent[0]?.data).toEqual({ kind: 'wallet', repairDay: missed })

    const claimed = await handle.db
      .collection(COLLECTIONS.notificationLedger)
      .findOne({ _id: `streakRepair:${userId}:${missed}` as never })
    expect(claimed).not.toBeNull()
  })

  it('says it once per broken streak, however many ticks land in the hour', async () => {
    await broken()
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 1 })
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 0 })
    expect(push.sent).toHaveLength(1)
  })

  it('words it in the language the phone reads', async () => {
    await broken({ locale: 'tr' })
    await runStreakRepairPushPass(handle.db, push, now)
    expect(push.sent[0]?.title).toBe(translator('tr')('push.streakRepairTitle'))
    expect(push.sent[0]?.title).not.toBe('Pick your streak back up')
  })

  /**
   * The reminder's people, and the repair's, never overlap: a streak that
   * showing up still saves is the 20:00 reminder's, and saying "broke" to it
   * would be false.
   */
  it('says nothing about a streak that is still alive or can still be bridged', async () => {
    await broken({ lastQualifiedDay: '2026-09-13' })
    await broken({ lastQualifiedDay: '2026-09-12', streakFreezes: 1 })
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 0 })
  })

  it('says nothing about a short run, or one that broke earlier than yesterday', async () => {
    await broken({ current: 2 })
    await broken({ lastQualifiedDay: '2026-09-11' })
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 0 })
  })

  it('offers nothing that cannot be taken', async () => {
    // Not enough tokens for one repair.
    await broken({ earned: TOKEN_RULES.sinks.dayRepair, spent: 1 })
    // Both of this month's repairs already used.
    const used = await broken()
    for (let i = 0; i < TOKEN_RULES.sinks.dayRepairPerMonth; i++) {
      const day = `2026-09-0${i + 1}`
      await handle.db.collection(COLLECTIONS.streakDays).insertOne({
        _id: `${used}:${day}`,
        userId: used,
        day,
        source: 'purchase',
        actions: 0,
      } as never)
    }
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 0 })
  })

  it('answers to the push half of the streak switch, and to nothing about mail', async () => {
    await broken({ notifications: { streak: { push: false, email: true } } })
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 0 })

    // The mail half off used to silence the push too, because the push rode
    // behind the repair mail. It is not a fallback for the mail.
    await broken({ notifications: { streak: { push: true, email: false } } })
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 1 })
  })

  it('claims nothing for somebody with no phone signed in', async () => {
    const userId = await broken({ withDevice: false })
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 0 })
    const claimed = await handle.db
      .collection(COLLECTIONS.notificationLedger)
      .findOne({ _id: `streakRepair:${userId}:${missed}` as never })
    expect(claimed).toBeNull()
  })

  it('waits for the evening on the reader’s own clock', async () => {
    await broken({ timezone: 'UTC' })
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 0 })
  })

  /**
   * Both ends of the clock. At 20:00 in UTC+14 the UTC day is the same one; at
   * 20:00 in UTC−12 it is already the next, so the last day there is three UTC
   * days back — exactly the edge of the pass's prefilter.
   */
  it('finds the broken streak on both sides of the date line', async () => {
    await broken({ timezone: 'Pacific/Kiritimati' })
    // 20:00 on the 14th in UTC+14.
    const east = new Date('2026-09-14T06:00:00Z')
    expect(await runStreakRepairPushPass(handle.db, push, east)).toEqual({ sent: 1 })
    expect(push.sent[0]?.data).toEqual({ kind: 'wallet', repairDay: missed })

    await broken({ timezone: 'Etc/GMT+12' })
    // 20:00 on the 14th in UTC−12 is 08:00 on the 15th in UTC.
    const west = new Date('2026-09-15T08:00:00Z')
    expect(await runStreakRepairPushPass(handle.db, push, west)).toEqual({ sent: 1 })
    expect(push.sent[1]?.data).toEqual({ kind: 'wallet', repairDay: missed })
  })

  /** A merge sends nobody anything new: switching it on is the decision. */
  it('sends nothing while its flag is off, which is how it ships', async () => {
    await updateAppConfig(handle.db, { flags: DEFAULT_APP_CONFIG.flags })
    invalidateAppConfigCache()
    await broken()
    expect(DEFAULT_APP_CONFIG.flags.streakRepairPush).toBe(false)
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 0 })
    expect(await handle.db.collection(COLLECTIONS.notificationLedger).countDocuments()).toBe(0)
  })

  /** Counted by birth year, the app's one age rule: 2008 is eighteen in 2026. */
  it('never goes to a reader under eighteen, or one whose age is unknown', async () => {
    await broken({ birthDate: '2009-01-01' })
    await broken({ birthDate: '2010-06-30' })
    await broken({ birthDate: null })
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 0 })

    await broken({ birthDate: '2008-12-31' })
    expect(await runStreakRepairPushPass(handle.db, push, now)).toEqual({ sent: 1 })
  })
})

/**
 * Rule: a streak push that mentions Pro, a price or buying is promotional, and
 * these two are not allowed to become that by a translation drifting. The
 * words are checked in the language each string is in.
 */
describe('the words on both streak pushes', () => {
  const selling: Record<Locale, RegExp> = {
    en: /\bbuy|purchase|price|\bpay|trial|subscri|\bplan\b/i,
    tr: /satın|fiyat|ödeme|abone|deneme/i,
    es: /compr|precio|pag[ao]|suscri|prueba/i,
    ru: /куп|цен[аы]|плат|подпис/i,
    ar: /اشتر|شراء|سعر|ادفع|اشتراك/,
    fr: /achet|achat|prix|payer|abonn|essai/i,
    de: /kauf|preis|bezahl|abonn|probe/i,
    'pt-BR': /compr|preço|pag[ao]|assin|teste/i,
  }

  it.each(SUPPORTED_LOCALES)('%s names no plan, price or purchase', (locale) => {
    const t = translator(locale)
    const words = [
      t('push.streakTitle', { count: 9 }),
      t('push.streakBody'),
      t('push.streakRepairTitle'),
      t('push.streakRepairBody'),
    ]
    for (const text of words) {
      expect(text).not.toMatch(/\bPro\b/)
      expect(text).not.toMatch(/[$€£¥₺₽₹]/)
      expect(text).not.toMatch(selling[locale])
    }
  })

  it('states the rule as it is: opening the app keeps the streak', () => {
    const body = translator('en')('push.streakBody')
    expect(body).toContain('Open LangX')
    expect(body).not.toMatch(/message/i)
  })
})
