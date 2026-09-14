import { ECHO_REMINDER_LOCAL_HOUR, newCardSrs } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { LoggingPushSender, type Device } from '../push/devices'
import { runEchoReminderPass } from './echoReminder'

/** A zone in which `now` reads as the nudge's hour. */
function zoneWhereItIsNudgeHour(now: Date): string {
  const offset = (now.getUTCHours() - ECHO_REMINDER_LOCAL_HOUR + 24) % 24
  if (offset === 0) return 'UTC'
  return offset <= 12 ? `Etc/GMT+${offset}` : `Etc/GMT-${24 - offset}`
}

describe('the evening Echo nudge', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let push: LoggingPushSender
  const now = new Date('2026-09-14T14:00:00Z')
  const zone = zoneWhereItIsNudgeHour(now)

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'echo_reminder_test')
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
      COLLECTIONS.echoCards,
      COLLECTIONS.echoReviews,
      COLLECTIONS.notificationLedger,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  async function learner(
    opts: { timezone?: string; withDevice?: boolean; notifications?: unknown } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(0, 8)}`,
      displayName: 'Learner',
      timezone: opts.timezone ?? zone,
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
    } as never)
    if (opts.withDevice !== false) {
      await handle.db.collection<Device>(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: `ExponentPushToken[${userId}]`,
        platform: 'android',
        createdAt: now,
        updatedAt: now,
      } as never)
    }
    return userId
  }

  async function dueCard(userId: string, dueAt = new Date(now.getTime() - 60_000)): Promise<void> {
    await handle.db.collection(COLLECTIONS.echoCards).insertOne({
      _id: new ObjectId(),
      userId,
      lang: 'fr',
      front: 'On y va demain ?',
      back: 'Shall we go tomorrow?',
      source: { kind: 'chat', conversationId: 'c', messageId: 'm', partnerId: 'p' },
      sourceKey: `msg:${new ObjectId().toHexString()}`,
      srs: { ...newCardSrs(dueAt), due: dueAt },
      createdAt: dueAt,
    })
  }

  it('nudges somebody with cards waiting', async () => {
    const userId = await learner()
    await dueCard(userId)

    expect(await runEchoReminderPass(handle.db, push, now)).toEqual({ sent: 1 })
    expect(push.sent).toHaveLength(1)
    expect(push.sent[0]?.data).toEqual({ kind: 'echo' })
  })

  it('says nothing to somebody who has already reviewed today', async () => {
    // The nudge exists to start a session. They started one.
    const userId = await learner()
    await dueCard(userId)
    await handle.db.collection(COLLECTIONS.echoReviews).insertOne({
      _id: new ObjectId(),
      userId,
      reviewId: 'already-reviewed-1',
      cardId: new ObjectId(),
      grade: 'good',
      at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      durationMs: 900,
    })

    expect(await runEchoReminderPass(handle.db, push, now)).toEqual({ sent: 0 })
  })

  it('says nothing when nothing is due', async () => {
    const userId = await learner()
    await dueCard(userId, new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000))
    expect(await runEchoReminderPass(handle.db, push, now)).toEqual({ sent: 0 })
  })

  it('waits for the reader’s own evening', async () => {
    const userId = await learner({ timezone: 'Etc/GMT+3' === zone ? 'UTC' : 'Etc/GMT+3' })
    await dueCard(userId)
    expect(await runEchoReminderPass(handle.db, push, now)).toEqual({ sent: 0 })
  })

  it('obeys the switch', async () => {
    const userId = await learner({ notifications: { echo: { push: false } } })
    await dueCard(userId)
    expect(await runEchoReminderPass(handle.db, push, now)).toEqual({ sent: 0 })
  })

  it('sends once a day, however often the pass runs', async () => {
    const userId = await learner()
    await dueCard(userId)

    expect(await runEchoReminderPass(handle.db, push, now)).toEqual({ sent: 1 })
    // The scheduler ticks every half hour; the hour has not changed.
    expect(await runEchoReminderPass(handle.db, push, now)).toEqual({ sent: 0 })
    expect(push.sent).toHaveLength(1)
  })
})
