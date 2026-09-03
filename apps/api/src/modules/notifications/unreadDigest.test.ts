import { UNREAD_DIGEST_MAX_SENDERS } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { NotificationEmailContext } from '../../email/notify'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { runUnreadDigestPass } from './unreadDigest'

const SECRET = 'd'.repeat(40)
const HOUR = 60 * 60 * 1000

/** A zone in which `now` reads as noon, safely inside the send window. */
function zoneWhereItIsNoon(now: Date): string {
  const offset = (now.getUTCHours() - 12 + 24) % 24
  if (offset === 0) return 'UTC'
  return offset <= 12 ? `Etc/GMT+${offset}` : `Etc/GMT-${24 - offset}`
}

describe('the unread-message digest', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let sender: CapturingEmailSender
  let ctx: NotificationEmailContext
  const now = new Date('2026-09-03T15:00:00Z')
  const zone = zoneWhereItIsNoon(now)

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'unread_digest_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.conversations,
      COLLECTIONS.notificationLedger,
      COLLECTIONS.blocks,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    sender = new CapturingEmailSender()
    ctx = { sender, unsubscribeSecret: SECRET, apiBaseUrl: 'https://api2.langx.io' }
  })

  async function newProfile(
    opts: { awayHours?: number; notifications?: unknown; timezone?: string; name?: string } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(0, 8)}`,
      displayName: opts.name ?? `User ${userId.slice(0, 4)}`,
      timezone: opts.timezone ?? zone,
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
      stats: {
        lastActiveAt: new Date(now.getTime() - (opts.awayHours ?? 12) * HOUR),
        messagesSent: 3,
      },
    } as never)
    await handle.db
      .collection(COLLECTIONS.user)
      .insertOne({ _id: authId(userId), email: `${userId}@example.com`, emailVerified: true })
    return userId
  }

  async function thread(
    reader: string,
    writer: string,
    opts: { unread?: number; minutesAgo?: number } = {},
  ): Promise<ObjectId> {
    const _id = new ObjectId()
    await handle.db.collection(COLLECTIONS.conversations).insertOne({
      _id,
      pairKey: `${reader}:${writer}:${_id.toHexString()}`,
      participants: [reader, writer],
      lastMessage: {
        body: 'a secret nobody should see in an inbox',
        senderId: writer,
        createdAt: new Date(now.getTime() - (opts.minutesAgo ?? 60) * 60_000),
      },
      unread: { [reader]: opts.unread ?? 2, [writer]: 0 },
    })
    return _id
  }

  it('names who wrote, counts what is waiting, and quotes nobody', async () => {
    const reader = await newProfile()
    const writer = await newProfile({ name: 'Ada Lovelace' })
    await thread(reader, writer, { unread: 2 })

    expect(await runUnreadDigestPass(handle.db, ctx, now)).toEqual({ sent: 1 })
    const message = sender.messages[0]
    expect(message?.subject).toContain('2')
    expect(message?.html).toContain('Ada Lovelace')
    // The one thing a digest must never carry.
    expect(message?.text).not.toContain('a secret nobody should see')
    expect(message?.html).not.toContain('a secret nobody should see')
  })

  /**
   * The period key is `lastActiveAt`, so a fortnight away is one email. A
   * daily key would have made this a daily nag.
   */
  it('sends once for one absence, however often it runs', async () => {
    const reader = await newProfile()
    await thread(reader, await newProfile())

    await runUnreadDigestPass(handle.db, ctx, now)
    expect(await runUnreadDigestPass(handle.db, ctx, new Date(now.getTime() + HOUR))).toEqual({
      sent: 0,
    })
    expect(sender.messages).toHaveLength(1)
  })

  it('sends again after they came back, left, and were written to once more', async () => {
    const reader = await newProfile()
    const id = await thread(reader, await newProfile())
    await runUnreadDigestPass(handle.db, ctx, now)

    // They opened the app, went away again, and a new message arrived after
    // that — which is a fresh `lastActiveAt`, so a fresh period key.
    const later = new Date(now.getTime() + 48 * HOUR)
    const cameBack = new Date(later.getTime() - 12 * HOUR)
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: reader as never }, { $set: { 'stats.lastActiveAt': cameBack } })
    await handle.db
      .collection(COLLECTIONS.conversations)
      .updateOne(
        { _id: id },
        { $set: { 'lastMessage.createdAt': new Date(cameBack.getTime() + HOUR) } },
      )

    expect(await runUnreadDigestPass(handle.db, ctx, later)).toEqual({ sent: 1 })
    expect(sender.messages).toHaveLength(2)
  })

  it('leaves alone somebody who was here an hour ago', async () => {
    const reader = await newProfile({ awayHours: 1 })
    await thread(reader, await newProfile())
    expect(await runUnreadDigestPass(handle.db, ctx, now)).toEqual({ sent: 0 })
  })

  it('leaves alone somebody gone longer than a fortnight', async () => {
    const reader = await newProfile({ awayHours: 24 * 20 })
    await thread(reader, await newProfile())
    expect(await runUnreadDigestPass(handle.db, ctx, now)).toEqual({ sent: 0 })
  })

  it('respects the switch for message email', async () => {
    const reader = await newProfile({ notifications: { messages: { email: false } } })
    await thread(reader, await newProfile())
    expect(await runUnreadDigestPass(handle.db, ctx, now)).toEqual({ sent: 0 })
  })

  /** 3am mail is a phone buzzing, whatever it says on the label. */
  it('waits for waking hours in the reader’s own timezone', async () => {
    const middleOfTheNight = (now.getUTCHours() - 3 + 24) % 24
    const reader = await newProfile({
      timezone: middleOfTheNight === 0 ? 'UTC' : `Etc/GMT+${middleOfTheNight}`,
    })
    await thread(reader, await newProfile())

    expect(await runUnreadDigestPass(handle.db, ctx, now)).toEqual({ sent: 0 })
    // And nothing was claimed, so the 9am tick still gets to send it.
    expect(await handle.db.collection(COLLECTIONS.notificationLedger).countDocuments({})).toBe(0)
  })

  it('says nothing when the only unread thread is from somebody blocked', async () => {
    const reader = await newProfile()
    const writer = await newProfile()
    await thread(reader, writer)
    await handle.db
      .collection(COLLECTIONS.blocks)
      .insertOne({ blockerId: reader, blockedId: writer, createdAt: now })

    expect(await runUnreadDigestPass(handle.db, ctx, now)).toEqual({ sent: 0 })
  })

  it('ignores a thread the reader archived', async () => {
    const reader = await newProfile()
    const id = await thread(reader, await newProfile())
    await handle.db
      .collection(COLLECTIONS.conversations)
      .updateOne({ _id: id }, { $set: { [`archivedBy.${reader}`]: true } })

    expect(await runUnreadDigestPass(handle.db, ctx, now)).toEqual({ sent: 0 })
  })

  it('ignores a thread whose last word was the reader’s own', async () => {
    const reader = await newProfile()
    const writer = await newProfile()
    const id = await thread(reader, writer)
    await handle.db
      .collection(COLLECTIONS.conversations)
      .updateOne({ _id: id }, { $set: { 'lastMessage.senderId': reader } })

    expect(await runUnreadDigestPass(handle.db, ctx, now)).toEqual({ sent: 0 })
  })

  it('says how many more there are once it has named enough', async () => {
    const reader = await newProfile()
    for (let i = 0; i < UNREAD_DIGEST_MAX_SENDERS + 1; i++) {
      await thread(reader, await newProfile(), { unread: 1, minutesAgo: 60 + i })
    }

    expect(await runUnreadDigestPass(handle.db, ctx, now)).toEqual({ sent: 1 })
    expect(sender.messages[0]?.text).toContain('1 more')
  })
})
