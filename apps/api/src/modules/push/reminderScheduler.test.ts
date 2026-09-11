import { STREAK_REMINDER_LOCAL_HOUR } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
import { LoggingPushSender, type Device } from './devices'
import { runStreakReminderTick } from './reminderScheduler'

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

  it('pushes to a phone', async () => {
    await seed({ withDevice: true })
    const result = await runStreakReminderTick(handle.db, push, now)

    expect(result).toEqual({ pushed: 1 })
    expect(push.sent).toHaveLength(1)
    expect(push.sent[0]?.data.kind).toBe('streakReminder')
  })

  /**
   * The web audience, and anyone who declined the permission. They are nudged
   * an hour earlier, as a section of the evening digest — so this pass leaves
   * them alone *and leaves the day unclaimed*, which is what lets the digest
   * claim it. Claiming here would silence the only channel they have.
   */
  it('leaves somebody with no phone to the evening digest', async () => {
    await seed()
    const result = await runStreakReminderTick(handle.db, push, now)

    expect(result).toEqual({ pushed: 0 })
    expect(push.sent).toHaveLength(0)
    expect(await handle.db.collection(COLLECTIONS.streakReminders).countDocuments({})).toBe(0)
  })

  it('nudges once a day however many times it runs', async () => {
    await seed({ withDevice: true })
    await runStreakReminderTick(handle.db, push, now)
    const second = await runStreakReminderTick(handle.db, push, now)

    expect(second).toEqual({ pushed: 0 })
    expect(push.sent).toHaveLength(1)
  })

  it('says nothing to somebody who turned both channels off', async () => {
    await seed({ withDevice: true, notifications: { streak: { push: false, email: false } } })
    await runStreakReminderTick(handle.db, push, now)

    expect(push.sent).toHaveLength(0)
    // Not even claimed: the day should still be free if they change their mind.
    expect(await handle.db.collection(COLLECTIONS.streakReminders).countDocuments({})).toBe(0)
  })

  it('does not push to somebody who asked for mail instead', async () => {
    await seed({ withDevice: true, notifications: { streak: { push: false, email: true } } })
    const result = await runStreakReminderTick(handle.db, push, now)

    expect(result).toEqual({ pushed: 0 })
    expect(push.sent).toHaveLength(0)
    // The digest is their channel, so the day must still be theirs to claim.
    expect(await handle.db.collection(COLLECTIONS.streakReminders).countDocuments({})).toBe(0)
  })

  it('leaves alone anyone for whom it is not the reminder hour', async () => {
    await seed({ withDevice: true, timezone: 'Etc/GMT+1' === zone ? 'Etc/GMT+2' : 'Etc/GMT+1' })
    const result = await runStreakReminderTick(handle.db, push, now)
    expect(result).toEqual({ pushed: 0 })
  })

  it('leaves alone anyone who has already kept the streak today', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(now)
    await seed({ withDevice: true, lastQualifiedDay: today })
    expect(await runStreakReminderTick(handle.db, push, now)).toEqual({ pushed: 0 })
  })
})
