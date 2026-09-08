import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { LoggingPushSender } from './devices'
import { MEETING_REMINDER_LEAD_MS, runMeetingReminderTick } from './meetingReminders'

describe('the meeting reminder pass', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let push: LoggingPushSender
  const now = new Date('2026-09-10T09:00:00Z')
  const due = new Date(now.getTime() + MEETING_REMINDER_LEAD_MS + 60_000)

  const alice = new ObjectId().toHexString()
  const bob = new ObjectId().toHexString()

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'meeting_reminder_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.devices,
      COLLECTIONS.messages,
      COLLECTIONS.conversations,
      COLLECTIONS.meetingReminders,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    push = new LoggingPushSender()
  })

  async function seed(
    opts: { status?: string; startsAt?: Date; notifications?: unknown } = {},
  ): Promise<string> {
    const conversationId = new ObjectId()
    await handle.db
      .collection(COLLECTIONS.conversations)
      .insertOne({ _id: conversationId, participants: [alice, bob] })
    for (const userId of [alice, bob]) {
      // Typed, because a string `_id` is our convention and Mongo's default
      // document type expects an ObjectId — see `lib/authId.ts`.
      await handle.db
        .collection<{ _id: string; settings: { notifications: unknown } }>(COLLECTIONS.profiles)
        .insertOne({
          _id: userId,
          settings: { notifications: opts.notifications ?? { meetings: { push: true } } },
        })
      await handle.db.collection(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: `ExponentPushToken[${userId}]`,
        locale: 'en',
        platform: 'ios',
      })
    }
    const messageId = new ObjectId()
    await handle.db.collection(COLLECTIONS.messages).insertOne({
      _id: messageId,
      conversationId,
      senderId: alice,
      type: 'meeting',
      body: '',
      meeting: {
        startsAt: opts.startsAt ?? due,
        durationMinutes: 30,
        status: opts.status ?? 'accepted',
      },
      createdAt: now,
    })
    return messageId.toHexString()
  }

  /** Both of them: a reminder that reaches one is the half that turns up. */
  it('pushes to both participants, once each', async () => {
    await seed()
    const { pushed } = await runMeetingReminderTick(handle.db, push, now)
    expect(pushed).toBe(2)
    expect(push.sent).toHaveLength(2)
    expect(push.sent[0]?.data.kind).toBe('meetingReminder')
    // The thread it was agreed in, so the tap lands somewhere useful.
    expect(push.sent[0]?.data.conversationId).toBeDefined()
  })

  /**
   * The guard the ledger exists for. Two ticks land inside one window, and
   * being buzzed twice about one call is how a permission gets revoked.
   */
  it('never reminds the same meeting twice', async () => {
    await seed()
    await runMeetingReminderTick(handle.db, push, now)
    const second = await runMeetingReminderTick(handle.db, push, now)
    expect(second.pushed).toBe(0)
    expect(push.sent).toHaveLength(2)
  })

  it.each(['proposed', 'declined', 'cancelled'])(
    'says nothing about a meeting that is %s',
    async (status) => {
      await seed({ status })
      expect((await runMeetingReminderTick(handle.db, push, now)).pushed).toBe(0)
    },
  )

  it('leaves a meeting outside the window for a later pass', async () => {
    // Three hours out: found by the tick three hours from now, not this one.
    await seed({ startsAt: new Date(now.getTime() + 3 * 60 * 60 * 1000) })
    expect((await runMeetingReminderTick(handle.db, push, now)).pushed).toBe(0)
  })

  it('respects the switch, per person', async () => {
    await seed({ notifications: { meetings: { push: false } } })
    expect((await runMeetingReminderTick(handle.db, push, now)).pushed).toBe(0)
  })
})
