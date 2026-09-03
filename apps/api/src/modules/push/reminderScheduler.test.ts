import { STREAK_REMINDER_LOCAL_HOUR } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { NotificationEmailContext } from '../../email/notify'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { LoggingPushSender, type Device } from './devices'
import { runStreakReminderTick } from './reminderScheduler'

const SECRET = 'c'.repeat(40)

/**
 * A fixed zone in which `now` is the reminder hour.
 *
 * `Etc/GMT+n` runs *behind* UTC by n hours despite the plus — a POSIX
 * inversion, not a typo — so this picks the offset that puts the local clock
 * on `STREAK_REMINDER_LOCAL_HOUR` and nothing depends on when the suite runs.
 */
function zoneWhereItIsReminderHour(now: Date): string {
  const offset = (now.getUTCHours() - STREAK_REMINDER_LOCAL_HOUR + 24) % 24
  if (offset === 0) return 'UTC'
  return offset <= 12 ? `Etc/GMT+${offset}` : `Etc/GMT-${24 - offset}`
}

describe('the streak reminder pass', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let push: LoggingPushSender
  let sender: CapturingEmailSender
  let email: NotificationEmailContext
  const now = new Date('2026-09-03T14:00:00Z')
  const zone = zoneWhereItIsReminderHour(now)

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'streak_reminder_test')
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
      COLLECTIONS.streakReminders,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    push = new LoggingPushSender()
    sender = new CapturingEmailSender()
    email = { sender, unsubscribeSecret: SECRET, apiBaseUrl: 'https://api.langx.io' }
  })

  async function seed(
    opts: {
      notifications?: unknown
      withDevice?: boolean
      verified?: boolean
      streak?: number
      lastQualifiedDay?: string
      timezone?: string
    } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      timezone: opts.timezone ?? zone,
      streak: {
        current: opts.streak ?? 3,
        longest: 9,
        // Yesterday: today's chance has not been taken, which is the whole
        // reason the nudge is worth sending.
        lastQualifiedDay: opts.lastQualifiedDay ?? '2026-09-02',
      },
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
    } as never)
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: `${userId}@example.com`,
      emailVerified: opts.verified ?? true,
    })
    if (opts.withDevice) {
      await handle.db.collection<Device>(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: `ExponentPushToken[${userId}]`,
        platform: 'ios',
        createdAt: now,
        updatedAt: now,
      } as never)
    }
    return userId
  }

  it('pushes to a phone and sends no email', async () => {
    await seed({ withDevice: true })
    const result = await runStreakReminderTick(handle.db, push, email, now)

    expect(result).toEqual({ pushed: 1, emailed: 0 })
    expect(push.sent).toHaveLength(1)
    expect(push.sent[0]?.data.kind).toBe('streakReminder')
    expect(sender.messages).toHaveLength(0)
  })

  /**
   * The web audience, and anyone who declined the permission. Before this
   * they were found, ledgered and then silently skipped.
   */
  it('emails somebody with no phone signed in', async () => {
    await seed()
    const result = await runStreakReminderTick(handle.db, push, email, now)

    expect(result).toEqual({ pushed: 0, emailed: 1 })
    expect(push.sent).toHaveLength(0)
    expect(sender.messages).toHaveLength(1)
    // The same words as the push, with the streak count filled in.
    expect(sender.messages[0]?.subject).toContain('3')
    expect(sender.messages[0]?.headers?.['List-Unsubscribe-Post']).toBe(
      'List-Unsubscribe=One-Click',
    )
  })

  it('nudges once a day however many times it runs', async () => {
    await seed()
    await runStreakReminderTick(handle.db, push, email, now)
    const second = await runStreakReminderTick(handle.db, push, email, now)

    expect(second).toEqual({ pushed: 0, emailed: 0 })
    expect(sender.messages).toHaveLength(1)
  })

  it('says nothing to somebody who turned both channels off', async () => {
    await seed({ notifications: { streak: { push: false, email: false } } })
    await runStreakReminderTick(handle.db, push, email, now)

    expect(sender.messages).toHaveLength(0)
    expect(push.sent).toHaveLength(0)
    // Not even claimed: the day should still be free if they change their mind.
    expect(await handle.db.collection(COLLECTIONS.streakReminders).countDocuments({})).toBe(0)
  })

  it('emails somebody who wants mail but not a push', async () => {
    await seed({ withDevice: true, notifications: { streak: { push: false, email: true } } })
    const result = await runStreakReminderTick(handle.db, push, email, now)

    expect(result).toEqual({ pushed: 0, emailed: 1 })
    expect(push.sent).toHaveLength(0)
  })

  /**
   * The day is claimed before the send is attempted, so a person the mail
   * cannot reach is not retried thirty minutes later — and again the next
   * evening after that.
   */
  it('still claims the day when the address is unverified', async () => {
    await seed({ verified: false })
    const result = await runStreakReminderTick(handle.db, push, email, now)

    expect(result).toEqual({ pushed: 0, emailed: 0 })
    expect(sender.messages).toHaveLength(0)
    expect(await handle.db.collection(COLLECTIONS.streakReminders).countDocuments({})).toBe(1)
  })

  it('leaves alone anyone for whom it is not the reminder hour', async () => {
    await seed({ timezone: 'Etc/GMT+1' === zone ? 'Etc/GMT+2' : 'Etc/GMT+1' })
    const result = await runStreakReminderTick(handle.db, push, email, now)
    expect(result).toEqual({ pushed: 0, emailed: 0 })
  })

  it('leaves alone anyone who has already kept the streak today', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now)
    await seed({ lastQualifiedDay: today })
    expect(await runStreakReminderTick(handle.db, push, email, now)).toEqual({
      pushed: 0,
      emailed: 0,
    })
  })
})
