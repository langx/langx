import { quotaLimit } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import type { Profile } from '../modules/profiles/profiles'
import { consumeQuota, QUOTA_REFUSAL_WINDOW_MS } from './quota'

const FREE_INITIATIONS = quotaLimit('free', 'initiations') ?? 0
const FREE_CAPTURES = quotaLimit('free', 'echoCaptures') ?? 0

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
      expect(await consumeQuota(handle.db, userId, 'free', 'initiations')).toMatchObject({
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
      expect(await consumeQuota(handle.db, userId, 'pro', 'initiations')).toMatchObject({
        consumed: true,
      })
    }
    expect(await refusalsOf(userId)).toEqual([])
  })
})

/**
 * A quota kind added after the profiles were written.
 *
 * `$filter` raises on a missing field rather than reading it as empty, so
 * before `$ifNull` this was a 500 on the first Echo capture by every account
 * that existed before Echo did — which is all of them. The profile below is
 * deliberately written the way `newProfile` above writes it, with the three
 * original arrays and no `echoCaptures`.
 */
describe('a quota bucket the profile has never had', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'quota_missing_bucket_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  async function profileWithoutEchoQuota(): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(-10)}`,
      quota: { initiations: [], translations: [], media: [] },
    } as never)
    return userId
  }

  it('is consumed rather than raising', async () => {
    const userId = await profileWithoutEchoQuota()
    expect(await consumeQuota(handle.db, userId, 'free', 'echoCaptures')).toMatchObject({
      consumed: true,
    })

    const stored = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId }, { projection: { quota: 1 } })
    expect(stored?.quota.echoCaptures).toHaveLength(1)
  })

  it('still refuses at the ceiling once the array exists', async () => {
    const userId = await profileWithoutEchoQuota()
    for (let index = 0; index < FREE_CAPTURES; index++) {
      expect(await consumeQuota(handle.db, userId, 'free', 'echoCaptures')).toMatchObject({
        consumed: true,
      })
    }
    expect(await consumeQuota(handle.db, userId, 'free', 'echoCaptures')).toMatchObject({
      consumed: false,
    })
  })

  it('charges the paid tiers the same, because the ceiling is not a paywall', async () => {
    const userId = await profileWithoutEchoQuota()
    for (let index = 0; index < FREE_CAPTURES; index++) {
      await consumeQuota(handle.db, userId, 'pro_plus', 'echoCaptures')
    }
    expect(await consumeQuota(handle.db, userId, 'pro_plus', 'echoCaptures')).toMatchObject({
      consumed: false,
    })
  })
})
