import { PRO_WELCOME_PACKS } from '@langx/shared'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { refreshEntitlement } from './refresh'
import type { RevenueCatClient, SubscriberEntitlement } from './revenueCatClient'
import { earnsWelcomePack, grantWelcomePack } from './welcomePack'

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

  /**
   * The webhook and the client's `POST /billing/refresh` both land within a
   * second of a purchase, so two grants racing is the ordinary case, not a
   * rare one. The latch has to be claimed by the write itself; read first, both
   * saw no latch and both handed over the freezes.
   *
   * Thirty rounds because one pair of calls in-process rarely interleaves;
   * before the fix, thirty never all came out right.
   */
  it('hands the pack over once when two refreshes race', async () => {
    for (let i = 0; i < 30; i++) {
      const id = await seed()
      const results = await Promise.all([
        grantWelcomePack(handle.db, id, 'pro'),
        grantWelcomePack(handle.db, id, 'pro'),
      ])

      expect(results.filter((r) => r.granted)).toHaveLength(1)
      expect((await read(id))?.streakFreezes).toBe(PRO_WELCOME_PACKS.pro.streakFreezes)
    }
  })

  /**
   * Neither key is migrated by the merge: an ex-Polyglot's `pro_plus` latch
   * must keep the pack and its two freezes from being handed over again, and
   * an ex-Fluent's `pro` latch leaves their difference to the merge script.
   */
  it('reads either latch as the pack already given', async () => {
    for (const key of ['pro', 'pro_plus'] as const) {
      const id = await seed({ welcomePackAt: { [key]: new Date() }, streakFreezes: 1 })
      expect((await grantWelcomePack(handle.db, id, 'pro')).granted, key).toBe(false)
      expect((await read(id))?.streakFreezes, key).toBe(1)
    }
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
    await grantWelcomePack(handle.db, id, 'pro')

    expect(await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments({ userId: id })).toBe(
      0,
    )
    expect(
      await handle.db.collection(COLLECTIONS.tokenAggregates).countDocuments({ userId: id }),
    ).toBe(0)
    expect((await read(id))?.tokenSpent ?? 0).toBe(0)
  })
})

describe('earnsWelcomePack', () => {
  const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  it('is a store purchase or a store free week', () => {
    for (const periodType of ['normal', 'trial', 'intro'] as const) {
      expect(
        earnsWelcomePack({ tier: 'pro', store: 'app_store', periodType, expiresAt: inAWeek }),
        periodType,
      ).toBe(true)
    }
    // A lifetime bought in a store: no period, no end.
    expect(earnsWelcomePack({ tier: 'pro', store: 'play_store', periodType: null })).toBe(true)
  })

  it('is never a grant nobody paid for', () => {
    for (const store of ['gift', 'promotional', 'manual', 'unknown', undefined]) {
      expect(earnsWelcomePack({ tier: 'pro', store, expiresAt: inAWeek }), String(store)).toBe(
        false,
      )
    }
  })

  it('is never free, nor a purchase that has already ended', () => {
    expect(earnsWelcomePack({ tier: 'free', store: 'app_store' })).toBe(false)
    expect(
      earnsWelcomePack({
        tier: 'pro',
        store: 'app_store',
        periodType: 'normal',
        expiresAt: new Date(Date.now() - 1000),
      }),
    ).toBe(false)
  })
})

/**
 * The leak itself, through the funnel that had it: `refreshEntitlement` runs
 * for every gift of Pro, and it used to hand the pack to any tier but free.
 */
describe('refreshEntitlement and the welcome pack', () => {
  let server: MongoMemoryServer
  let handle: DbHandle
  let seq = 0

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'welcome-pack-refresh-test')
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  function holding(entitlement: SubscriberEntitlement | null): RevenueCatClient {
    return {
      getEntitlement: () => Promise.resolve(entitlement),
      grantLifetimeEntitlement: () => Promise.resolve(),
      grantPromotionalEntitlement: () => Promise.resolve(),
    }
  }

  async function seed(): Promise<string> {
    seq++
    const id = `refreshpack${seq}`
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(minimalProfile(id))
    return id
  }

  const inAWeek = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  it('gives no pack for a gift of Pro', async () => {
    const id = await seed()
    await refreshEntitlement(
      handle.db,
      holding({
        tier: 'pro',
        expiresAt: inAWeek(),
        productId: 'rc_promo_pro_custom',
        store: 'gift',
        periodType: null,
        willRenew: false,
      }),
      id,
    )
    const profile = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })
    expect(profile?.entitlement.tier).toBe('pro')
    expect(profile?.welcomePackAt).toBeUndefined()
    expect(profile?.streakFreezes ?? 0).toBe(0)
    expect(profile?.cosmetics ?? []).toEqual([])
  })

  it('gives no pack for a lifetime grant either', async () => {
    const id = await seed()
    await refreshEntitlement(
      handle.db,
      holding({
        tier: 'pro',
        expiresAt: null,
        productId: 'rc_promo_pro_lifetime',
        store: 'promotional',
        periodType: null,
        willRenew: false,
      }),
      id,
    )
    const profile = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })
    expect(profile?.welcomePackAt).toBeUndefined()
  })

  it('gives the pack when a store free week starts', async () => {
    const id = await seed()
    await refreshEntitlement(
      handle.db,
      holding({
        tier: 'pro',
        expiresAt: inAWeek(),
        productId: 'langx_pro_yearly',
        store: 'app_store',
        periodType: 'trial',
        willRenew: true,
      }),
      id,
    )
    const profile = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })
    expect(profile?.welcomePackAt?.pro).toBeInstanceOf(Date)
    expect(profile?.streakFreezes).toBe(PRO_WELCOME_PACKS.pro.streakFreezes)
  })
})
