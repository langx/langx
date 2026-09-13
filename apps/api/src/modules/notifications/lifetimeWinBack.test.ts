import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
import { lifetimeWinBackAudience } from './lifetimeWinBack'
import { suppressEmail } from './suppressions'

/** Either side of the Fluent rung (9,136) and over the Polyglot one (37,821). */
const FLUENT = 11_579
const POLYGLOT = 41_203
const BELOW = 9_000

describe('who is owed a lifetime tier and has not come back for it', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'langx_lifetime_winback_test')
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await mongo?.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.legacyProfiles,
      COLLECTIONS.user,
      COLLECTIONS.profiles,
      COLLECTIONS.emailSuppressions,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  /**
   * A staged v1 record and the `user` row `precreate-v1-users.ts` opened for
   * it. No profile unless the test asks: not having one is the whole point of
   * this audience.
   */
  async function v1Account(
    opts: {
      balance?: number
      restored?: boolean
      verified?: boolean
      name?: string
      profile?: { notifications?: unknown; deleted?: boolean; displayName?: string }
    } = {},
  ): Promise<{ userId: string; email: string }> {
    const userId = new ObjectId().toHexString()
    const legacyUserId = new ObjectId().toHexString()
    /*
     * The whole id, not a slice of it: an ObjectId's first eight hex
     * characters are its timestamp, so two accounts made in the same second
     * shared an address — and suppressing one suppressed both.
     */
    const email = `${userId}@example.com`

    await handle.db.collection(COLLECTIONS.legacyProfiles).insertOne({
      _id: legacyUserId,
      legacyTokenBalance: opts.balance ?? FLUENT,
      ...(opts.restored ? { restoredBy: userId } : {}),
    } as never)
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email,
      ...(opts.name ? { name: opts.name } : {}),
      emailVerified: opts.verified ?? true,
      precreatedFromV1: { at: new Date(), legacyUserId },
    })
    if (opts.profile) {
      await handle.db.collection(COLLECTIONS.profiles).insertOne({
        _id: userId,
        handle: `h${userId.slice(0, 8)}`,
        settings: { discoverable: true, notifications: opts.profile.notifications ?? {} },
        ...(opts.profile.displayName ? { displayName: opts.profile.displayName } : {}),
        ...(opts.profile.deleted ? { deletedAt: new Date() } : {}),
      } as never)
    }
    return { userId, email }
  }

  it('names the tier and the balance that earned it', async () => {
    const fluent = await v1Account({ balance: FLUENT, name: 'Gerard' })
    const polyglot = await v1Account({ balance: POLYGLOT, name: 'Sofia R.' })

    const { contacts } = await lifetimeWinBackAudience(handle.db)

    expect(contacts).toHaveLength(2)
    expect(contacts.find((c) => c.userId === fluent.userId)).toMatchObject({
      tier: 'pro',
      legacyTokens: FLUENT,
      name: 'Gerard',
      email: fluent.email,
    })
    expect(contacts.find((c) => c.userId === polyglot.userId)).toMatchObject({
      tier: 'pro_plus',
      legacyTokens: POLYGLOT,
    })
  })

  it('leaves out a wallet that never cleared the rung', async () => {
    await v1Account({ balance: BELOW })
    expect((await lifetimeWinBackAudience(handle.db)).contacts).toEqual([])
  })

  /**
   * The restore is what hands the tier over and, since `lifetimeGiftNotice`,
   * what announces it. Somebody who has been through it has been told.
   */
  it('leaves out whoever already came back for it', async () => {
    await v1Account({ restored: true })
    expect((await lifetimeWinBackAudience(handle.db)).contacts).toEqual([])
  })

  it('never writes to an address nobody proved', async () => {
    await v1Account({ verified: false })
    const { contacts, skipped } = await lifetimeWinBackAudience(handle.db)
    expect(contacts).toEqual([])
    expect(skipped.unverified).toBe(1)
  })

  it('honours a refusal recorded since, and the suppression list', async () => {
    await v1Account({ profile: { notifications: { promotions: { email: false, push: false } } } })
    const bounced = await v1Account()
    await suppressEmail(handle.db, { email: bounced.email, reason: 'bounced' })

    const { contacts, skipped } = await lifetimeWinBackAudience(handle.db)
    expect(contacts).toEqual([])
    expect(skipped.noConsent).toBe(1)
    expect(skipped.suppressed).toBe(1)
  })

  /**
   * Untouched notification settings are a yes for promotional email, which is
   * what the whole v1 win-back sequence rests on — so somebody who onboarded
   * without restoring is still written to.
   */
  it('still writes to somebody who has a profile but never claimed their v1 account', async () => {
    await v1Account({ profile: { displayName: 'Came back the long way' } })
    const { contacts } = await lifetimeWinBackAudience(handle.db)
    expect(contacts).toHaveLength(1)
    expect(contacts[0]?.name).toBe('Came back the long way')
    // And says so, which is what `--exclude-returned` would act on.
    expect(contacts[0]?.hasProfile).toBe(true)
  })

  /** `langx_6430` is a serial number v1 assigned, not a name to greet anybody by. */
  it('does not greet somebody by a generated v1 name', async () => {
    await v1Account({ name: 'langx_6430' })
    expect((await lifetimeWinBackAudience(handle.db)).contacts[0]?.name).toBeUndefined()
  })
})
