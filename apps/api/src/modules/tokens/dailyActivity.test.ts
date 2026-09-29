import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import {
  countActiveToday,
  countersOf,
  dailyActivityId,
  readActivity,
  readActivityWeek,
  recordActivity,
  type DailyActivity,
} from './dailyActivity'

describe('countersOf', () => {
  it('reads a fully shaped document', () => {
    const doc = {
      messages: 3,
      corrections: 2,
      mutualConversations: 1,
      partners: ['a', 'b'],
    } as DailyActivity

    expect(countersOf(doc)).toEqual({
      messages: 3,
      corrections: 2,
      mutualConversations: 1,
      distinctPartners: 2,
    })
  })

  it('handles a document written by a correction, which has no partners', () => {
    // The regression. `$addToSet: { partners }` only runs when there is a
    // partner, and a correction has none — so a day that starts with teaching
    // produces a document with no `partners` field at all. Reading `.length`
    // off it was a 500 on the entire token summary.
    const doc = { messages: 0, corrections: 1, mutualConversations: 0 } as DailyActivity
    expect(countersOf(doc).distinctPartners).toBe(0)
    expect(countersOf(doc).corrections).toBe(1)
  })

  it('handles no activity at all', () => {
    expect(countersOf(null)).toEqual({
      messages: 0,
      corrections: 0,
      mutualConversations: 0,
      distinctPartners: 0,
    })
  })
})

describe('the week the profile chart draws', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  const userId = 'xue'

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'activity_week_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.dailyActivity).deleteMany({})
  })

  async function insert(day: string, messages: number, corrections = 0): Promise<void> {
    await handle.db.collection<DailyActivity>(COLLECTIONS.dailyActivity).insertOne({
      _id: dailyActivityId(userId, day),
      userId,
      day,
      messages,
      corrections,
      mutualConversations: 0,
      partners: [],
      perPartner: {},
      updatedAt: new Date(`${day}T12:00:00Z`),
    })
  }

  function daysOf(week: { day: string }[]): string[] {
    return week.map((row) => row.day)
  }

  it("ends on the reader's own today, not on the UTC one", async () => {
    // The regression, with the numbers off the bug report: 20:17 on a Sunday
    // in Vancouver, where UTC has already turned over to Monday. The last
    // column is the one drawn as "today", and it said Monday.
    const at = new Date('2026-09-21T03:17:00Z')

    const week = await readActivityWeek(handle.db, userId, at, 'America/Vancouver')

    expect(daysOf(week)).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ])
  })

  it('turns over ahead of UTC for a zone that is ahead of it', async () => {
    // 01:30 on Monday in Istanbul, while UTC is still on Sunday evening.
    const at = new Date('2026-09-20T22:30:00Z')

    const week = await readActivityWeek(handle.db, userId, at, 'Europe/Istanbul')

    expect(week.at(-1)?.day).toBe('2026-09-21')
  })

  it('turns over on a half-hour zone too', async () => {
    // 00:15 on Monday in Kolkata (+5:30). The window lands on whole local
    // days even where the offset does not; only a bucket's contents skew.
    const at = new Date('2026-09-20T18:45:00Z')

    const week = await readActivityWeek(handle.db, userId, at, 'Asia/Kolkata')

    expect(week.at(-1)?.day).toBe('2026-09-21')
  })

  it('leaves the UTC window exactly as it was when no zone is given', async () => {
    // Worth pinning: the same buckets feed the token caps and the pool cron,
    // and the default must not have moved under them.
    const at = new Date('2026-09-21T03:17:00Z')

    const week = await readActivityWeek(handle.db, userId, at)

    expect(daysOf(week)).toEqual(daysOf(await readActivityWeek(handle.db, userId, at, 'UTC')))
    expect(week.at(-1)?.day).toBe('2026-09-21')
    expect(week[0]?.day).toBe('2026-09-15')
  })

  it('falls back to UTC for a zone that is not a zone', async () => {
    const at = new Date('2026-09-21T03:17:00Z')

    const week = await readActivityWeek(handle.db, userId, at, 'Mars/Phobos')

    expect(week.at(-1)?.day).toBe('2026-09-21')
  })

  it('reads the local days that exist and zero-fills the rest, oldest first', async () => {
    await insert('2026-09-20', 4, 2)
    await insert('2026-09-18', 1)
    // A UTC-Monday document with no `perLocalDay`: its remainder falls under
    // its own UTC key, which is the reader's tomorrow and outside the window.
    await insert('2026-09-21', 9)

    const week = await readActivityWeek(
      handle.db,
      userId,
      new Date('2026-09-21T03:17:00Z'),
      'America/Vancouver',
    )

    expect(week).toHaveLength(7)
    expect(week.map((row) => row.messages)).toEqual([0, 0, 0, 0, 1, 0, 4])
    expect(week.map((row) => row.corrections)).toEqual([0, 0, 0, 0, 0, 0, 2])
  })
})

