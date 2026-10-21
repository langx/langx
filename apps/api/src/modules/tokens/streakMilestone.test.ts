import { TOKEN_RULES } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { recordQualifyingAction } from './streak'

describe('the streak milestone payout', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  const now = new Date('2026-09-13T12:00:00Z')
  const milestone = Math.min(...Object.keys(TOKEN_RULES.streakMilestones).map(Number))

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'streak_milestone_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await handle.db.collection(COLLECTIONS.tokenLedger).deleteMany({})
  })

  /** One day short of the first milestone, kept yesterday. */
  async function seed(extra: Partial<Profile> = {}): Promise<Profile> {
    const profile = {
      _id: new ObjectId().toHexString(),
      timezone: 'UTC',
      streak: { current: milestone - 1, longest: milestone - 1, lastQualifiedDay: '2026-09-12' },
      ...extra,
    } as unknown as Profile
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(profile)
    return profile
  }

  async function streakRows(userId: string): Promise<number> {
    return handle.db.collection(COLLECTIONS.tokenLedger).countDocuments({ userId, kind: 'streak' })
  }

  it('pays the milestone to an account in good standing', async () => {
    const profile = await seed()
    const result = await recordQualifyingAction(handle.db, profile, now)
    expect(result.current).toBe(milestone)
    expect(result.milestoneXp).toBeGreaterThan(0)
    expect(await streakRows(profile._id)).toBe(1)
  })

  it('pays nothing to a token-frozen account, and still counts its streak', async () => {
    const profile = await seed({ tokenFrozenAt: new Date('2026-09-01T00:00:00Z') })
    const result = await recordQualifyingAction(handle.db, profile, now)
    expect(result.current).toBe(milestone)
    expect(result.milestoneXp).toBe(0)
    expect(await streakRows(profile._id)).toBe(0)
  })
})
