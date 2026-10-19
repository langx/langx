import { discoveryQuerySchema } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { refreshEntitlement } from '../billing/refresh'
import type { RevenueCatClient, SubscriberEntitlement } from '../billing/revenueCatClient'
import { discoverProfiles } from '../discovery/discovery'
import { updateProfile, type Profile } from './profiles'

const DAY = 24 * 60 * 60 * 1000

function person(id: string, fields: Partial<Profile> = {}): Profile {
  const now = Date.now()
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
    entitlement: { tier: 'free', updatedAt: new Date(now) },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: new Date(now - 60 * 60 * 1000), messagesSent: 0 },
    createdAt: new Date(now - 60 * DAY),
    updatedAt: new Date(now),
    ...fields,
  }
}

const gift = (): Profile['entitlement'] => ({
  tier: 'pro',
  store: 'gift',
  willRenew: false,
  expiresAt: new Date(Date.now() + 7 * DAY),
  updatedAt: new Date(),
})

const subscription = (): Profile['entitlement'] => ({
  tier: 'pro',
  store: 'app_store',
  periodType: 'normal',
  willRenew: true,
  expiresAt: new Date(Date.now() + 30 * DAY),
  updatedAt: new Date(),
})

function holding(entitlement: SubscriberEntitlement | null): RevenueCatClient {
  return {
    getEntitlement: () => Promise.resolve(entitlement),
    grantLifetimeEntitlement: () => Promise.resolve(),
    grantPromotionalEntitlement: () => Promise.resolve(),
  }
}

/**
 * The second leak the Pro Week closes: a gift of Pro let somebody add four
 * more languages, and discovery matched on them for good after it ended.
 *
 * `spanish` is a Spanish speaker learning French. The only thing they share
 * with `learner` is the Spanish `learner` adds during a gift — so whether each
 * finds the other is exactly the question "does a paused language match".
 */
describe('languages added during a gift', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_language_pause_test')
    await ensureIndexes(handle.db)
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertMany([
      person('learner', { entitlement: gift() }),
      person('spanish', {
        nativeLanguages: [{ code: 'es' }],
        learning: [{ code: 'fr', level: 'beginner', priority: 1 }],
      }),
    ])
  })

  const read = (id: string) =>
    handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })

  async function sees(viewer: string): Promise<string[]> {
    const page = await discoverProfiles(handle.db, viewer, discoveryQuerySchema.parse({}))
    return page.items.map((item) => item._id)
  }

  async function addSpanish(): Promise<void> {
    await updateProfile(handle.db, 'learner', {
      learning: [
        { code: 'en', level: 'intermediate', priority: 1 },
        { code: 'es', level: 'beginner', priority: 2 },
      ],
    })
  }

  /** What the end of a gift does: RevenueCat holds nothing, and the refresh writes free. */
  const endTheGift = () => refreshEntitlement(handle.db, holding(null), 'learner')

  it('matches on the new language while the gift lasts', async () => {
    await addSpanish()
    expect((await read('learner'))?.giftLanguages).toEqual(['es'])
    expect((await read('learner'))?.pausedLanguages).toBeUndefined()
    expect(await sees('learner')).toContain('spanish')
    expect(await sees('spanish')).toContain('learner')
  })

  it('pauses it for matching, both ways, once the gift ends', async () => {
    await addSpanish()
    await endTheGift()

    const after = await read('learner')
    expect(after?.pausedLanguages).toEqual(['es'])
    // Paused, not removed: it is still on the profile.
    expect(after?.learning.map((l) => l.code)).toEqual(['en', 'es'])
    expect(await sees('learner')).not.toContain('spanish')
    expect(await sees('spanish')).not.toContain('learner')
  })

  it('counts it again when Pro comes back', async () => {
    await addSpanish()
    await endTheGift()
    await refreshEntitlement(
      handle.db,
      holding({
        tier: 'pro',
        expiresAt: new Date(Date.now() + 30 * DAY),
        productId: 'langx_pro_monthly',
        store: 'app_store',
        periodType: 'normal',
        willRenew: true,
      }),
      'learner',
    )
    expect((await read('learner'))?.pausedLanguages).toBeUndefined()
    expect(await sees('learner')).toContain('spanish')
    expect(await sees('spanish')).toContain('learner')
  })

  it('never pauses a language added under a subscription', async () => {
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: 'learner' }, { $set: { entitlement: subscription() } })
    await addSpanish()
    expect((await read('learner'))?.giftLanguages).toBeUndefined()
    await endTheGift()
    expect((await read('learner'))?.pausedLanguages).toBeUndefined()
    expect(await sees('spanish')).toContain('learner')
  })

  it('never pauses languages nobody added during a gift, however many', async () => {
    // A v1 account back on the free plan with three learning languages.
    await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
      { _id: 'learner' },
      {
        $set: {
          entitlement: { tier: 'free', updatedAt: new Date() },
          learning: [
            { code: 'en', level: 'intermediate', priority: 1 },
            { code: 'es', level: 'beginner', priority: 2 },
            { code: 'it', level: 'beginner', priority: 3 },
          ],
        },
      },
    )
    await endTheGift()
    expect((await read('learner'))?.pausedLanguages).toBeUndefined()
    expect(await sees('spanish')).toContain('learner')
  })

  it('drops a paused language from a scope an older app names, rather than refusing it', async () => {
    await addSpanish()
    await endTheGift()
    const page = await discoverProfiles(
      handle.db,
      'learner',
      discoveryQuerySchema.parse({ learningLanguages: 'en,es' }),
    )
    expect(page.items.map((item) => item._id)).not.toContain('spanish')
  })
})
