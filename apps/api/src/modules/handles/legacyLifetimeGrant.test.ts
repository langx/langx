import { ENTITLEMENT_TIERS, LOYALTY_LIFETIME_GRANTS, lifetimeGrantFor } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { COLLECTIONS } from '../../db/collections'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { ensureIndexes } from '../../db/indexes'
import type { RevenueCatClient, SubscriberEntitlement } from '../billing/revenueCatClient'
import type { Profile } from '../profiles/profiles'
import { restoreByHash } from './legacyRestore'
import type { LegacyProfile } from './legacyProfiles'

/**
 * The v1 loyalty gift: lifetime Pro for the top-percentile balances.
 *
 * The thing these tests exist to protect is not the threshold — that is one
 * number in `shared` — but the *direction of failure*. A gift is a nicety; a
 * restore is someone getting their account back. If billing being down could
 * cost them the second, the feature would be a net loss.
 */

class RecordingBilling implements RevenueCatClient {
  readonly grants: { appUserId: string; entitlementId: string }[] = []
  failing = false

  getEntitlement(): Promise<SubscriberEntitlement | null> {
    return Promise.resolve(null)
  }

  grantLifetimeEntitlement(appUserId: string, entitlementId: string): Promise<void> {
    if (this.failing) return Promise.reject(new Error('RevenueCat is down'))
    this.grants.push({ appUserId, entitlementId })
    return Promise.resolve()
  }
}

const [PLUS_RUNG, PRO_RUNG] = LOYALTY_LIFETIME_GRANTS
const PLUS_MIN = PLUS_RUNG.minLegacyTokenBalance
const PRO_MIN = PRO_RUNG.minLegacyTokenBalance

