import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { INSIGHTS_IMAGES, readInsightsImage, readInsightsPage } from './page'
import { readPublicStats, resetPublicStatsCache, WINDOW_DAYS } from './publicStats'

/** Fixed, so "in the window" and "before it" are the same days on every run. */
const NOW = new Date('2026-09-08T12:00:00.000Z')
const TODAY = new Date('2026-09-08T01:00:00.000Z')
const YESTERDAY = new Date('2026-09-07T09:00:00.000Z')
/** Well outside the 30-day window: counted in the totals, absent from the series. */
const LONG_AGO = new Date('2026-07-01T09:00:00.000Z')

function profile(id: string, fields: Record<string, unknown>): Record<string, unknown> {
  return {
    _id: id,
    handle: id,
    displayName: id,
    nativeLanguages: [],
    learning: [],
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    createdAt: TODAY,
    ...fields,
  }
}

describe('public stats', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_insights_test')
    await handle.db.collection(COLLECTIONS.profiles).insertMany([
      profile('ada', {
        nativeLanguages: [{ code: 'tr' }],
        learning: [
          { code: 'es', level: 'a2', priority: 0 },
          { code: 'de', level: 'a1', priority: 1 },
        ],
        streak: { current: 3, longest: 9, lastQualifiedDay: '2026-09-08' },
      }),
      profile('bo', {
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'es', level: 'b1', priority: 0 }],
        streak: { current: 0, longest: 4, lastQualifiedDay: '2026-08-01' },
        createdAt: LONG_AGO,
      }),
      // Neither of these is a member: a guest is a browsing session with no
      // account, and a deleted account is gone even while its grace row is not.
      profile('guest', { guest: true, learning: [{ code: 'fr', level: 'a1', priority: 0 }] }),
      profile('gone', { deletedAt: TODAY, learning: [{ code: 'it', level: 'a1', priority: 0 }] }),
    ])
    await handle.db.collection(COLLECTIONS.messages).insertMany([
      { senderId: 'ada', createdAt: YESTERDAY },
      { senderId: 'bo', createdAt: YESTERDAY },
      { senderId: 'bo', createdAt: LONG_AGO },
    ])
    await handle.db
      .collection(COLLECTIONS.postCorrections)
      .insertMany([{ authorId: 'ada', createdAt: TODAY }])
    resetPublicStatsCache()
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  it('counts members, and neither guests nor deleted accounts', async () => {
    resetPublicStatsCache()
    const stats = await readPublicStats(handle.db, NOW)
    expect(stats.totals.members).toBe(2)
    expect(stats.totals.messages).toBe(3)
    expect(stats.totals.corrections).toBe(1)
    // Spanish and German. French and Italian belong to the two non-members.
    expect(stats.totals.languages).toBe(2)
  })

  it('gives every day of the window a point, zeros included', async () => {
    resetPublicStatsCache()
    const stats = await readPublicStats(handle.db, NOW)
    expect(stats.daily).toHaveLength(WINDOW_DAYS)
    expect(stats.daily[0]?.day).toBe('2026-08-10')
    expect(stats.daily.at(-1)).toEqual({
      day: '2026-09-08',
      members: 1,
      messages: 0,
      corrections: 1,
    })
    expect(stats.daily.at(-2)).toEqual({
      day: '2026-09-07',
      members: 0,
      messages: 2,
      corrections: 0,
    })
    // The old message and the old member are in the totals and nowhere here.
    expect(stats.daily.reduce((sum, point) => sum + point.messages, 0)).toBe(2)
    expect(stats.daily.reduce((sum, point) => sum + point.members, 0)).toBe(1)
  })

  it('ranks languages by how many members list them, with their English names', async () => {
    resetPublicStatsCache()
    const stats = await readPublicStats(handle.db, NOW)
    expect(stats.learning).toEqual([
      { code: 'es', name: 'Spanish', count: 2 },
      { code: 'de', name: 'German', count: 1 },
    ])
    expect(stats.native).toEqual([
      { code: 'en', name: 'English', count: 1 },
      { code: 'tr', name: 'Turkish', count: 1 },
    ])
  })

  it('reports the longest streak ever and who is on one now', async () => {
    resetPublicStatsCache()
    const stats = await readPublicStats(handle.db, NOW)
    expect(stats.streaks).toEqual({ longest: 9, active: 1 })
  })

  /** Last, because it writes: everything above reads the same fixture. */
  it('serves the kept answer until it is dropped', async () => {
    resetPublicStatsCache()
    const first = await readPublicStats(handle.db, NOW)
    await handle.db
      .collection(COLLECTIONS.postCorrections)
      .insertOne({ authorId: 'bo', createdAt: TODAY })

    expect((await readPublicStats(handle.db, NOW)).totals.corrections).toBe(
      first.totals.corrections,
    )
    resetPublicStatsCache()
    expect((await readPublicStats(handle.db, NOW)).totals.corrections).toBe(2)
  })
})

describe('the insights page', () => {
  /**
   * The asset exists and is found from source. Whether it reaches the image is
   * the Dockerfile's `dist/assets` copy, which is the same line the share-card
   * fonts arrive by.
   */
  it('is readable, and asks for the numbers it draws', async () => {
    const page = await readInsightsPage()
    expect(page).toContain('/public/stats')
  })

  it('carries every image it names, and names every image it draws', async () => {
    const page = await readInsightsPage()
    for (const name of INSIGHTS_IMAGES) {
      expect((await readInsightsImage(name)).byteLength).toBeGreaterThan(0)
      expect(page).toContain(`/public/insights/${name}`)
    }
  })
})
