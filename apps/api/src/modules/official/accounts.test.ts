import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { startConversation } from '../chat/conversations'
import { searchHandles } from '../discovery/handleSearch'
import { toPublicProfile, type Profile } from '../profiles/profiles'
import { getSharedProfile } from '../profiles/sharedProfile'
import { ensureOfficialAccounts, isOfficialId, officialIds } from './accounts'

const API_URL = 'https://api.langx.test'

function person(id: string): Profile {
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

describe('the official accounts', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_official_test')
    // `handle_unique` is what makes ensuring them idempotent.
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.conversations,
      COLLECTIONS.messages,
      COLLECTIONS.tokenLedger,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  it('creates each account once, however often boot runs', async () => {
    const first = await ensureOfficialAccounts(handle.db, API_URL)
    expect(first.map((r) => r.outcome)).toEqual(['created', 'created'])

    const second = await ensureOfficialAccounts(handle.db, API_URL)
    expect(second.map((r) => r.outcome)).toEqual(['updated', 'updated'])
    expect(second.map((r) => r.userId)).toEqual(first.map((r) => r.userId))

    expect(await handle.db.collection(COLLECTIONS.profiles).countDocuments()).toBe(2)
    expect(await handle.db.collection(COLLECTIONS.user).countDocuments()).toBe(2)
  })

  it('re-points the avatar when the API address changes', async () => {
    await ensureOfficialAccounts(handle.db, API_URL)
    await ensureOfficialAccounts(handle.db, 'https://api2.langx.test')

    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ handle: 'langx' })
    expect(profile?.avatarUrl).toBe('https://api2.langx.test/public/avatar/official/langx')
  })

  /**
   * The failure worth a test of its own. `copilot` was only reserved once
   * these accounts were designed, so a database that predates that may have a
   * real person on the handle — and taking it from them would be a data loss
   * no index would have caught.
   */
  it('never takes a handle off a real account', async () => {
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person('copilot'))

    const results = await ensureOfficialAccounts(handle.db, API_URL)
    expect(results.find((r) => r.handle === 'copilot')?.outcome).toBe('conflict')
    expect(officialIds().has('copilot')).toBe(false)

    const theirs = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ handle: 'copilot' })
    expect(theirs?.official).toBeUndefined()
    expect(theirs?.displayName).toBe('copilot')
    // And no orphan `user` row left behind by the attempt.
    expect(await handle.db.collection(COLLECTIONS.user).countDocuments()).toBe(1)
  })

  it('publishes no age for an official account', async () => {
    await ensureOfficialAccounts(handle.db, API_URL)
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ handle: 'langx' })

    const view = toPublicProfile(profile!, true, {
      followers: 0,
      following: 0,
      viewerFollows: false,
    })
    expect(view.official).toBe(true)
    expect(view.age).toBeUndefined()
    // A person still has one — the branch, not the field, is what changed.
    expect(
      toPublicProfile(person('ada'), true, { followers: 0, following: 0, viewerFollows: false })
        .age,
    ).toBeGreaterThan(0)
  })

  /**
   * A projected read, so the flag has to be asked for by name. It was not, and
   * nothing failed: the page strangers reach simply never drew the tick.
   */
  it('marks an official account on the public web profile too', async () => {
    await ensureOfficialAccounts(handle.db, API_URL)
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person('ada'))

    expect((await getSharedProfile(handle.db, 'langx')).official).toBe(true)
    expect((await getSharedProfile(handle.db, 'ada')).official).toBeUndefined()
  })

  it('is findable by name although it is not discoverable', async () => {
    await ensureOfficialAccounts(handle.db, API_URL)
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person('ada'))

    const page = await searchHandles(handle.db, 'ada', 'lang')
    expect(page.items.map((i) => i.handle)).toEqual(['langx'])
  })

  it('knows its own ids', async () => {
    const results = await ensureOfficialAccounts(handle.db, API_URL)
    const langxId = results.find((r) => r.handle === 'langx')?.userId
    expect(isOfficialId(langxId!)).toBe(true)
    expect(isOfficialId('someone-else')).toBe(false)
  })

  describe('a conversation with one', () => {
    beforeEach(async () => {
      await ensureOfficialAccounts(handle.db, API_URL)
      await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person('ada'))
    })

    it('costs no initiation quota and pays no token', async () => {
      const langxId = officialIds().get('langx')!
      await startConversation(handle.db, 'ada', { toUserId: langxId, body: 'hello' })

      const ada = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: 'ada' })
      expect(ada?.quota.initiations).toEqual([])
      expect(ada?.stats.messagesSent).toBe(0)
      expect(await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments()).toBe(0)
    })

    it('still charges both for a conversation with a person', async () => {
      await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person('bo'))
      await startConversation(handle.db, 'ada', { toUserId: 'bo', body: 'hello' })

      const ada = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: 'ada' })
      expect(ada?.quota.initiations).toHaveLength(1)
      expect(await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments()).toBeGreaterThan(
        0,
      )
    })
  })
})