describe('the local day a bar actually holds', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  const userId = 'xue'

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'activity_local_day_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.dailyActivity).deleteMany({})
  })

  it('puts an evening west of UTC in the evening’s own bar', async () => {
    // The regression, and the half the window fix could not reach: 20:17 on a
    // Sunday in Vancouver, where UTC is already Monday. The message used to
    // land in a bucket the window had left behind, so the chart the sender
    // was looking at while sending showed nothing until the next day.
    const at = new Date('2026-09-21T03:17:00Z')
    await recordActivity(handle.db, { userId, kind: 'message', at, timeZone: 'America/Vancouver' })

    const week = await readActivityWeek(handle.db, userId, at, 'America/Vancouver')

    expect(week.at(-1)).toEqual({ day: '2026-09-20', messages: 1, corrections: 0 })
  })

  it('splits one UTC day into the two local days it covers', async () => {
    const before = new Date('2026-09-21T03:17:00Z') // Sunday 20:17 in Vancouver
    const after = new Date('2026-09-21T08:30:00Z') // Monday 01:30, same UTC day
    await recordActivity(handle.db, {
      userId,
      kind: 'message',
      at: before,
      timeZone: 'America/Vancouver',
    })
    await recordActivity(handle.db, {
      userId,
      kind: 'message',
      at: after,
      timeZone: 'America/Vancouver',
    })

    const week = await readActivityWeek(handle.db, userId, after, 'America/Vancouver')

    expect(week.at(-2)?.messages).toBe(1)
    expect(week.at(-1)?.messages).toBe(1)
  })

  it('leaves the caps and the pool reading one whole UTC day', async () => {
    // The bucket is still UTC and both counters are still whole. This is the
    // test that fails loudly if someone ever "simplifies" the `_id` to a
    // local day and quietly re-opens a cap for anyone who flies east.
    const before = new Date('2026-09-21T03:17:00Z')
    const after = new Date('2026-09-21T08:30:00Z')
    for (const at of [before, after]) {
      await recordActivity(handle.db, {
        userId,
        kind: 'message',
        at,
        timeZone: 'America/Vancouver',
      })
    }

    const documents = await handle.db.collection(COLLECTIONS.dailyActivity).countDocuments({})
    expect(documents).toBe(1)
    expect((await readActivity(handle.db, userId, after))?.messages).toBe(2)
    expect(await countActiveToday(handle.db, after)).toBe(1)
  })

  it('splits a half-hour zone exactly, where an hourly bucket could not', async () => {
    // 00:15 on Monday in Kolkata (+5:30), inside UTC Sunday. An hour-of-day
    // sub-bucket would have had to round this one; the local day is written
    // at source, so there is nothing to round.
    const at = new Date('2026-09-20T18:45:00Z')
    await recordActivity(handle.db, { userId, kind: 'message', at, timeZone: 'Asia/Kolkata' })

    const doc = await handle.db
      .collection<DailyActivity>(COLLECTIONS.dailyActivity)
      .findOne({ _id: dailyActivityId(userId, '2026-09-20') })
    expect(doc?.perLocalDay?.['2026-09-21']).toEqual({ messages: 1, corrections: 0 })

    const week = await readActivityWeek(handle.db, userId, at, 'Asia/Kolkata')
    expect(week.at(-1)).toEqual({ day: '2026-09-21', messages: 1, corrections: 0 })
  })

  it('reaches the documents on both sides of the window', async () => {
    // Why the read fetches nine documents and not seven. At +14 the local day
    // is written into the *previous* UTC document, at -12 into the next one;
    // narrow the `$in` back to seven and one of these two disappears.
    const ahead = new Date('2026-09-14T11:00:00Z') // 2026-09-15 in Kiritimati
    const behind = new Date('2026-09-21T09:00:00Z') // 2026-09-20 at UTC-12
    await recordActivity(handle.db, {
      userId,
      kind: 'message',
      at: ahead,
      timeZone: 'Pacific/Kiritimati',
    })
    await recordActivity(handle.db, { userId, kind: 'message', at: behind, timeZone: 'Etc/GMT+12' })

    const kiritimati = await readActivityWeek(handle.db, userId, behind, 'Pacific/Kiritimati')
    expect(kiritimati[0]).toEqual({ day: '2026-09-15', messages: 1, corrections: 0 })

    const westOfEverything = await readActivityWeek(handle.db, userId, behind, 'Etc/GMT+12')
    expect(westOfEverything.at(-1)).toEqual({ day: '2026-09-20', messages: 1, corrections: 0 })
  })

  it('files a correction under its local day, fully shaped', async () => {
    const at = new Date('2026-09-21T03:17:00Z')
    await recordActivity(handle.db, {
      userId,
      kind: 'correction',
      at,
      timeZone: 'America/Vancouver',
    })

    const doc = await handle.db
      .collection<DailyActivity>(COLLECTIONS.dailyActivity)
      .findOne({ _id: dailyActivityId(userId, '2026-09-21') })
    // Both counters present from the first write, as the top-level three are,
    // so the read can subtract without guarding every field.
    expect(doc?.perLocalDay?.['2026-09-20']).toEqual({ messages: 0, corrections: 1 })

    const week = await readActivityWeek(handle.db, userId, at, 'America/Vancouver')
    expect(week.at(-1)).toEqual({ day: '2026-09-20', messages: 0, corrections: 1 })
  })

  it('writes no local day for a mutual, and does not move the chart', async () => {
    const at = new Date('2026-09-21T03:17:00Z')
    await recordActivity(handle.db, { userId, kind: 'mutual', at, partnerId: 'other' })

    const doc = await handle.db
      .collection<DailyActivity>(COLLECTIONS.dailyActivity)
      .findOne({ _id: dailyActivityId(userId, '2026-09-21') })
    expect(doc?.mutualConversations).toBe(1)
    expect(doc?.perLocalDay).toBeUndefined()

    const week = await readActivityWeek(handle.db, userId, at, 'America/Vancouver')
    expect(week.every((row) => row.messages === 0 && row.corrections === 0)).toBe(true)
  })

  it('is a no-op end to end when no zone is given', async () => {
    const at = new Date('2026-09-21T03:17:00Z')
    await recordActivity(handle.db, { userId, kind: 'message', at })

    const doc = await handle.db
      .collection<DailyActivity>(COLLECTIONS.dailyActivity)
      .findOne({ _id: dailyActivityId(userId, '2026-09-21') })
    expect(doc?.perLocalDay?.['2026-09-21']).toEqual({ messages: 1, corrections: 0 })

    const week = await readActivityWeek(handle.db, userId, at)
    expect(week.at(-1)).toEqual({ day: '2026-09-21', messages: 1, corrections: 0 })
  })

  it('draws a document written across the deploy once and entirely', async () => {
    // Three messages counted before `perLocalDay` existed, two after. The
    // remainder is what keeps the first three: an either/or fallback would
    // drop them, and adding the whole-day total on top would draw all five
    // twice.
    await handle.db.collection<DailyActivity>(COLLECTIONS.dailyActivity).insertOne({
      _id: dailyActivityId(userId, '2026-09-21'),
      userId,
      day: '2026-09-21',
      messages: 5,
      corrections: 0,
      mutualConversations: 0,
      partners: [],
      perPartner: {},
      perLocalDay: { '2026-09-20': { messages: 2, corrections: 0 } },
      updatedAt: new Date('2026-09-21T03:17:00Z'),
    })

    const week = await readActivityWeek(handle.db, userId, new Date('2026-09-21T23:00:00Z'), 'UTC')

    expect(week.at(-2)?.messages).toBe(2)
    expect(week.at(-1)?.messages).toBe(3)
  })
})
