import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { NotificationEmailContext } from '../../email/notify'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import {
  lastMonthKey,
  lastYearKey,
  recapForMonth,
  recapForYear,
  runNewsletterPass,
} from './newsletter'

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

  it('counts the month’s posts, the reader’s and everybody’s', async () => {
    const userId = await newProfile()
    const other = await newProfile()
    await handle.db.collection(COLLECTIONS.posts).insertMany([
      { authorId: userId, createdAt: new Date('2026-09-03T10:00:00Z') },
      { authorId: userId, createdAt: new Date('2026-09-20T10:00:00Z') },
      { authorId: userId, createdAt: new Date('2026-09-21T10:00:00Z') },
      // Hidden: gone from the reader's own count, as from their profile.
      { authorId: userId, createdAt: new Date('2026-09-22T10:00:00Z'), hiddenAt: FIRST },
      // October: outside the month being summed.
      { authorId: userId, createdAt: new Date('2026-10-01T01:00:00Z') },
      { authorId: other, createdAt: new Date('2026-09-10T10:00:00Z') },
    ] as never[])

    await runNewsletterPass(handle.db, ctx, FIRST)
    const mine = sender.messages.find((message) => message.to === `${userId}@example.com`)
    // Their three posts, and posts alone are enough not to be a quiet month.
    expect(mine?.text).toContain('Posts shared: 3')
    expect(mine?.text).not.toContain('You were quiet this month')
    // Everybody's five in September, hidden one included — how much happened.
    expect(mine?.text).toMatch(/Posts shared: 5\b/)
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

  /** Grants never reach the month aggregates, so the total has to come from the ledger. */
  it('counts every token given out, grants and the pool included, spends not', async () => {
    await newProfile()
    await handle.db.collection(COLLECTIONS.tokenLedger).insertMany([
      { userId: 'a', kind: 'dailyPool', amount: 400, day: '2026-09-12' },
      { userId: 'b', kind: 'signupBonus', amount: 250, day: '2026-09-30' },
      { userId: 'a', kind: 'message', amount: 7, day: '2026-09-01' },
      { userId: 'a', kind: 'spend', amount: -300, day: '2026-09-15' },
      // October: outside the month being summed.
      { userId: 'a', kind: 'dailyPool', amount: 999, day: '2026-10-01' },
    ] as never[])

    await runNewsletterPass(handle.db, ctx, FIRST)
    expect(sender.messages[0]?.text).toMatch(/Tokens given out: 657\b/)
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
      { userId, day: '2026-09-02', messages: 3, corrections: 1, partners: ['a', 'b'] },
      // A correction-only day has no `partners` field at all.
      { userId, day: '2026-09-11', messages: 0, corrections: 2 },
      // The partner's side of a mutual bonus: a row, but not an active day.
      { userId, day: '2026-09-20', messages: 0, corrections: 0, mutualConversations: 1 },
      { userId, day: '2026-09-30', messages: 2, corrections: 0, partners: ['b', 'c'] },
      { userId, day: '2026-10-01', messages: 99, corrections: 99, partners: ['z'] },
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
      corrections: 3,
      tokens: 40,
      echoReviews: 25,
      // Today's streak: nothing records what it was at the end of September.
      currentStreak: 12,
      // a, b and c — b on two days is still one person.
      partners: 3,
      activeDays: 3,
      activeDates: [2, 11, 30],
    })
    expect(await recapForMonth(handle.db, userId, '2026-07')).toMatchObject({
      messages: 0,
      echoReviews: 0,
    })
  })

  it('sums a year from the same rows, a square per month', async () => {
    expect(lastYearKey(FIRST)).toBe('2025')
    const userId = await newProfile({ streak: 5 })
    await handle.db.collection(COLLECTIONS.dailyActivity).insertMany([
      { userId, day: '2026-01-05', messages: 4, corrections: 0, partners: ['a'] },
      { userId, day: '2026-01-06', messages: 0, corrections: 2 },
      { userId, day: '2026-09-30', messages: 6, corrections: 1, partners: ['a', 'b'] },
      // Somebody else's mutual bonus: a row, not an active day.
      { userId, day: '2026-03-01', messages: 0, corrections: 0, mutualConversations: 1 },
      // The neighbouring years stay out.
      { userId, day: '2025-12-31', messages: 99, corrections: 99, partners: ['z'] },
      { userId, day: '2027-01-01', messages: 99, corrections: 99, partners: ['z'] },
    ] as never[])
    await handle.db.collection(COLLECTIONS.tokenAggregates).insertMany([
      { _id: `${userId}:year:2026`, tokens: 300 },
      { _id: `${userId}:month:2026-09`, tokens: 40 },
    ] as never[])
    await handle.db
      .collection(COLLECTIONS.echoAggregates)
      .insertOne({ _id: `${userId}:year:2026`, userId, reviews: 80 } as never)

    expect(await recapForYear(handle.db, userId, '2026')).toEqual({
      year: '2026',
      messages: 10,
      corrections: 3,
      tokens: 300,
      echoReviews: 80,
      currentStreak: 5,
      partners: 2,
      activeDays: 3,
      activeMonths: [2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    })
  })
})