describe('v1 loyalty lifetime grant', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let billing: RecordingBilling
  let seq = 0

  /** A v1 record complete enough to restore without falling into needs-onboarding. */
  async function stageLegacy(balance: number | undefined): Promise<string> {
    seq += 1
    const hash = `hash-${seq}`
    const legacy: LegacyProfile = {
      _id: `legacy-${seq}`,
      handle: `veteran${seq}`,
      legacyEmailHash: hash,
      displayName: 'Veteran',
      birthDate: '1990-06-15',
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      photos: [],
      migratedAt: new Date(),
    }
    if (balance !== undefined) legacy.legacyTokenBalance = balance
    await handle.db.collection<LegacyProfile>(COLLECTIONS.legacyProfiles).insertOne(legacy)
    return hash
  }

  function profile(userId: string): Promise<Profile | null> {
    return handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_lifetime_test')
    await ensureIndexes(handle.db)
  }, 120_000)

  beforeEach(() => {
    billing = new RecordingBilling()
  })

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  it('grants lifetime Pro+ at the p99 rung, including the pro entitlement', async () => {
    const hash = await stageLegacy(PLUS_MIN)
    const result = await restoreByHash(handle.db, 'user-p99', hash, billing)

    expect(result).toMatchObject({ kind: 'restored', lifetimeGranted: 'pro_plus' })
    // Both ids, in that order — a gifted Pro+ should be indistinguishable from
    // a bought one, and the Pro+ products grant `pro` too.
    expect(billing.grants).toEqual([
      { appUserId: 'user-p99', entitlementId: 'pro_plus' },
      { appUserId: 'user-p99', entitlementId: 'pro' },
    ])
  })

  it('grants lifetime Pro at the p90 rung', async () => {
    const hash = await stageLegacy(PRO_MIN)
    const result = await restoreByHash(handle.db, 'user-p90', hash, billing)

    expect(result).toMatchObject({ kind: 'restored', lifetimeGranted: 'pro' })
    expect(billing.grants).toEqual([{ appUserId: 'user-p90', entitlementId: 'pro' }])
  })

  /** Highest rung first: a p99 balance also clears p90 and must not land on Pro. */
  it('gives the top rung to someone who clears both', async () => {
    const hash = await stageLegacy(PLUS_MIN * 10)
    const result = await restoreByHash(handle.db, 'user-whale', hash, billing)
    expect(result).toMatchObject({ lifetimeGranted: 'pro_plus' })
  })

  it('drops to Pro one token below the Pro+ rung', async () => {
    const hash = await stageLegacy(PLUS_MIN - 1)
    const result = await restoreByHash(handle.db, 'user-just-under-plus', hash, billing)
    expect(result).toMatchObject({ lifetimeGranted: 'pro' })
  })

  it('grants nothing one token below the Pro rung', async () => {
    const hash = await stageLegacy(PRO_MIN - 1)
    const result = await restoreByHash(handle.db, 'user-just-under', hash, billing)

    expect(result).toMatchObject({ kind: 'restored', lifetimeGranted: null })
    expect(billing.grants).toEqual([])
  })

  /** The median v1 wallet held 20 tokens; this is the overwhelmingly common case. */
  it('grants nothing to a typical returning user', async () => {
    const hash = await stageLegacy(20)
    await restoreByHash(handle.db, 'user-typical', hash, billing)
    expect(billing.grants).toEqual([])
  })

  it('grants nothing when the v1 record has no balance at all', async () => {
    const hash = await stageLegacy(undefined)
    await restoreByHash(handle.db, 'user-no-balance', hash, billing)
    expect(billing.grants).toEqual([])
  })

  /** Each rung's tier must be the tier its own leading entitlement grants. */
  it('keeps every rung consistent with the entitlement it hands out', () => {
    for (const rung of LOYALTY_LIFETIME_GRANTS) {
      expect(ENTITLEMENT_TIERS[rung.entitlements[0]]).toBe(rung.tier)
    }
  })

  it('ignores a missing or nonsensical balance', () => {
    expect(lifetimeGrantFor(undefined)).toBeNull()
    expect(lifetimeGrantFor(null)).toBeNull()
    expect(lifetimeGrantFor(Number.NaN)).toBeNull()
    expect(lifetimeGrantFor(-1)).toBeNull()
  })

  /**
   * The one that matters most. Billing being unreachable must cost the user
   * the gift and nothing else — not their handle, not their tokens, not their
   * account.
   */
  it('still restores the account when the grant fails', async () => {
    billing.failing = true
    const hash = await stageLegacy(PLUS_MIN * 2)
    const result = await restoreByHash(handle.db, 'user-billing-down', hash, billing)

    expect(result).toMatchObject({ kind: 'restored', lifetimeGranted: null })
    const stored = await profile('user-billing-down')
    expect(stored?.handle).toBeTruthy()
    expect(stored?.restoredFromV1?.lifetimeGranted).toBeNull()
  })

  /** No billing client wired at all behaves exactly like no key configured. */
  it('restores normally when no billing client is supplied', async () => {
    const hash = await stageLegacy(PLUS_MIN * 10)
    const result = await restoreByHash(handle.db, 'user-no-client', hash)
    expect(result).toMatchObject({ kind: 'restored', lifetimeGranted: null })
  })

  /**
   * Persisted, not just returned: the restore often fires on a different
   * device from the one the user is holding (an email link clicked on a
   * laptop), and the welcome-back screen reads the stored copy.
   */
  it('records the grant on the profile for the welcome-back screen', async () => {
    const hash = await stageLegacy(PRO_MIN)
    await restoreByHash(handle.db, 'user-persisted', hash, billing)

    const stored = await profile('user-persisted')
    expect(stored?.restoredFromV1?.lifetimeGranted).toBe('pro')
  })

  /**
   * The gift is delivered through RevenueCat and never by writing the tier
   * locally — `refreshEntitlement` would overwrite a local write with whatever
   * RevenueCat reports. The stored tier staying `free` here is that contract
   * holding: the real entitlement now lives in RevenueCat, and the next
   * refresh is what brings it down.
   */
  it('does not write the tier locally — RevenueCat stays the only authority', async () => {
    const hash = await stageLegacy(PRO_MIN)
    await restoreByHash(handle.db, 'user-authority', hash, billing)

    const stored = await profile('user-authority')
    expect(stored?.entitlement.tier).toBe('free')
  })

  /**
   * A replay cannot double-grant, and it is stopped one step earlier than you
   * might expect: `findLegacyProfile` already filters out records with
   * `restoredBy` set, so the second call never reaches `markRestored` and
   * reports `no-legacy-account` rather than `already-restored`. That second
   * outcome is for the concurrent race, where both callers found the record
   * and only one won the claim.
   */
  it('does not grant twice when the restore is replayed', async () => {
    const hash = await stageLegacy(PRO_MIN)
    await restoreByHash(handle.db, 'user-replay', hash, billing)
    const second = await restoreByHash(handle.db, 'user-replay', hash, billing)

    expect(second.kind).toBe('no-legacy-account')
    expect(billing.grants).toHaveLength(1)
  })
})
