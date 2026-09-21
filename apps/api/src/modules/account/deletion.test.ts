import { ACCOUNT_DELETION_GRACE_DAYS, handlesMatch } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { COLLECTIONS } from '../../db/collections'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { ensureIndexes } from '../../db/indexes'
import type { LegacyMessage } from '../handles/legacyConversations'
import type { LegacyProfile } from '../handles/legacyProfiles'
import type { Profile } from '../profiles/profiles'
import type { StorageProvider, UploadUrl } from '../../storage/StorageProvider'
import { cancelDeletion, purgeAtFor, purgeExpiredAccounts, requestDeletion } from './deletion'
import {
  burnDeletionToken,
  DELETION_TOKEN_TTL_MS,
  deletionConfirmUrl,
  mintDeletionToken,
  verifyDeletionToken,
} from './deletionTokens'

/**
 * `deletion.ts` had no test file at all, which is a strange gap for the one
 * module that can end an account — and the two-step gate in front of it is
 * exactly the kind of thing that is only wrong once.
 */
describe('deleting an account', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  /**
   * User ids are the string form of Better Auth's ObjectId — `authId` parses
   * them, so a made-up word throws rather than simply matching nothing.
   */
  function userId(seed: string): string {
    return seed.padEnd(24, '0').slice(0, 24)
  }

  async function seed(userId: string, over: Partial<Profile> = {}): Promise<void> {
    const now = new Date()
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: userId,
      displayName: 'Test',
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
      ...over,
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_deletion_test')
    await ensureIndexes(handle.db)
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await handle.db.collection(COLLECTIONS.deletionTokens).deleteMany({})
    await handle.db.collection(COLLECTIONS.devices).deleteMany({})
    await handle.db.collection(COLLECTIONS.legacyProfiles).deleteMany({})
    await handle.db.collection(COLLECTIONS.legacyMessages).deleteMany({})
    await handle.db.collection(COLLECTIONS.legacyRooms).deleteMany({})
    await handle.db.collection(COLLECTIONS.handleReservations).deleteMany({})
  })

  describe('the emailed token', () => {
    it('verifies once, and not after it has been spent', async () => {
      const token = await mintDeletionToken(handle.db, 'ada')
      expect(await verifyDeletionToken(handle.db, token)).toBe('ada')

      expect(await burnDeletionToken(handle.db, token)).toBe(true)
      // A forwarded mail, or a mailbox somebody else reads later, must not be
      // able to delete the account a second time.
      expect(await verifyDeletionToken(handle.db, token)).toBeNull()
      expect(await burnDeletionToken(handle.db, token)).toBe(false)
    })

    it('refuses an expired one even before the TTL monitor has swept it', async () => {
      const minted = new Date(Date.now() - DELETION_TOKEN_TTL_MS - 1000)
      const token = await mintDeletionToken(handle.db, 'bo', minted)
      expect(await verifyDeletionToken(handle.db, token)).toBeNull()
    })

    it('refuses a token nobody minted', async () => {
      expect(await verifyDeletionToken(handle.db, 'not-a-token')).toBeNull()
      expect(await verifyDeletionToken(handle.db, undefined)).toBeNull()
    })

    it('keeps one live link per user, so asking twice does not leave two', async () => {
      const first = await mintDeletionToken(handle.db, 'cy')
      const second = await mintDeletionToken(handle.db, 'cy')
      expect(await verifyDeletionToken(handle.db, first)).toBeNull()
      expect(await verifyDeletionToken(handle.db, second)).toBe('cy')
    })

    it('stores a hash, so the row cannot produce a working link', async () => {
      const token = await mintDeletionToken(handle.db, 'di')
      const row = await handle.db
        .collection<{ tokenHash: string }>(COLLECTIONS.deletionTokens)
        .findOne({ userId: 'di' })
      expect(row?.tokenHash).toBeTruthy()
      expect(row?.tokenHash).not.toBe(token)
    })

    it('points the mail at the asking page, not at the acting one', () => {
      // The GET only asks; see `routes/email.ts` for why a previewer following
      // it must not be able to delete anything.
      expect(deletionConfirmUrl('https://api.langx.io/', 'abc')).toBe(
        'https://api.langx.io/account/delete/confirm?token=abc',
      )
    })
  })

  describe('the typed handle', () => {
    it('refuses anything that is not the viewer’s own handle', () => {
      expect(handlesMatch('sofia', 'sofia')).toBe(true)
      expect(handlesMatch('@sofia', 'sofia')).toBe(true)
      expect(handlesMatch('sofi', 'sofia')).toBe(false)
    })
  })

  describe('what confirming does', () => {
    it('marks the profile, ends every session and stops the notifications', async () => {
      const el = userId('e1')
      await seed(el)
      await handle.db.collection(COLLECTIONS.devices).insertOne({
        userId: el,
        pushToken: 'token-el',
        platform: 'ios',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const status = await requestDeletion(handle.db, el)

      expect(status.pending).toBe(true)
      const profile = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: el })
      expect(profile?.deletedAt).toBeInstanceOf(Date)
      // A phone must stop buzzing for an account its owner has just ended.
      expect(await handle.db.collection(COLLECTIONS.devices).countDocuments({ userId: el })).toBe(0)
    })

    it('leaves the grace period the promise says it does', () => {
      const at = new Date('2026-09-04T00:00:00.000Z')
      const purge = purgeAtFor(at)
      expect(purge.getTime() - at.getTime()).toBe(ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000)
    })

    it('is undone by signing back in', async () => {
      const fi = userId('f1')
      await seed(fi)
      await requestDeletion(handle.db, fi)

      const status = await cancelDeletion(handle.db, fi)

      expect(status).toEqual({ pending: false, deletedAt: null, purgeAt: null })
      const profile = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: fi })
      expect(profile?.deletedAt).toBeUndefined()
    })
  })
  /**
   * The purge had no test at all, and the gap this covers is why that
   * mattered: a restored account left its entire v1 self behind, in
   * collections keyed on the Appwrite id that nothing keyed on the v2 one
   * ever reached.
   */
  describe('what the purge takes from a restored v1 account', () => {
    const LEGACY = '65d5e2f0dfc6c5b89a5c'
    const PEER = '65d5e2f0dfc6c5b89a99'
    const BASE = 'https://cdn.langx.test'

    /** Records what it was asked to delete; `supportsPut` needs `putObject`. */
    function fakeStorage(): StorageProvider & { deleted: string[] } {
      const deleted: string[] = []
      return {
        deleted,
        getUploadUrl: (): Promise<UploadUrl> => Promise.reject(new Error('unused')),
        putObject: (): Promise<string> => Promise.reject(new Error('unused')),
        getObject: (): Promise<Uint8Array> => Promise.reject(new Error('unused')),
        deleteObject: (key: string): Promise<void> => {
          deleted.push(key)
          return Promise.resolve()
        },
        keyFromPublicUrl: (url: string): string | null =>
          url.startsWith(`${BASE}/`) ? url.slice(BASE.length + 1) : null,
      } as StorageProvider & { deleted: string[] }
    }

    async function seedStaged(userId: string): Promise<void> {
      await handle.db.collection<LegacyProfile>(COLLECTIONS.legacyProfiles).insertOne({
        _id: LEGACY,
        handle: 'mariska',
        legacyEmailHash: 'hash-of-her-v1-address',
        displayName: 'Mariska',
        birthDate: '1972-02-24',
        country: 'ZA',
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'es', level: 'intermediate', priority: 1 }],
        avatarUrl: `${BASE}/legacy/her-old-avatar.jpg`,
        photos: [{ url: `${BASE}/legacy/her-gallery.jpg` }],
        migratedAt: new Date(),
        restoredBy: userId,
        restoredAt: new Date(),
      })
      await handle.db.collection<LegacyMessage>(COLLECTIONS.legacyMessages).insertMany([
        {
          _id: 'v1-msg-hers',
          roomId: 'v1-room',
          senderId: LEGACY,
          type: 'image',
          body: 'something she wrote in v1',
          media: {
            url: `${BASE}/legacy/her-photo.jpg`,
            contentType: 'image/jpeg',
            sizeBytes: 1024,
          },
          seen: true,
          createdAt: new Date(),
        },
        {
          _id: 'v1-msg-theirs',
          roomId: 'v1-room',
          senderId: PEER,
          type: 'text',
          body: 'what the other person said',
          seen: true,
          createdAt: new Date(),
        },
      ])
      await handle.db.collection(COLLECTIONS.legacyRooms).insertOne({
        _id: 'v1-room' as never,
        participants: [LEGACY, PEER],
        migratedAt: new Date(),
      })
      await handle.db.collection(COLLECTIONS.handleReservations).insertOne({
        handle: 'mariska',
        legacyEmailHash: 'hash-of-her-v1-address',
        legacyUserId: LEGACY,
        expiresAt: new Date(Date.now() + 86_400_000),
      })
    }

    /** Past the grace period, which is the only thing the purge selects on. */
    function expired(): Date {
      return new Date(Date.now() - (ACCOUNT_DELETION_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000)
    }

    it('deletes the staging record, her v1 messages and her handle reservation', async () => {
      const her = userId('a1')
      await seed(her, { deletedAt: expired() })
      await seedStaged(her)

      const result = await purgeExpiredAccounts(handle.db)

      expect(result.purged).toBe(1)
      expect(
        await handle.db
          .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
          .countDocuments({ _id: LEGACY }),
      ).toBe(0)
      expect(
        await handle.db.collection(COLLECTIONS.legacyMessages).countDocuments({ senderId: LEGACY }),
      ).toBe(0)
      expect(
        await handle.db
          .collection(COLLECTIONS.handleReservations)
          .countDocuments({ legacyUserId: LEGACY }),
      ).toBe(0)
    })

    it('leaves the other person’s half of the staged thread alone', async () => {
      const her = userId('b1')
      await seed(her, { deletedAt: expired() })
      await seedStaged(her)

      await purgeExpiredAccounts(handle.db)

      // Their words, and a room that can no longer import either way.
      expect(
        await handle.db.collection(COLLECTIONS.legacyMessages).countDocuments({ senderId: PEER }),
      ).toBe(1)
      expect(await handle.db.collection(COLLECTIONS.legacyRooms).countDocuments({})).toBe(1)
    })

    it('takes the v1 pictures the profile no longer points at', async () => {
      const her = userId('c1')
      // Her v2 avatar replaced the migrated one, so the old file is referenced
      // by the staging record alone — the case sweeping the profile misses.
      await seed(her, { deletedAt: expired(), avatarUrl: `${BASE}/v2/her-new-avatar.jpg` })
      await seedStaged(her)
      const storage = fakeStorage()

      await purgeExpiredAccounts(handle.db, { storage })

      expect(storage.deleted).toContain('v2/her-new-avatar.jpg')
      expect(storage.deleted).toContain('legacy/her-old-avatar.jpg')
      expect(storage.deleted).toContain('legacy/her-gallery.jpg')
      expect(storage.deleted).toContain('legacy/her-photo.jpg')
    })

    it('purges an account that never came from v1 just the same', async () => {
      const plain = userId('d1')
      await seed(plain, { deletedAt: expired() })

      const result = await purgeExpiredAccounts(handle.db)

      expect(result.purged).toBe(1)
      expect(
        await handle.db.collection<Profile>(COLLECTIONS.profiles).countDocuments({ _id: plain }),
      ).toBe(0)
    })
  })
})
