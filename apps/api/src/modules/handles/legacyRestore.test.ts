import { PLAN_LIMITS } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { COLLECTIONS } from '../../db/collections'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { ensureIndexes } from '../../db/indexes'
import type { Profile } from '../profiles/profiles'
import { restoreByHash } from './legacyRestore'
import type { LegacyProfile } from './legacyProfiles'

/**
 * The onboard-first path: someone fills in the form before proving the old
 * email, so a profile already exists when the v1 record is claimed. What the
 * else branch copies over is the whole of what v1 gives them back in that
 * order, and `bio` was missing from it — the about text was lost for good
 * (`markRestored` makes the restore a one-shot).
 */
describe('restoring a v1 record onto a profile that already exists', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let seq = 0

  async function stage(fields: Partial<LegacyProfile>): Promise<string> {
    seq += 1
    const hash = `hash-${seq}`
    await handle.db.collection<LegacyProfile>(COLLECTIONS.legacyProfiles).insertOne({
      _id: `legacy-${seq}`,
      handle: `veteran${seq}`,
      legacyEmailHash: hash,
      displayName: 'Veteran',
      birthDate: '1990-06-15',
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      photos: [],
      migratedAt: new Date(),
      ...fields,
    })
    return hash
  }

  async function onboarded(userId: string, fields: Partial<Profile> = {}): Promise<void> {
    const now = new Date()
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: userId,
      displayName: 'New me',
      birthDate: '1990-06-15',
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
      ...fields,
    })
  }

  function profile(userId: string): Promise<Profile | null> {
    return handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_restore_existing_test')
    await ensureIndexes(handle.db)
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  it('brings back the about text and country the form was left without', async () => {
    const hash = await stage({
      bio: 'ig: behicsakar',
      countryCode: 'CA',
      avatarUrl: 'https://m/a.jpg',
    })
    await onboarded('user-blank-form')

    const result = await restoreByHash(handle.db, 'user-blank-form', hash)

    expect(result).toMatchObject({ kind: 'restored' })
    expect(await profile('user-blank-form')).toMatchObject({
      bio: 'ig: behicsakar',
      country: 'CA',
      avatarUrl: 'https://m/a.jpg',
    })
  })

  it('never overwrites what they typed in the form', async () => {
    const hash = await stage({ bio: 'old text', countryCode: 'CA' })
    await onboarded('user-filled-form', { bio: 'new text', country: 'TR' })

    await restoreByHash(handle.db, 'user-filled-form', hash)

    expect(await profile('user-filled-form')).toMatchObject({ bio: 'new text', country: 'TR' })
  })

  /**
   * The pictures, which had no coverage at all — and which are the half the
   * media backfill shares through `applyLegacyMedia`. Two rules: fill a gap,
   * never overwrite, and never seat anyone above the gallery limit.
   */
  it('gives an empty gallery the v1 one', async () => {
    const hash = await stage({
      photos: [{ url: 'https://m/1.jpg' }, { url: 'https://m/2.jpg' }],
    })
    await onboarded('user-no-gallery')

    await restoreByHash(handle.db, 'user-no-gallery', hash)

    const restored = await profile('user-no-gallery')
    expect(restored?.photos?.map((photo) => photo.url)).toEqual([
      'https://m/1.jpg',
      'https://m/2.jpg',
    ])
  })

  it('keeps the avatar and the gallery they chose themselves', async () => {
    const hash = await stage({
      avatarUrl: 'https://m/old.jpg',
      photos: [{ url: 'https://m/old-1.jpg' }],
    })
    await onboarded('user-own-pictures', {
      avatarUrl: 'https://m/mine.jpg',
      photos: [{ url: 'https://m/mine-1.jpg', createdAt: new Date() }],
    })

    await restoreByHash(handle.db, 'user-own-pictures', hash)

    const restored = await profile('user-own-pictures')
    expect(restored?.avatarUrl).toBe('https://m/mine.jpg')
    expect(restored?.photos?.map((photo) => photo.url)).toEqual(['https://m/mine-1.jpg'])
  })

  it('truncates a v1 gallery longer than the plan allows', async () => {
    const over = PLAN_LIMITS.free.maxPhotos + 3
    const hash = await stage({
      photos: Array.from({ length: over }, (_, i) => ({ url: `https://m/p${i}.jpg` })),
    })
    await onboarded('user-long-gallery')

    await restoreByHash(handle.db, 'user-long-gallery', hash)

    const restored = await profile('user-long-gallery')
    expect(restored?.photos).toHaveLength(PLAN_LIMITS.free.maxPhotos)
  })
})
