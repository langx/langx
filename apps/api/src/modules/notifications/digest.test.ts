import { DAILY_DIGEST_LOCAL_HOUR, utcDayKey } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { NotificationEmailContext } from '../../email/notify'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { LoggingPushSender } from '../push/devices'
import { runDailyDigestPass } from './digest'
import { runPromotionsPass } from './promotions'

const SECRET = 'e'.repeat(40)
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** Seven in the evening UTC, so a UTC reader is in their own evening. */
const EVENING = new Date(`2026-09-14T${String(DAILY_DIGEST_LOCAL_HOUR).padStart(2, '0')}:00:00Z`)

describe('the one notification email of the day', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let sender: CapturingEmailSender
  let ctx: NotificationEmailContext

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'daily_digest_test')
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
      COLLECTIONS.conversations,
      COLLECTIONS.messages,
      COLLECTIONS.tokenLedger,
      COLLECTIONS.notificationLedger,
      COLLECTIONS.blocks,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    sender = new CapturingEmailSender()
    ctx = { sender, unsubscribeSecret: SECRET, apiBaseUrl: 'https://api.langx.io' }
  })

  async function newProfile(
    opts: {
      notifications?: unknown
      timezone?: string
      awayHours?: number
      name?: string
      speaks?: string
      learns?: string
      avatar?: boolean
    } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(-8)}`,
      displayName: opts.name ?? `User ${userId.slice(0, 4)}`,
      timezone: opts.timezone ?? 'UTC',
      createdAt: new Date(EVENING.getTime() - 30 * DAY),
      entitlement: { tier: 'free' },
      nativeLanguages: [{ code: opts.speaks ?? 'en' }],
      learning: [{ code: opts.learns ?? 'es', level: 'a1', priority: 1 }],
      interests: [],
      birthDate: '1996-04-01',
      streak: { current: 0 },
      privacy: { incognito: false, hideOnlineStatus: false },
      ...(opts.avatar === false ? {} : { avatarUrl: 'https://media.langx.test/a.jpg' }),
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
      stats: { lastActiveAt: new Date(EVENING.getTime() - (opts.awayHours ?? 10) * HOUR) },
    } as never)
    await handle.db
      .collection(COLLECTIONS.user)
      .insertOne({ _id: authId(userId), email: `${userId}@example.com`, emailVerified: true })
    return userId
  }

  /** An unread thread — the most ordinary reason for the mail to go at all. */
  async function unreadThread(reader: string, writer: string): Promise<void> {
    await handle.db.collection(COLLECTIONS.conversations).insertOne({
      participants: [reader, writer],
      unread: { [reader]: 2 },
      lastMessage: {
        createdAt: new Date(EVENING.getTime() - HOUR),
        senderId: writer,
        type: 'text',
      },
    })
  }

  /** Tokens that arrived overnight. */
  async function poolPaid(userId: string, amount: number): Promise<void> {
    await handle.db.collection(COLLECTIONS.tokenLedger).insertOne({
      userId,
      kind: 'dailyPool',
      refId: utcDayKey(new Date(EVENING.getTime() - DAY)),
      amount,
      createdAt: new Date(EVENING.getTime() - 12 * HOUR),
    })
  }

  /** A call both sides accepted, tomorrow morning. */
  async function meetingTomorrow(a: string, b: string): Promise<void> {
    const conversationId = new ObjectId()
    await handle.db
      .collection(COLLECTIONS.conversations)
      .insertOne({ _id: conversationId, participants: [a, b], unread: {} })
    await handle.db.collection(COLLECTIONS.messages).insertOne({
      conversationId,
      senderId: b,
      type: 'meeting',
      meeting: {
        startsAt: new Date(EVENING.getTime() + 15 * HOUR),
        durationMinutes: 30,
        status: 'accepted',
      },
      createdAt: new Date(EVENING.getTime() - DAY),
    })
  }

  it('says nothing to somebody with nothing pending', async () => {
    await newProfile()
    expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 0 })
    expect(sender.messages).toHaveLength(0)
  })

  it('carries every kind that has something to say in one mail', async () => {
    const reader = await newProfile()
    await unreadThread(reader, await newProfile({ name: 'Ada Lovelace' }))
    await poolPaid(reader, 7)
    await meetingTomorrow(reader, await newProfile({ name: 'Bo Diddley' }))

    // Two: the other side of tomorrow's call is told about it as well.
    expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 2 })

    const mail = sender.messages.find((message) => message.to === `${reader}@example.com`)
    // The subject comes from the first section that survived — the one that
    // cannot wait, which is somebody waiting for an answer.
    expect(mail?.subject).toContain('2')
    expect(mail?.html).toContain('Ada Lovelace')
    expect(mail?.html).toContain('Bo Diddley')
    expect(mail?.html).toContain('7')
    // One letter, and it says how to stop all of them.
    expect(mail?.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(mail?.headers?.['List-Unsubscribe']).toContain('.all.')
  })

  it('leaves out a kind whose switch is off, and sends the rest', async () => {
    const reader = await newProfile({ notifications: { wallet: { push: true, email: false } } })
    await unreadThread(reader, await newProfile())
    await poolPaid(reader, 7)

    expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 1 })
    expect(sender.messages[0]?.html).not.toContain('7 token')
  })

  it('sends nothing at all when every kind is off', async () => {
    const reader = await newProfile({
      notifications: {
        messages: { push: true, email: false },
        wallet: { push: true, email: false },
      },
    })
    await unreadThread(reader, await newProfile())
    await poolPaid(reader, 7)

    expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 0 })
    expect(sender.messages).toHaveLength(0)
  })

  /**
   * The rule the whole design rests on: suggestions ride along, they never
   * summon the mail. An account with nothing happening hears nothing, however
   * many people it could be introduced to.
   */
  describe('people you could practise with', () => {
    async function threeMatches(): Promise<void> {
      for (const name of ['Cy Twombly', 'Di Prima', 'Eve Babitz']) {
        await newProfile({ name, speaks: 'es', learns: 'en' })
      }
    }

    it('never writes a letter of its own', async () => {
      await newProfile()
      await threeMatches()

      expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 0 })
      expect(sender.messages).toHaveLength(0)
    })

    it('rides along when the mail is going anyway', async () => {
      const reader = await newProfile()
      await threeMatches()
      await poolPaid(reader, 7)

      expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 1 })
      expect(sender.messages[0]?.html).toContain('Cy Twombly')
    })

    it('does not offer somebody they are already talking to', async () => {
      const reader = await newProfile()
      await threeMatches()
      const known = await newProfile({ name: 'Fay Weldon', speaks: 'es', learns: 'en' })
      const fayHandle = `h${known.slice(-8)}`
      await unreadThread(reader, known)

      await runDailyDigestPass(handle.db, ctx, EVENING)
      const html = sender.messages[0]?.html ?? ''
      // She is in the mail once, as the person who wrote — and not a second
      // time under the suggestions, which link to a profile.
      expect(html).toContain('Fay Weldon')
      expect(html.split(fayHandle)).toHaveLength(2)
    })
  })

  it('goes once a day, however many times the tick runs', async () => {
    const reader = await newProfile()
    await unreadThread(reader, await newProfile())

    await runDailyDigestPass(handle.db, ctx, EVENING)
    expect(
      await runDailyDigestPass(handle.db, ctx, new Date(EVENING.getTime() + 30 * 60 * 1000)),
    ).toMatchObject({ sent: 0 })
    expect(sender.messages).toHaveLength(1)
  })

  it('waits for the evening where the reader is', async () => {
    const reader = await newProfile({ timezone: 'Asia/Tokyo' })
    await unreadThread(reader, await newProfile())

    // Seven in the evening UTC is four in the morning in Tokyo.
    expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 0 })
    // Nothing claimed, so their own evening still gets to send it.
    expect(await handle.db.collection(COLLECTIONS.notificationLedger).countDocuments({})).toBe(0)
  })

  /**
   * The other half of "one mail a day": marketing runs an hour later and
   * stands down on any day the digest has already written.
   */
  it('takes the day’s slot from the nudges', async () => {
    const reader = await newProfile({ avatar: false })
    // The writer wants no marketing, so the only nudge in play is the
    // reader's — they have no photo, which `promo.photo` would ask about.
    await unreadThread(
      reader,
      await newProfile({ notifications: { promotions: { push: false, email: false } } }),
    )
    const push = new LoggingPushSender()

    expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 1 })
    const nudges = await runPromotionsPass(
      handle.db,
      { email: ctx, push },
      new Date(EVENING.getTime() + HOUR),
    )

    // Without the digest this account would have been asked for a photo.
    expect(nudges).toEqual({ sent: 0 })
    expect(sender.messages).toHaveLength(1)
  })
})
