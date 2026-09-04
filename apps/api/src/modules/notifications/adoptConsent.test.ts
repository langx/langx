import { DEFAULT_NOTIFICATION_PREFS, notificationsAllowed } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { authId } from '../../lib/authId'
import type { Profile } from '../profiles/profiles'
import { adoptPromotionsConsent } from './adoptConsent'

describe('recording a consent given at v1 sign-up', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'adopt_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [COLLECTIONS.profiles, COLLECTIONS.user]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  async function newAccount(
    opts: { notifications?: unknown; fromV1?: boolean; profile?: boolean } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    if (opts.profile !== false) {
      await handle.db.collection(COLLECTIONS.profiles).insertOne({
        _id: userId,
        handle: `h${userId.slice(-12)}`,
        settings: {
          discoverable: true,
          notifications: opts.notifications ?? DEFAULT_NOTIFICATION_PREFS,
        },
      } as never)
    }
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: `${userId}@example.com`,
      emailVerified: true,
      ...(opts.fromV1 ? { precreatedFromV1: { at: new Date(), legacyUserId: 'v1id' } } : {}),
    })
    return userId
  }

  const prefsOf = async (userId: string) =>
    (await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId }))?.settings
      .notifications

  it('turns the one cell on and leaves the other eight where they were', async () => {
    const userId = await newAccount({ fromV1: true })

    const outcome = await adoptPromotionsConsent(handle.db, 'v1', { apply: true })
    expect(outcome.updated).toEqual([userId])

    const prefs = await prefsOf(userId)
    expect(prefs).toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      promotions: { push: false, email: true },
    })
  })

  it('records where the consent came from', async () => {
    const userId = await newAccount({ fromV1: true })
    await adoptPromotionsConsent(handle.db, 'v1', { apply: true })

    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId })
    expect(profile?.promotionsConsent?.source).toBe('v1')
  })

  /**
   * The one that would be indefensible. A person who opened that screen and
   * turned promotions off has answered the question this script is answering
   * on everybody else's behalf, and their answer wins.
   */
  it('never overwrites a refusal', async () => {
    const said = await newAccount({
      fromV1: true,
      notifications: { ...DEFAULT_NOTIFICATION_PREFS, messages: { push: false, email: false } },
    })

    const outcome = await adoptPromotionsConsent(handle.db, 'v1', { apply: true })
    expect(outcome.updated).toHaveLength(0)
    expect(outcome.refused).toBe(1)
    expect(notificationsAllowed(await prefsOf(said), 'promotions', 'email')).toBe(false)
  })

  it('resolves an older stored shape instead of writing into it', async () => {
    const userId = await newAccount({
      fromV1: true,
      notifications: { messages: true, streak: true, profileVisits: true, promotions: false },
    })

    await adoptPromotionsConsent(handle.db, 'v1', { apply: true })
    // Every cell answered exactly as `notificationsAllowed` answered it before,
    // and one changed: a dotted path into a bare boolean would have written
    // nothing at all and reported success.
    expect(await prefsOf(userId)).toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      promotions: { push: false, email: true },
    })
  })

  it('counts an account with no profile rather than inventing one', async () => {
    await newAccount({ fromV1: true, profile: false })

    const outcome = await adoptPromotionsConsent(handle.db, 'v1', { apply: true })
    expect(outcome).toMatchObject({ noProfile: 1 })
    expect(outcome.updated).toHaveLength(0)
    expect(await handle.db.collection(COLLECTIONS.profiles).countDocuments()).toBe(0)
  })

  it('writes nothing at all without apply', async () => {
    const userId = await newAccount({ fromV1: true })

    const outcome = await adoptPromotionsConsent(handle.db, 'v1')
    expect(outcome.updated).toEqual([userId])
    expect(notificationsAllowed(await prefsOf(userId), 'promotions', 'email')).toBe(false)
  })
})
