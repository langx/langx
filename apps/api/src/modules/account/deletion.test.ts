import { ACCOUNT_DELETION_GRACE_DAYS, handlesMatch } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { COLLECTIONS } from '../../db/collections'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { ensureIndexes } from '../../db/indexes'
import type { Profile } from '../profiles/profiles'
import { cancelDeletion, purgeAtFor, requestDeletion } from './deletion'
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
})
