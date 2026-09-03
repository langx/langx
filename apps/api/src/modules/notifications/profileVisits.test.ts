import { PROFILE_VISITS_LOCAL_HOUR } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { NotificationEmailContext } from '../../email/notify'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { LoggingPushSender, type Device } from '../push/devices'
import { runProfileVisitsEmailPass, runProfileVisitsPushPass } from './profileVisits'

const SECRET = 'e'.repeat(40)
const DAY = 24 * 60 * 60 * 1000

/** A zone in which `now` reads as the round-up hour. */
function zoneWhereItIsRoundUpHour(now: Date): string {
  const offset = (now.getUTCHours() - PROFILE_VISITS_LOCAL_HOUR + 24) % 24
  if (offset === 0) return 'UTC'
  return offset <= 12 ? `Etc/GMT+${offset}` : `Etc/GMT-${24 - offset}`
}

describe('the profile-visit round-up', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let push: LoggingPushSender
  let sender: CapturingEmailSender
  let email: NotificationEmailContext
  // A Monday, so the weekly pass has something to do.
  const monday = new Date('2026-09-07T14:00:00Z')
  const zone = zoneWhereItIsRoundUpHour(monday)

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'profile_visits_test')
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
      COLLECTIONS.profileViews,
      COLLECTIONS.notificationLedger,
      COLLECTIONS.blocks,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    push = new LoggingPushSender()
    sender = new CapturingEmailSender()
    email = { sender, unsubscribeSecret: SECRET, apiBaseUrl: 'https://api2.langx.io' }
  })

  async function newProfile(
    opts: {
      tier?: string
      notifications?: unknown
      withDevice?: boolean
      timezone?: string
      name?: string
    } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(0, 8)}`,
      displayName: opts.name ?? `User ${userId.slice(0, 4)}`,
      timezone: opts.timezone ?? zone,
      entitlement: { tier: opts.tier ?? 'free' },
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
    } as never)
    await handle.db
      .collection(COLLECTIONS.user)
      .insertOne({ _id: authId(userId), email: `${userId}@example.com`, emailVerified: true })
    if (opts.withDevice) {
      await handle.db.collection<Device>(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: `ExponentPushToken[${userId}]`,
        platform: 'android',
        createdAt: monday,
        updatedAt: monday,
      } as never)
    }
    return userId
  }

  async function view(viewer: string, viewed: string, daysAgo = 0): Promise<void> {
    const at = new Date(monday.getTime() - daysAgo * DAY)
    await handle.db.collection(COLLECTIONS.profileViews).insertOne({
      viewerId: viewer,
      viewedId: viewed,
      firstViewedAt: at,
      lastViewedAt: at,
      count: 1,
    })
  }

  describe('the daily push', () => {
    it('sends one a day with a count and no names', async () => {
      const me = await newProfile({ withDevice: true })
      await view(await newProfile({ name: 'Ada' }), me)
      await view(await newProfile({ name: 'Bo' }), me)

      expect(await runProfileVisitsPushPass(handle.db, push, monday)).toEqual({ sent: 1 })
      const sent = push.sent[0]
      expect(sent?.data.kind).toBe('profileVisits')
      expect(sent?.title).toContain('2')
      // The list is the Pro half; a push naming somebody would give it away.
      expect(`${sent?.title} ${sent?.body}`).not.toContain('Ada')
    })

    it('does not send twice in one local day', async () => {
      const me = await newProfile({ withDevice: true })
      await view(await newProfile(), me)

      await runProfileVisitsPushPass(handle.db, push, monday)
      expect(await runProfileVisitsPushPass(handle.db, push, monday)).toEqual({ sent: 0 })
      expect(push.sent).toHaveLength(1)
    })

    it('says nothing when nobody looked', async () => {
      await newProfile({ withDevice: true })
      expect(await runProfileVisitsPushPass(handle.db, push, monday)).toEqual({ sent: 0 })
    })

    it('ignores a view older than a day', async () => {
      const me = await newProfile({ withDevice: true })
      await view(await newProfile(), me, 3)
      expect(await runProfileVisitsPushPass(handle.db, push, monday)).toEqual({ sent: 0 })
    })

    it('does not count somebody the viewed person blocked', async () => {
      const me = await newProfile({ withDevice: true })
      const blocked = await newProfile()
      await view(blocked, me)
      await handle.db
        .collection(COLLECTIONS.blocks)
        .insertOne({ blockerId: me, blockedId: blocked, createdAt: monday })

      expect(await runProfileVisitsPushPass(handle.db, push, monday)).toEqual({ sent: 0 })
    })

    it('respects the switch', async () => {
      const me = await newProfile({
        withDevice: true,
        notifications: { profileVisits: { push: false } },
      })
      await view(await newProfile(), me)
      expect(await runProfileVisitsPushPass(handle.db, push, monday)).toEqual({ sent: 0 })
    })

    /** The email face of this kind is the weekly summary, not a daily one. */
    it('has no email fallback', async () => {
      const me = await newProfile()
      await view(await newProfile(), me)
      expect(await runProfileVisitsPushPass(handle.db, push, monday)).toEqual({ sent: 0 })
      expect(sender.messages).toHaveLength(0)
    })
  })

  describe('the weekly email', () => {
    it('gives a free account the count and the reason to upgrade', async () => {
      const me = await newProfile()
      await view(await newProfile({ name: 'Ada Lovelace' }), me, 2)

      expect(await runProfileVisitsEmailPass(handle.db, email, monday)).toEqual({ sent: 1 })
      const message = sender.messages[0]
      expect(message?.subject).toContain('1')
      expect(message?.html).not.toContain('Ada Lovelace')
      expect(message?.text).toContain('Upgrade')
    })

    /** Polyglot, not Fluent: `profileViewerIdentities` is the higher tier's. */
    it('names them for an account allowed to see who', async () => {
      const me = await newProfile({ tier: 'pro_plus' })
      await view(await newProfile({ name: 'Ada Lovelace' }), me, 2)

      await runProfileVisitsEmailPass(handle.db, email, monday)
      expect(sender.messages[0]?.html).toContain('Ada Lovelace')
    })

    /**
     * Fluent buys unlimited conversations and the filters; seeing who looked
     * at you is Polyglot's. An email that named them would sell the wrong tier
     * — and would do it in writing, to somebody who paid for the other one.
     */
    it('still withholds the names from the middle tier', async () => {
      const me = await newProfile({ tier: 'pro' })
      await view(await newProfile({ name: 'Ada Lovelace' }), me, 2)

      await runProfileVisitsEmailPass(handle.db, email, monday)
      expect(sender.messages[0]?.html).not.toContain('Ada Lovelace')
    })

    it('only goes out on the reader’s own Monday', async () => {
      const me = await newProfile()
      await view(await newProfile(), me, 2)

      const tuesday = new Date(monday.getTime() + DAY)
      expect(await runProfileVisitsEmailPass(handle.db, email, tuesday)).toEqual({ sent: 0 })
    })

    it('does not send twice in one week', async () => {
      const me = await newProfile()
      await view(await newProfile(), me, 2)

      await runProfileVisitsEmailPass(handle.db, email, monday)
      expect(await runProfileVisitsEmailPass(handle.db, email, monday)).toEqual({ sent: 0 })
      expect(sender.messages).toHaveLength(1)
    })

    it('counts the whole week, not just today', async () => {
      const me = await newProfile()
      for (const daysAgo of [0, 2, 5]) await view(await newProfile(), me, daysAgo)

      await runProfileVisitsEmailPass(handle.db, email, monday)
      expect(sender.messages[0]?.subject).toContain('3')
    })
  })
})
