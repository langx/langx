import { ACCOUNT_DELETION_GRACE_DAYS, handlesMatch } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { COLLECTIONS } from '../../db/collections'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { ensureIndexes } from '../../db/indexes'
import type { LegacyMessage } from '../handles/legacyConversations'
import type { LegacyProfile } from '../handles/legacyProfiles'
import type { Profile } from '../profiles/profiles'
import type { StorageProvider, UploadUrl } from '../../storage/StorageProvider'
import {
  cancelDeletion,
  exportUserData,
  purgeAtFor,
  purgeExpiredAccounts,
  requestDeletion,
} from './deletion'
import { countDeletionReasons, type AccountDeletionFeedback } from './deletionFeedback'
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
    await handle.db.collection(COLLECTIONS.accountDeletionFeedback).deleteMany({})
  })

  describe('the emailed token', () => {
    it('verifies once, and not after it has been spent', async () => {
      const token = await mintDeletionToken(handle.db, 'ada')
      expect(await verifyDeletionToken(handle.db, token)).toBe('ada')

      expect(await burnDeletionToken(handle.db, token)).not.toBeNull()
      // A forwarded mail, or a mailbox somebody else reads later, must not be
      // able to delete the account a second time.
      expect(await verifyDeletionToken(handle.db, token)).toBeNull()
      expect(await burnDeletionToken(handle.db, token)).toBeNull()
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

    /*
     * A gallery is `attachments`, and `media` is only its first item repeated,
     * so unsetting `media` alone left every other file referenced after the
     * purge had deleted it. The prefix sweep catches what no row names.
     */
    it('takes every file off a post, and sweeps the posts prefix', async () => {
      const her = userId('e1')
      await seed(her, { deletedAt: expired() })
      const file = (name: string) => ({
        url: `${BASE}/posts/${her}/${name}.jpg`,
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      })
      const postId = new ObjectId()
      await handle.db.collection(COLLECTIONS.posts).insertOne({
        _id: postId,
        authorId: her,
        body: 'a sentence with two photos',
        language: 'en',
        correctionCount: 0,
        attachments: [file('one'), file('two')],
        media: file('one'),
        createdAt: new Date(),
      })
      const storage = fakeStorage() as ReturnType<typeof fakeStorage> & {
        prefixes: string[]
        deleteByPrefix: (prefix: string) => Promise<number>
      }
      storage.prefixes = []
      storage.deleteByPrefix = (prefix: string) => {
        storage.prefixes.push(prefix)
        return Promise.resolve(0)
      }

      await purgeExpiredAccounts(handle.db, { storage })

      expect(storage.deleted).toContain(`posts/${her}/one.jpg`)
      expect(storage.deleted).toContain(`posts/${her}/two.jpg`)
      expect(storage.prefixes).toContain(`posts/${her}/`)
      // The words survive the account; the references to deleted files do not.
      const kept = await handle.db.collection(COLLECTIONS.posts).findOne({ _id: postId })
      expect(kept?.body).toBe('a sentence with two photos')
      expect(kept?.attachments).toBeUndefined()
      expect(kept?.media).toBeUndefined()
    })

    /*
     * A photo posted with no words is nothing once its photo is gone, so it
     * goes whole — with the comments and likes on it. Anything with words
     * stays as "Deleted account", as every post always has.
     */
    it('deletes a moment with no words, and keeps every post that has some', async () => {
      const her = userId('f1')
      const commenter = userId('f2')
      await seed(her, { deletedAt: expired() })
      const photo = {
        url: `${BASE}/posts/${her}/moment.jpg`,
        contentType: 'image/jpeg',
        sizeBytes: 1024,
      }
      const base = { authorId: her, language: 'en', correctionCount: 0, createdAt: new Date() }
      const wordless = new ObjectId()
      const captioned = new ObjectId()
      const legacy = new ObjectId()
      await handle.db.collection(COLLECTIONS.posts).insertMany([
        {
          ...base,
          _id: wordless,
          body: '',
          asks: [],
          kind: 'moment',
          answerCount: 0,
          attachments: [photo],
          media: photo,
        },
        {
          ...base,
          _id: captioned,
          body: 'Lunch by the river.',
          asks: [],
          kind: 'moment',
          answerCount: 0,
          attachments: [photo],
          media: photo,
        },
        // Every post from before `asks` and `kind`: a correction request.
        { ...base, _id: legacy, body: 'I has a pen.' },
      ])
      await handle.db.collection(COLLECTIONS.postComments).insertOne({
        _id: new ObjectId(),
        postId: wordless,
        authorId: commenter,
        body: 'Lovely.',
        createdAt: new Date(),
      })
      await handle.db.collection(COLLECTIONS.likes).insertOne({
        _id: new ObjectId(),
        userId: commenter,
        targetType: 'post',
        targetId: wordless,
        createdAt: new Date(),
      })

      await purgeExpiredAccounts(handle.db, { storage: fakeStorage() })

      const posts = handle.db.collection(COLLECTIONS.posts)
      expect(await posts.countDocuments({ _id: wordless })).toBe(0)
      expect(
        await handle.db.collection(COLLECTIONS.postComments).countDocuments({ postId: wordless }),
      ).toBe(0)
      expect(
        await handle.db.collection(COLLECTIONS.likes).countDocuments({ targetId: wordless }),
      ).toBe(0)
      expect((await posts.findOne({ _id: captioned }))?.body).toBe('Lunch by the river.')
      expect((await posts.findOne({ _id: legacy }))?.body).toBe('I has a pen.')
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

  /**
   * Reviews are deleted in both directions, unlike messages, which are only
   * blanked: each is public text about a named person, so one left behind is
   * either a deleted account's words on show or praise for nobody.
   */
  describe('reviews', () => {
    const testimonials = () => handle.db.collection(COLLECTIONS.testimonials)

    async function write(authorId: string, subjectId: string): Promise<void> {
      await testimonials().insertOne({
        authorId,
        subjectId,
        conversationId: new ObjectId(),
        body: `What ${authorId} thinks of ${subjectId}, at some length.`,
        createdAt: new Date(),
      })
    }

    beforeEach(async () => {
      await testimonials().deleteMany({})
    })

    it('purges the ones the account wrote and the ones written about it', async () => {
      const leaving = userId('e1')
      const friend = userId('e2')
      const other = userId('e3')
      await seed(leaving, {
        deletedAt: new Date(Date.now() - (ACCOUNT_DELETION_GRACE_DAYS + 1) * 86_400_000),
      })
      await seed(friend)
      await seed(other)
      await write(leaving, friend)
      await write(friend, leaving)
      await write(friend, other)

      await purgeExpiredAccounts(handle.db)

      expect(
        await testimonials().countDocuments({
          $or: [{ authorId: leaving }, { subjectId: leaving }],
        }),
      ).toBe(0)
      // Somebody else's pair is untouched.
      expect(await testimonials().countDocuments({ authorId: friend, subjectId: other })).toBe(1)
    })

    it('are in the data export, both directions, hidden ones included', async () => {
      const me = userId('f1')
      const friend = userId('f2')
      await seed(me)
      await seed(friend)
      await write(me, friend)
      await write(friend, me)
      await testimonials().updateOne(
        { authorId: friend, subjectId: me },
        { $set: { ownerHiddenAt: new Date() } },
      )

      const exported = await exportUserData(handle.db, me)

      expect(exported.testimonials.written).toHaveLength(1)
      expect(exported.testimonials.written[0]).toMatchObject({ authorId: me, subjectId: friend })
      expect(exported.testimonials.received).toHaveLength(1)
      expect(exported.testimonials.received[0]).toMatchObject({
        authorId: friend,
        subjectId: me,
        hiddenByOwner: true,
      })
    })
  })

  /**
   * "Why are you leaving?" — optional, held while the account can still come
   * back, and kept afterwards with nothing that says whose it was.
   */
  describe('the reason for leaving', () => {
    const feedback = () =>
      handle.db.collection<AccountDeletionFeedback>(COLLECTIONS.accountDeletionFeedback)
    const DAY = 24 * 60 * 60 * 1000

    it('is held on the profile, with the plan, until the purge', async () => {
      const ga = userId('a2')
      await seed(ga)
      await requestDeletion(handle.db, ga, { reason: 'taking_a_break', note: 'Exams.' })

      const profile = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: ga })
      expect(profile?.deletionFeedback).toEqual({
        reason: 'taking_a_break',
        note: 'Exams.',
        tier: 'free',
      })
      // Nothing is counted yet: the account can still come back.
      expect(await feedback().countDocuments()).toBe(0)
    })

    it('is dropped by signing back in — a change of mind is not a departure', async () => {
      const gb = userId('b2')
      await seed(gb)
      await requestDeletion(handle.db, gb, { reason: 'bugs_or_problems' })
      await cancelDeletion(handle.db, gb)

      const profile = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: gb })
      expect(profile?.deletionFeedback).toBeUndefined()
    })

    it('becomes a row at the purge that carries nothing linking it to the account', async () => {
      const gc = userId('c2')
      const deletedAt = new Date(Date.now() - (ACCOUNT_DELETION_GRACE_DAYS + 1) * DAY)
      await seed(gc, {
        handle: 'leaver',
        createdAt: new Date(deletedAt.getTime() - 75 * DAY),
        deletedAt,
        deletionFeedback: { reason: 'not_enough_partners', note: 'Nobody near B1.', tier: 'pro' },
      })

      await purgeExpiredAccounts(handle.db)

      const rows = await feedback().find().toArray()
      expect(rows).toHaveLength(1)
      const row = rows[0]!
      expect(Object.keys(row).sort()).toEqual(
        ['_id', 'accountAgeMonths', 'createdAt', 'note', 'reason', 'tier'].sort(),
      )
      expect(row).toMatchObject({
        reason: 'not_enough_partners',
        note: 'Nobody near B1.',
        tier: 'pro',
        accountAgeMonths: 2,
      })
      // A day, not an instant — see `AccountDeletionFeedback`.
      expect(row.createdAt.getUTCHours() + row.createdAt.getUTCMinutes()).toBe(0)
      const serialised = JSON.stringify(row)
      expect(serialised).not.toContain(gc)
      expect(serialised).not.toContain('leaver')
    })

    it('counts a note with no reason picked as `other`', async () => {
      const gd = userId('d2')
      await seed(gd, {
        deletedAt: new Date(Date.now() - (ACCOUNT_DELETION_GRACE_DAYS + 1) * DAY),
        deletionFeedback: { note: 'Too quiet here.', tier: 'free' },
      })

      await purgeExpiredAccounts(handle.db)

      expect((await feedback().findOne())?.reason).toBe('other')
    })

    it('writes nothing for an account that did not answer', async () => {
      const ge = userId('e2')
      await seed(ge, { deletedAt: new Date(Date.now() - (ACCOUNT_DELETION_GRACE_DAYS + 1) * DAY) })

      const result = await purgeExpiredAccounts(handle.db)

      expect(result.purged).toBe(1)
      expect(await feedback().countDocuments()).toBe(0)
    })

    it('is counted per reason over 30 and 90 days, zeroes included', async () => {
      const now = new Date('2026-09-28T12:00:00.000Z')
      const row = (reason: AccountDeletionFeedback['reason'], daysAgo: number) => ({
        reason,
        tier: 'free' as const,
        accountAgeMonths: 0,
        createdAt: new Date(now.getTime() - daysAgo * DAY),
      })
      await feedback().insertMany([
        row('taking_a_break', 2),
        row('taking_a_break', 45),
        row('privacy_concerns', 10),
        // Outside both windows.
        row('taking_a_break', 120),
      ])

      const counts = await countDeletionReasons(handle.db, now)

      expect(counts.find((c) => c.reason === 'taking_a_break')).toEqual({
        reason: 'taking_a_break',
        last30: 1,
        last90: 2,
      })
      expect(counts.find((c) => c.reason === 'privacy_concerns')).toMatchObject({
        last30: 1,
        last90: 1,
      })
      expect(counts.find((c) => c.reason === 'other')).toMatchObject({ last30: 0, last90: 0 })
      expect(counts.at(-1)?.reason).toBe('other')
    })
  })
})
