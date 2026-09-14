import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { runStreakDecayPass } from './streak'

describe('the streak decay pass', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  /** Mid-day UTC, so the local day is the 13th from Honolulu to Kiritimati. */
  const now = new Date('2026-09-13T12:00:00Z')

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'streak_decay_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
  })

  async function seed(
    lastQualifiedDay: string | null,
    opts: { current?: number; timezone?: string } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      timezone: opts.timezone ?? 'UTC',
      streak: { current: opts.current ?? 5, longest: 9, lastQualifiedDay },
    } as never)
    return userId
  }

  async function streakOf(userId: string): Promise<Profile['streak'] | undefined> {
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId })
    return profile?.streak
  }

  it('resets a streak nothing can save any more, and keeps the record', async () => {
    const userId = await seed('2026-09-10')
    expect(await runStreakDecayPass(handle.db, now)).toEqual({ reset: 1 })
    expect(await streakOf(userId)).toEqual({
      current: 0,
      longest: 9,
      lastQualifiedDay: '2026-09-10',
    })
  })

  it('leaves alone a streak that yesterday kept, or a freeze could still bridge', async () => {
    const yesterday = await seed('2026-09-12')
    const twoDays = await seed('2026-09-11')
    expect(await runStreakDecayPass(handle.db, now)).toEqual({ reset: 0 })
    expect((await streakOf(yesterday))?.current).toBe(5)
    expect((await streakOf(twoDays))?.current).toBe(5)
  })

  /**
   * The streak lives on the user's day. At noon UTC on the 13th it is the
   * 14th already in Kiritimati (UTC+14) and still the 13th in Honolulu
   * (UTC-10) — and the pass has to reach the same answer the person would,
   * looking at their own calendar.
   */
  it('counts the days where the person is', async () => {
    // The 11th is three days back on the 14th, two days back on the 13th.
    const east = await seed('2026-09-11', { timezone: 'Pacific/Kiritimati' })
    const west = await seed('2026-09-11', { timezone: 'Pacific/Honolulu' })
    expect(await runStreakDecayPass(handle.db, now)).toEqual({ reset: 1 })
    expect((await streakOf(east))?.current).toBe(0)
    expect((await streakOf(west))?.current).toBe(5)
  })

  it('does nothing to somebody who never qualified, or already sits at zero', async () => {
    await seed(null)
    await seed('2026-03-01', { current: 0 })
    expect(await runStreakDecayPass(handle.db, now)).toEqual({ reset: 0 })
  })

  it('is a no-op the second time', async () => {
    await seed('2026-09-01')
    await runStreakDecayPass(handle.db, now)
    expect(await runStreakDecayPass(handle.db, now)).toEqual({ reset: 0 })
  })
})
