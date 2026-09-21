import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { countersOf, dailyActivityId, readActivityWeek, type DailyActivity } from './dailyActivity'

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
    // A UTC-Monday document: real activity, but the reader's tomorrow. It is
    // outside the window on purpose — that is the skew the docstring names.
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
