import { BADGE_ROUND_UP_LOCAL_HOUR } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import type { Profile } from '../profiles/profiles'
import { LoggingPushSender, type Device } from '../push/devices'
import { badgeSectionFor, runBadgeRoundUpPass } from './badges'

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
      COLLECTIONS.notifications,
      COLLECTIONS.tokenLedger,
      COLLECTIONS.tokenAggregates,
      COLLECTIONS.postCorrections,
      COLLECTIONS.messages,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    push = new LoggingPushSender()
    sender = new CapturingEmailSender()
  })

  async function newProfile(
    opts: {
      messagesSent?: number
      longestStreak?: number
      notifiedBadgeIds?: string[]
      notifications?: unknown
      withDevice?: boolean
      timezone?: string
      fromV1?: boolean
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
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: `${userId}@example.com`,
      emailVerified: true,
      // The cohort marker `origin.v1` is derived from, written by
      // `precreate-v1-users.ts` and read by `cameFromV1`.
      ...(opts.fromV1 ? { precreatedFromV1: { at: now, legacyUserId: userId } } : {}),
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

  async function notifiedIdsOf(userId: string): Promise<string[] | undefined> {
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId })
    return profile?.stats.notifiedBadgeIds
  }

  /** What the round-up left on the profile for the evening digest to collect. */
  async function pendingOf(userId: string): Promise<Profile['stats']['digestBadges']> {
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId })
    return profile?.stats.digestBadges
  }

  /**
   * `origin.v1` lands on an account that already has `notifiedBadgeIds` — that
   * is every profile on the day this ships — so it is news exactly once, the
   * same way crossing any other threshold is.
   */
  it('tells a v1 account about the badge it has always had', async () => {
    const userId = await newProfile({ notifiedBadgeIds: [], withDevice: true, fromV1: true })

    const result = await runBadgeRoundUpPass(handle.db, push, now)
    expect(result).toEqual({ sent: 1, seeded: 0, failed: 0 })
    expect(push.sent[0]?.title).toContain('Early Adopter')
    expect(await notifiedIdsOf(userId)).toContain('origin.v1')

    const row = await handle.db
      .collection(COLLECTIONS.notifications)
      .findOne({ userId, kind: 'badgeEarned' })
    expect(row?.refId).toBe('origin.v1')
    expect((await pendingOf(userId))?.count).toBe(1)

    push.sent.length = 0
    expect(await runBadgeRoundUpPass(handle.db, push, now)).toEqual({
      sent: 0,
      seeded: 0,
      failed: 0,
    })
    expect(push.sent).toHaveLength(0)
  })

  it('never mentions it to anybody else', async () => {
    const userId = await newProfile({ notifiedBadgeIds: [], withDevice: true })
    await runBadgeRoundUpPass(handle.db, push, now)
    // Not "has it locked" — `getBadgeSummary` drops a cohort badge that is not
    // yours from the catalogue entirely, so there is nothing to be told about.
    expect(await notifiedIdsOf(userId)).not.toContain('origin.v1')
    expect(push.sent).toHaveLength(0)
  })

  /**
   * The one that matters on the day this ships: everybody already has badges,
   * and none of them are news.
   */
  it('seeds a profile it has never seen and says nothing', async () => {
    const userId = await newProfile({ messagesSent: 5000, withDevice: true })

    const result = await runBadgeRoundUpPass(handle.db, push, now)
    expect(result).toEqual({ sent: 0, seeded: 1, failed: 0 })
    expect(push.sent).toHaveLength(0)
    expect((await notifiedIdsOf(userId))?.length).toBeGreaterThan(0)
  })

  it('names a single new badge', async () => {
    const userId = await newProfile({ messagesSent: 0, withDevice: true })
    await runBadgeRoundUpPass(handle.db, push, now)
    // Cross one threshold between passes.
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })

    const result = await runBadgeRoundUpPass(handle.db, push, now)
    expect(result.sent).toBe(1)
    expect(push.sent[0]?.data.kind).toBe('badgeEarned')
    expect(push.sent[0]?.title).toContain('100 messages')
  })

  it('counts them instead when several arrive at once', async () => {
    const userId = await newProfile({ withDevice: true })
    await runBadgeRoundUpPass(handle.db, push, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne(
        { _id: userId as never },
        { $set: { 'stats.messagesSent': 5000, 'streak.longest': 60 } },
      )

    await runBadgeRoundUpPass(handle.db, push, now)
    // More than one, so a count rather than a list of English labels.
    expect(push.sent[0]?.title).not.toContain('messages')
  })

  it('says nothing twice about the same badge', async () => {
    const userId = await newProfile({ withDevice: true })
    await runBadgeRoundUpPass(handle.db, push, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })

    await runBadgeRoundUpPass(handle.db, push, now)
    const again = await runBadgeRoundUpPass(handle.db, push, now)
    expect(again.sent).toBe(0)
    expect(push.sent).toHaveLength(1)
  })

  /**
   * The mail half is no longer sent from here. `notifiedBadgeIds` is
   * overwritten by this pass, so the difference it found cannot be recomputed
   * at seven o'clock — it is written down instead, and the digest collects it.
   */
  it('leaves tonight’s badge news for the digest to carry', async () => {
    const userId = await newProfile()
    await runBadgeRoundUpPass(handle.db, push, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })

    // No phone, so nothing was pushed and the mail is the only channel left.
    expect((await runBadgeRoundUpPass(handle.db, push, now)).sent).toBe(0)
    expect(await pendingOf(userId)).toMatchObject({
      count: 1,
      label: '100 messages',
      pushed: false,
    })
  })

  /** A badge that buzzed a phone is a passenger, not a reason to write. */
  it('records that a phone was already told', async () => {
    const userId = await newProfile({ withDevice: true })
    await runBadgeRoundUpPass(handle.db, push, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })

    expect((await runBadgeRoundUpPass(handle.db, push, now)).sent).toBe(1)
    expect(await pendingOf(userId)).toMatchObject({ pushed: true })
  })

  it('writes nothing down for somebody who turned badge mail off', async () => {
    const userId = await newProfile({ notifications: { badges: { push: true, email: false } } })
    await runBadgeRoundUpPass(handle.db, push, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })

    await runBadgeRoundUpPass(handle.db, push, now)
    expect(await pendingOf(userId)).toBeUndefined()
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
    await runBadgeRoundUpPass(handle.db, push, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })

    expect((await runBadgeRoundUpPass(handle.db, push, now)).sent).toBe(0)
    expect(push.sent).toHaveLength(0)
    expect(await notifiedIdsOf(userId)).toContain('messages.100')
  })

  /**
   * The switches govern what *leaves* the app, and nothing else.
   *
   * Pins the notification centre's one load-bearing rule in the place it is
   * easiest to undo: the inbox row is written above the `wantsPush` /
   * `wantsEmail` gate in `notifyOne`, and moving it below — which reads like
   * tidying — silently turns the centre into a ninth switch nobody agreed to.
   * Somebody who muted badge push asked for quiet, not for the badges screen
   * to stay a mystery.
   */
  it('still records the badge for somebody who wants no notice of it', async () => {
    const userId = await newProfile({
      withDevice: true,
      notifications: { badges: { push: false, email: false } },
    })
    await runBadgeRoundUpPass(handle.db, push, now)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })
    await runBadgeRoundUpPass(handle.db, push, now)

    expect(push.sent).toHaveLength(0)
    expect(sender.messages).toHaveLength(0)
    const rows = await handle.db
      .collection<{ refId: string }>(COLLECTIONS.notifications)
      .find({ userId, kind: 'badgeEarned' })
      .toArray()
    expect(rows.map((row) => row.refId)).toContain('messages.100')
  })

  /**
   * The round-up writes the inbox row at six and the digest collects the rest
   * an hour later. Somebody who opened the app in between has read the news,
   * and on the web — where `pushed` is false because there is no phone — the
   * bell was the only way they could have.
   */
  describe('what tonight’s digest makes of it', () => {
    async function earnOne(): Promise<Profile> {
      const userId = await newProfile()
      await runBadgeRoundUpPass(handle.db, push, now)
      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne({ _id: userId as never }, { $set: { 'stats.messagesSent': 100 } })
      await runBadgeRoundUpPass(handle.db, push, now)
      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: userId })
      return profile as Profile
    }

    it('keeps the badge ids, so the section can ask', async () => {
      expect((await earnOne()).stats.digestBadges?.ids).toEqual(['messages.100'])
    })

    it('is still the news while the row is unread', async () => {
      const section = await badgeSectionFor(handle.db, await earnOne(), now)
      expect(section?.trigger).toBe(true)
    })

    it('rides along instead once the bell has shown it', async () => {
      const profile = await earnOne()
      await handle.db
        .collection(COLLECTIONS.notifications)
        .updateOne(
          { userId: profile._id, kind: 'badgeEarned', refId: 'messages.100' },
          { $set: { readAt: now } },
        )

      const section = await badgeSectionFor(handle.db, profile, now)
      expect(section?.trigger).toBe(false)
    })
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
    const result = await runBadgeRoundUpPass(handle.db, push, now, { warn })

    expect(result.failed).toBe(1)
    expect(warn).toHaveBeenCalledOnce()
    // The healthy profile was still reached, which is the whole point.
    expect(result.seeded).toBe(1)
    expect(await notifiedIdsOf(healthy)).toBeDefined()
  })

  /**
   * A guest is not an audience, and this was the one pass that walked them.
   *
   * The second row is the shape a guest is actually found in on the dev
   * database — no `streak` at all — which is how this surfaced: the round-up
   * reached it, `getBadgeSummary` read `streak.longest` off nothing, and the
   * pass logged a skipped profile on every tick. Both rows are asserted, so
   * the rule stays "a guest is never a candidate" rather than "a guest that
   * happens to be readable is harmless".
   */
  it('leaves a guest out of the audience entirely', async () => {
    for (const guest of [
      { _id: new ObjectId().toHexString(), streak: { current: 0, longest: 0 } },
      { _id: new ObjectId().toHexString() },
    ]) {
      await handle.db.collection(COLLECTIONS.profiles).insertOne({
        ...guest,
        guest: true,
        handle: `guest:${guest._id}`,
        displayName: '',
        // Otherwise the hour gate hides the bug rather than the fix doing it.
        timezone: zone,
        entitlement: { tier: 'free' },
        settings: { discoverable: false, notifications: {} },
        stats: { lastActiveAt: now, messagesSent: 0 },
        createdAt: new Date('2026-09-01T00:00:00Z'),
      } as never)
    }
    const healthy = await newProfile({ messagesSent: 5000, withDevice: true })

    const warn = vi.fn()
    const result = await runBadgeRoundUpPass(handle.db, push, now, { warn })

    expect(result).toEqual({ sent: 0, seeded: 1, failed: 0 })
    expect(warn).not.toHaveBeenCalled()
    expect(await notifiedIdsOf(healthy)).toBeDefined()
    const guests = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .find({ guest: true })
      .toArray()
    expect(guests.map((row) => row.stats?.notifiedBadgeIds)).toEqual([undefined, undefined])
  })

  it('leaves alone anyone for whom it is not the round-up hour', async () => {
    await newProfile({
      withDevice: true,
      timezone: zone === 'Etc/GMT+1' ? 'Etc/GMT+2' : 'Etc/GMT+1',
    })
    expect(await runBadgeRoundUpPass(handle.db, push, now)).toEqual({
      sent: 0,
      seeded: 0,
      failed: 0,
    })
  })
})
