import { BADGE_ROUND_UP_LOCAL_HOUR } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { NotificationEmailContext } from '../../email/notify'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import type { Profile } from '../profiles/profiles'
import { LoggingPushSender, type Device } from '../push/devices'
import { runBadgeRoundUpPass } from './badges'

const SECRET = 'f'.repeat(40)

function zoneWhereItIsRoundUpHour(now: Date): string {
  const offset = (now.getUTCHours() - BADGE_ROUND_UP_LOCAL_HOUR + 24) % 24
  if (offset === 0) return 'UTC'
  return offset <= 12 ? `Etc/GMT+${offset}` : `Etc/GMT-${24 - offset}`
}

describe('the badge round-up', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let push: LoggingPushSender
  let sender: CapturingEmailSender
  let senders: { push: LoggingPushSender; email: NotificationEmailContext }
  const now = new Date('2026-09-03T15:00:00Z')
  const zone = zoneWhereItIsRoundUpHour(now)

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'badge_roundup_test')
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
      COLLECTIONS.tokenLedger,
      COLLECTIONS.tokenAggregates,
      COLLECTIONS.postCorrections,
      COLLECTIONS.messages,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    push = new LoggingPushSender()
    sender = new CapturingEmailSender()
    senders = {
      push,
      email: { sender, unsubscribeSecret: SECRET, apiBaseUrl: 'https://api.langx.io' },
    }
  })

  async function newProfile(
    opts: {
      messagesSent?: number
      longestStreak?: number
      notifiedBadgeIds?: string[]
      notifications?: unknown
      withDevice?: boolean
      timezone?: string
    } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(0, 8)}`,
      timezone: opts.timezone ?? zone,
      entitlement: { tier: 'free' },
      streak: { current: 0, longest: opts.longestStreak ?? 0, lastQualifiedDay: '2026-09-01' },
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
      stats: {
        lastActiveAt: now,
        messagesSent: opts.messagesSent ?? 0,
        ...(opts.notifiedBadgeIds ? { notifiedBadgeIds: opts.notifiedBadgeIds } : {}),
      },
      createdAt: new Date('2026-09-01T00:00:00Z'),
    } as never)
    await handle.db
      .collection(COLLECTIONS.user)
      .insertOne({ _id: authId(userId), email: `${userId}@example.com`, emailVerified: true })
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

  async function notifiedIdsOf(userId: string): Promise<string[] | undefined> {
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId })
    return profile?.stats.notifiedBadgeIds
  }

  /**
   * The one that matters on the day this ships: everybody already has badges,
   * and none of them are news.
   */
  it('seeds a profile it has never seen and says nothing', async () => {
    const userId = await newProfile({ messagesSent: 5000, withDevice: true })

    const result = await runBadgeRoundUpPass(handle.db, senders, now)
    expect(result).toEqual({ sent: 0, seeded: 1, failed: 0 })
    expect(push.sent).toHaveLength(0)
    expect((await notifiedIdsOf(userId))?.length).toBeGreaterThan(0)
  })

  it('names a single new badge', async () => {
    const userId = await newProfile({ messagesSent: 0, withDevice: true })
    await runBadgeRoundUpPass(handle.db, senders, now)
    // Cross one threshold between passes.
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })

    const result = await runBadgeRoundUpPass(handle.db, senders, now)
    expect(result.sent).toBe(1)
    expect(push.sent[0]?.data.kind).toBe('badgeEarned')
    expect(push.sent[0]?.title).toContain('100 messages')
  })

  it('counts them instead when several arrive at once', async () => {
    const userId = await newProfile({ withDevice: true })
    await runBadgeRoundUpPass(handle.db, senders, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne(
        { _id: userId as never },
        { $set: { 'stats.messagesSent': 5000, 'streak.longest': 60 } },
      )

    await runBadgeRoundUpPass(handle.db, senders, now)
    // More than one, so a count rather than a list of English labels.
    expect(push.sent[0]?.title).not.toContain('messages')
  })

  it('says nothing twice about the same badge', async () => {
    const userId = await newProfile({ withDevice: true })
    await runBadgeRoundUpPass(handle.db, senders, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })

    await runBadgeRoundUpPass(handle.db, senders, now)
    const again = await runBadgeRoundUpPass(handle.db, senders, now)
    expect(again.sent).toBe(0)
    expect(push.sent).toHaveLength(1)
  })

  it('emails somebody with no phone who asked for it', async () => {
    const userId = await newProfile({ notifications: { badges: { email: true } } })
    await runBadgeRoundUpPass(handle.db, senders, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })

    expect((await runBadgeRoundUpPass(handle.db, senders, now)).sent).toBe(1)
    expect(sender.messages[0]?.subject).toContain('100 messages')
  })

  /** Email is off by default for this kind; the round-up must respect that. */
  it('sends nothing to somebody with no phone who did not ask for mail', async () => {
    const userId = await newProfile()
    await runBadgeRoundUpPass(handle.db, senders, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })

    expect((await runBadgeRoundUpPass(handle.db, senders, now)).sent).toBe(0)
    expect(sender.messages).toHaveLength(0)
  })

  /**
   * Somebody who wants no badge notifications still has their list kept up to
   * date — otherwise switching the toggle back on announces a year of badges.
   */
  it('keeps the record current even for somebody who turned it off', async () => {
    const userId = await newProfile({
      withDevice: true,
      notifications: { badges: { push: false, email: false } },
    })
    await runBadgeRoundUpPass(handle.db, senders, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })

    expect((await runBadgeRoundUpPass(handle.db, senders, now)).sent).toBe(0)
    expect(push.sent).toHaveLength(0)
    expect(await notifiedIdsOf(userId)).toContain('messages.100')
  })

  /**
   * The pass is the first thing that walks every profile in the database
   * rather than the one that just asked for its own badges, and
   * `getBadgeSummary` reads `streak.longest` without a guard. One row written
   * by an import that no longer exists must not stop everybody else's badges
   * — forever, thirty minutes at a time.
   */
  it('skips a profile it cannot read and carries on with the rest', async () => {
    const broken = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: broken,
      handle: `h${broken.slice(-12)}`,
      timezone: zone,
      entitlement: { tier: 'free' },
      // No `streak`, which is what an old import can leave behind.
      settings: { discoverable: true, notifications: {} },
      stats: { lastActiveAt: now, messagesSent: 0, notifiedBadgeIds: [] },
      createdAt: new Date('2026-09-01T00:00:00Z'),
    } as never)
    const healthy = await newProfile({ messagesSent: 5000, withDevice: true })

    const warn = vi.fn()
    const result = await runBadgeRoundUpPass(handle.db, senders, now, { warn })

    expect(result.failed).toBe(1)
    expect(warn).toHaveBeenCalledOnce()
    // The healthy profile was still reached, which is the whole point.
    expect(result.seeded).toBe(1)
    expect(await notifiedIdsOf(healthy)).toBeDefined()
  })

  it('leaves alone anyone for whom it is not the round-up hour', async () => {
    await newProfile({
      withDevice: true,
      timezone: zone === 'Etc/GMT+1' ? 'Etc/GMT+2' : 'Etc/GMT+1',
    })
    expect(await runBadgeRoundUpPass(handle.db, senders, now)).toEqual({
      sent: 0,
      seeded: 0,
      failed: 0,
    })
  })
})
