import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Profile } from '../profiles/profiles'
import { followUser, listFollowers, listFollowing, readFollowState } from './follows'

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

describe('follow counts agree with the lists beside them', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_follows_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await handle.db.collection(COLLECTIONS.follows).deleteMany({})
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .insertMany(['ada', 'bo', 'cy'].map(person))
  })

  it('leaves an account in its deletion grace out of your own counts', async () => {
    await followUser(handle.db, 'ada', 'bo')
    await followUser(handle.db, 'ada', 'cy')
    await followUser(handle.db, 'bo', 'ada')
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: 'bo' }, { $set: { deletedAt: new Date() } })

    const own = await readFollowState(handle.db, 'ada', 'ada')
    const following = await listFollowing(handle.db, 'ada', 'ada', { limit: 20 })
    const followers = await listFollowers(handle.db, 'ada', 'ada', { limit: 20 })

    expect(following.items.map((p) => p._id)).toEqual(['cy'])
    expect(followers.items).toEqual([])
    expect(own).toMatchObject({ following: 1, followers: 0 })
  })

  it('still shows your own lists whole, "hide me from Discover" included', async () => {
    await followUser(handle.db, 'ada', 'bo')
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: 'bo' }, { $set: { 'settings.discoverable': false } })

    expect(await readFollowState(handle.db, 'ada', 'ada')).toMatchObject({ following: 1 })
    // Somebody else looking at Ada's list does not see Bo, and the count agrees.
    expect(await readFollowState(handle.db, 'cy', 'ada')).toMatchObject({ following: 0 })
  })
})
