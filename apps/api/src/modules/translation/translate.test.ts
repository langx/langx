import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { COLLECTIONS } from '../../db/collections'
import { connectToDatabase, type DbHandle } from '../../db/client'
import type {
  TranslateInput,
  TranslateResult,
  TranslationProvider,
} from '../../translation/TranslationProvider'
import type { Profile } from '../profiles/profiles'
import { translateText } from './translate'

/** Counts calls so tests can assert a cache hit never reaches the "provider". */
class CountingFakeProvider implements TranslationProvider {
  calls = 0
  translate(input: TranslateInput): Promise<TranslateResult> {
    this.calls++
    return Promise.resolve({
      translatedText: `[${input.targetLang}] ${input.text}`,
      sourceLang: input.sourceLang ?? 'en',
    })
  }
}

function minimalProfile(id: string, tier: 'free' | 'pro'): Profile {
  const now = new Date()
  return {
    _id: id,
    handle: id,
    displayName: id,
    birthYear: 1995,
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'B1', priority: 1 }],
    interests: [],
    settings: { discoverable: true, notifications: true, ageRange: [18, 99], distanceKm: 50 },
    privacy: { incognito: false },
    entitlement: { tier, updatedAt: now },
    quota: { initiations: [], translations: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: now, messagesSent: 0 },
    createdAt: now,
    updatedAt: now,
  }
}

describe('translateText', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_translate_test')
  }, 60_000)

  afterAll(async () => {
    await handle?.close()
    await server?.stop()
  })

  async function insertProfile(profile: Profile) {
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(profile)
  }

  it('a cache miss calls the provider, consumes quota, and caches the result', async () => {
    await insertProfile(minimalProfile('miss-user', 'free'))
    const provider = new CountingFakeProvider()

    const result = await translateText(handle.db, provider, 'miss-user', {
      text: 'good morning',
      targetLang: 'tr',
    })

    expect(result).toMatchObject({ translatedText: '[tr] good morning', cached: false })
    expect(provider.calls).toBe(1)

    const cached = await handle.db
      .collection(COLLECTIONS.translationCache)
      .findOne({ targetLang: 'tr' })
    expect(cached).toMatchObject({ translatedText: '[tr] good morning' })
  })

  it('a cache hit never reaches the provider and never consumes quota', async () => {
    await insertProfile(minimalProfile('hit-user', 'free'))
    const provider = new CountingFakeProvider()

    const first = await translateText(handle.db, provider, 'hit-user', {
      text: 'thank you',
      targetLang: 'de',
    })
    expect(first.cached).toBe(false)
    expect(provider.calls).toBe(1)

    const second = await translateText(handle.db, provider, 'hit-user', {
      text: 'thank you',
      targetLang: 'de',
    })
    expect(second).toEqual({ ...first, cached: true })
    expect(provider.calls).toBe(1) // still 1 — the second call never touched the provider

    const status = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: 'hit-user' })
    expect(status?.quota.translations).toHaveLength(1) // only the miss counted
  })

  it('the same text caches separately per target language', async () => {
    await insertProfile(minimalProfile('multi-lang-user', 'free'))
    const provider = new CountingFakeProvider()

    await translateText(handle.db, provider, 'multi-lang-user', { text: 'hello', targetLang: 'tr' })
    await translateText(handle.db, provider, 'multi-lang-user', { text: 'hello', targetLang: 'de' })

    expect(provider.calls).toBe(2)
    const count = await handle.db
      .collection(COLLECTIONS.translationCache)
      .countDocuments({ sourceHash: { $exists: true } })
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it('free tier hits QUOTA_EXCEEDED after the daily limit of distinct texts', async () => {
    await insertProfile(minimalProfile('quota-user', 'free'))
    const provider = new CountingFakeProvider()

    for (let i = 0; i < 20; i++) {
      await translateText(handle.db, provider, 'quota-user', {
        text: `phrase ${i}`,
        targetLang: 'tr',
      })
    }

    await expect(
      translateText(handle.db, provider, 'quota-user', { text: 'one too many', targetLang: 'tr' }),
    ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
  })

  it('pro tier never hits the quota', async () => {
    await insertProfile(minimalProfile('pro-user', 'pro'))
    const provider = new CountingFakeProvider()

    for (let i = 0; i < 25; i++) {
      const result = await translateText(handle.db, provider, 'pro-user', {
        text: `pro phrase ${i}`,
        targetLang: 'tr',
      })
      expect(result.cached).toBe(false)
    }
    expect(provider.calls).toBe(25)
  })
})
