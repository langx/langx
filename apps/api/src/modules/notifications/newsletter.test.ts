import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { NotificationEmailContext } from '../../email/notify'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { lastMonthKey, recapForMonth, runNewsletterPass } from './newsletter'

const SECRET = 'n'.repeat(40)
/** The first of October at noon UTC: the recap is about September. */
const FIRST = new Date('2026-10-01T20:00:00Z')

describe('the monthly recap', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let sender: CapturingEmailSender
  let ctx: NotificationEmailContext

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'newsletter_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.notificationLedger,
      COLLECTIONS.emailCampaigns,
      COLLECTIONS.dailyActivity,
      COLLECTIONS.tokenAggregates,
      COLLECTIONS.messages,
      COLLECTIONS.postCorrections,
      COLLECTIONS.echoAggregates,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    sender = new CapturingEmailSender()
    ctx = { sender, unsubscribeSecret: SECRET, apiBaseUrl: 'https://api.langx.io' }
  })

  async function newProfile(
    opts: { timezone?: string; optedIn?: boolean; streak?: number; createdAt?: Date } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(-10)}`,
      displayName: 'Sofia R.',
      timezone: opts.timezone ?? 'UTC',
      settings: {
        discoverable: true,
        notifications:
          opts.optedIn === false
            ? { promotions: { push: false, email: false } }
            : { promotions: { push: false, email: true } },
      },
      nativeLanguages: [{ code: 'en' }],
      streak: { current: opts.streak ?? 0, longest: 0, lastQualifiedDay: null },
      stats: { lastActiveAt: FIRST, messagesSent: 0 },
      createdAt: opts.createdAt ?? new Date('2026-01-01T00:00:00Z'),
    } as never)
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: `${userId}@example.com`,
      emailVerified: true,
    })
    return userId
  }

  async function activity(userId: string, day: string, messages: number, corrections: number) {
    await handle.db.collection(COLLECTIONS.dailyActivity).insertOne({
      _id: `${userId}:${day}`,
      userId,
      day,
      messages,
      corrections,
      mutualConversations: 0,
      partners: [],
      perPartner: {},
      updatedAt: FIRST,
    } as never)
  }

  it('names last month, not this one', () => {
    expect(lastMonthKey(FIRST)).toBe('2026-09')
    expect(lastMonthKey(new Date('2026-01-03T00:00:00Z'))).toBe('2025-12')
  })

  it('adds up the month from what is already counted', async () => {
    const userId = await newProfile({ streak: 4 })
    await activity(userId, '2026-09-02', 12, 3)
    await activity(userId, '2026-09-19', 8, 1)
    // A day in the month before must not leak in.
    await activity(userId, '2026-08-30', 99, 99)
    await handle.db.collection(COLLECTIONS.tokenAggregates).insertOne({
      _id: `${userId}:month:2026-09`,
      userId,
      periodType: 'month',
      periodKey: '2026-09',
      tokens: 640,
      updatedAt: FIRST,
    } as never)

    expect(await runNewsletterPass(handle.db, ctx, FIRST)).toEqual({ sent: 1 })
    const html = sender.messages[0]?.html ?? ''
    expect(sender.messages[0]?.subject).toContain('September 2026')
    expect(html).toContain('>20<')
    expect(html).toContain('>4<')
    expect(html).toContain('640')
  })

  /** Three zeroes at somebody is not a summary; one sentence is. */
  it('writes a different letter for a month somebody sat out', async () => {
    await newProfile()
    await runNewsletterPass(handle.db, ctx, FIRST)
    expect(sender.messages[0]?.html).toContain('You were quiet this month')
  })

  it('counts the community once and tells everybody the same numbers', async () => {
    await newProfile()
    await newProfile()
    await handle.db.collection(COLLECTIONS.messages).insertMany([
      { createdAt: new Date('2026-09-04T10:00:00Z') },
      { createdAt: new Date('2026-09-24T10:00:00Z') },
      // October: outside the month being summed.
      { createdAt: new Date('2026-10-01T01:00:00Z') },
    ] as never[])

    expect(await runNewsletterPass(handle.db, ctx, FIRST)).toEqual({ sent: 2 })
    for (const message of sender.messages) expect(message.html).toContain('>2<')
  })

  it('goes once a month, whatever the tick', async () => {
    await newProfile()
    expect(await runNewsletterPass(handle.db, ctx, FIRST)).toEqual({ sent: 1 })
    expect(await runNewsletterPass(handle.db, ctx, FIRST)).toEqual({ sent: 0 })
    // A day later is still the same month's recap.
    expect(await runNewsletterPass(handle.db, ctx, new Date('2026-10-03T20:00:00Z'))).toEqual({
      sent: 0,
    })
  })

  /** A deploy on the third must not skip the month; the claim stops the double. */
  it('catches up within the first week', async () => {
    await newProfile()
    expect(await runNewsletterPass(handle.db, ctx, new Date('2026-10-05T20:00:00Z'))).toEqual({
      sent: 1,
    })
    // And after the window it waits for the next month rather than arriving late.
    await handle.db.collection(COLLECTIONS.notificationLedger).deleteMany({})
    expect(await runNewsletterPass(handle.db, ctx, new Date('2026-10-20T20:00:00Z'))).toEqual({
      sent: 0,
    })
  })

  it('waits for the marketing slot, on the reader’s own clock', async () => {
    await newProfile({ timezone: 'Asia/Tokyo' })
    // 11:00 UTC is eight in the evening in Tokyo on the 1st.
    expect(await runNewsletterPass(handle.db, ctx, new Date('2026-10-01T11:00:00Z'))).toEqual({
      sent: 1,
    })

    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await handle.db.collection(COLLECTIONS.notificationLedger).deleteMany({})
    sender.messages.length = 0
    await newProfile({ timezone: 'America/Los_Angeles' })
    // 03:00 in Los Angeles is not eight in the evening anywhere.
    expect(await runNewsletterPass(handle.db, ctx, new Date('2026-10-01T10:00:00Z'))).toEqual({
      sent: 0,
    })
  })

  it('goes to everybody except the people who turned promotional mail off', async () => {
    await newProfile({ optedIn: false })
    expect(await runNewsletterPass(handle.db, ctx, FIRST)).toEqual({ sent: 0 })
  })

  it('gives the in-app recap the letter’s numbers plus the month’s Echo row', async () => {
    const userId = await newProfile({ streak: 12 })
    await handle.db.collection(COLLECTIONS.dailyActivity).insertMany([
      { userId, day: '2026-09-02', messages: 3, corrections: 1 },
      { userId, day: '2026-09-30', messages: 2, corrections: 0 },
      { userId, day: '2026-10-01', messages: 99, corrections: 99 },
    ] as never[])
    await handle.db
      .collection(COLLECTIONS.tokenAggregates)
      .insertOne({ _id: `${userId}:month:2026-09`, tokens: 40 } as never)
    await handle.db.collection(COLLECTIONS.echoAggregates).insertMany([
      { _id: `${userId}:month:2026-09`, userId, reviews: 25 },
      { _id: `${userId}:month:2026-08`, userId, reviews: 7 },
    ] as never[])

    expect(await recapForMonth(handle.db, userId, '2026-09')).toEqual({
      month: '2026-09',
      messages: 5,
      corrections: 1,
      tokens: 40,
      echoReviews: 25,
      // Today's streak: nothing records what it was at the end of September.
      currentStreak: 12,
    })
    expect(await recapForMonth(handle.db, userId, '2026-07')).toMatchObject({
      messages: 0,
      echoReviews: 0,
    })
  })
})
