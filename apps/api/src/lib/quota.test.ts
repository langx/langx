import { quotaLimit } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import type { Profile } from '../modules/profiles/profiles'
import { consumeQuota, QUOTA_REFUSAL_WINDOW_MS } from './quota'

const FREE_INITIATIONS = quotaLimit('free', 'initiations') ?? 0

describe('what a refused quota leaves behind', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'quota_refusal_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
  })

  async function newProfile(refusals?: Date[]): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(-10)}`,
      quota: { initiations: [], translations: [], media: [] },
      ...(refusals ? { quotaRefusals: refusals } : {}),
    } as never)
    return userId
  }

  const refusalsOf = async (userId: string): Promise<Date[]> =>
    (
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: userId }, { projection: { quotaRefusals: 1 } })
    )?.quotaRefusals ?? []

  it('writes nothing while there is room', async () => {
    const userId = await newProfile()
    for (let index = 0; index < FREE_INITIATIONS; index++) {
      expect(await consumeQuota(handle.db, userId, 'free', 'initiations')).toEqual({
        consumed: true,
      })
    }
    expect(await refusalsOf(userId)).toEqual([])
  })

  /** The counter the upsell nudge reads: once is Tuesday, three times is a pattern. */
  it('remembers each refusal', async () => {
    const userId = await newProfile()
    for (let index = 0; index < FREE_INITIATIONS; index++) {
      await consumeQuota(handle.db, userId, 'free', 'initiations')
    }
    const refused = await consumeQuota(handle.db, userId, 'free', 'initiations')
    expect(refused.consumed).toBe(false)
    await consumeQuota(handle.db, userId, 'free', 'initiations')
    expect(await refusalsOf(userId)).toHaveLength(2)
  })

  it('drops the ones outside the window rather than growing forever', async () => {
    const old = new Date(Date.now() - QUOTA_REFUSAL_WINDOW_MS - 60_000)
    const userId = await newProfile([old, old])
    for (let index = 0; index < FREE_INITIATIONS; index++) {
      await consumeQuota(handle.db, userId, 'free', 'initiations')
    }
    await consumeQuota(handle.db, userId, 'free', 'initiations')

    const kept = await refusalsOf(userId)
    expect(kept).toHaveLength(1)
    expect(kept[0]?.getTime()).toBeGreaterThan(old.getTime())
  })

  /** A paid tier has no limit to hit, so nothing is ever refused or recorded. */
  it('never records anything for a tier with no limit', async () => {
    const userId = await newProfile()
    for (let index = 0; index < FREE_INITIATIONS + 5; index++) {
      expect(await consumeQuota(handle.db, userId, 'pro', 'initiations')).toEqual({
        consumed: true,
      })
    }
    expect(await refusalsOf(userId)).toEqual([])
  })
})
