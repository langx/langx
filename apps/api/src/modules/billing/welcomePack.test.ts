import { PRO_WELCOME_PACKS } from '@langx/shared'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { grantWelcomePack } from './welcomePack'

function minimalProfile(id: string): Profile {
  const now = new Date()
  return {
    _id: id,
    handle: id,
    displayName: id,
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    interests: [],
    settings: { discoverable: true, notifications: true },
    privacy: { incognito: false },
    entitlement: { tier: 'free', updatedAt: now },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: now, messagesSent: 0 },
    createdAt: now,
    updatedAt: now,
  }
}

describe('grantWelcomePack', () => {
  let server: MongoMemoryServer
  let handle: DbHandle
  let seq = 0

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'welcome-pack-test')
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  async function seed(overrides: Partial<Profile> = {}): Promise<string> {
    seq++
    const id = `packuser${seq}`
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .insertOne({ ...minimalProfile(id), ...overrides })
    return id
  }

  function read(id: string) {
    return handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })
  }

  it('hands over what the tier includes', async () => {
    const id = await seed()
    const result = await grantWelcomePack(handle.db, id, 'pro')

    expect(result.granted).toBe(true)
    const profile = await read(id)
    expect(profile?.cosmetics).toEqual([...PRO_WELCOME_PACKS.pro.cosmetics])
    expect(profile?.streakFreezes).toBe(PRO_WELCOME_PACKS.pro.streakFreezes)
  })

  /**
   * `refreshEntitlement` is the single funnel every tier change passes
   * through, and it runs on the client's fallback poll as well as the webhook
   * — so this is called far more often than a subscription starts.
   */
  it('is idempotent, because the refresh that calls it is not a one-off', async () => {
    const id = await seed()
    await grantWelcomePack(handle.db, id, 'pro')
    const second = await grantWelcomePack(handle.db, id, 'pro')

    expect(second.granted).toBe(false)
    const profile = await read(id)
    expect(profile?.cosmetics).toHaveLength(PRO_WELCOME_PACKS.pro.cosmetics.length)
    expect(profile?.streakFreezes).toBe(PRO_WELCOME_PACKS.pro.streakFreezes)
  })

  it('grants only the difference when a pro subscriber upgrades', async () => {
    const id = await seed()
    await grantWelcomePack(handle.db, id, 'pro')
    const upgrade = await grantWelcomePack(handle.db, id, 'pro_plus')

    expect(upgrade.granted).toBe(true)
    // The bronze frame was already theirs and is not handed over twice.
    expect(upgrade.cosmetics).not.toContain('frame.bronze')
    const profile = await read(id)
    expect(new Set(profile?.cosmetics)).toEqual(new Set(PRO_WELCOME_PACKS.pro_plus.cosmetics))
  })

  it('gives nothing back to a pro_plus subscriber who drops to pro', async () => {
    const id = await seed()
    await grantWelcomePack(handle.db, id, 'pro_plus')
    const downgrade = await grantWelcomePack(handle.db, id, 'pro')

    expect(downgrade.granted).toBe(false)
    const profile = await read(id)
    expect(profile?.streakFreezes).toBe(PRO_WELCOME_PACKS.pro_plus.streakFreezes)
  })

  /**
   * The reason the grant is `$addToSet` over unowned items rather than a plain
   * push: even with the latch lost, a second run cannot duplicate a cosmetic.
   */
  it('cannot duplicate a cosmetic somebody already bought with token', async () => {
    // Derived from the pack rather than naming an id, so this keeps testing
    // the behaviour when the pack's contents move.
    const already = PRO_WELCOME_PACKS.pro.cosmetics[0]!
    const id = await seed({ cosmetics: [already] })
    const result = await grantWelcomePack(handle.db, id, 'pro')

    expect(result.cosmetics).not.toContain(already)
    const profile = await read(id)
    expect(profile?.cosmetics?.filter((c) => c === already)).toHaveLength(1)
    expect(new Set(profile?.cosmetics)).toEqual(new Set(PRO_WELCOME_PACKS.pro.cosmetics))
  })

  /**
   * The whole point of granting items rather than token: a balance is
   * `tokenAggregates.all` minus spending, and that aggregate is what the
   * all-time leaderboard ranks. Paying must not move anyone up it.
   */
  it('writes no ledger row and no aggregate, so paying buys no rank', async () => {
    const id = await seed()
    await grantWelcomePack(handle.db, id, 'pro_plus')

    expect(await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments({ userId: id })).toBe(
      0,
    )
    expect(
      await handle.db.collection(COLLECTIONS.tokenAggregates).countDocuments({ userId: id }),
    ).toBe(0)
    expect((await read(id))?.tokenSpent ?? 0).toBe(0)
  })
})
