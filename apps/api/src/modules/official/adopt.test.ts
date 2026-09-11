import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Profile } from '../profiles/profiles'
import { ensureOfficialAccounts } from './accounts'
import { adoptOfficialAccount } from './adopt'

const ID = new ObjectId()
const USER_ID = ID.toHexString()

/** The account as it is before adoption: a real one, signed in to, with history. */
async function seedRunByHand(db: DbHandle['db']): Promise<void> {
  const now = new Date()
  await db.collection<Profile>(COLLECTIONS.profiles).insertOne({
    _id: USER_ID,
    handle: 'langx',
    displayName: 'xue',
    bio: 'Follow us on every platform we have ever opened',
    photos: [{ url: 'https://media.langx.test/a.jpg', createdAt: now }],
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'en' }],
    learning: [{ code: 'tr', level: 'beginner', priority: 1 }],
    interests: [],
    settings: { discoverable: true, notifications: true },
    privacy: { incognito: false, hideOnlineStatus: false },
    entitlement: { tier: 'free', updatedAt: now },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 9, longest: 12, lastQualifiedDay: '2026-09-09' },
    stats: { lastActiveAt: now, messagesSent: 24 },
    createdAt: now,
    updatedAt: now,
  })
  await db.collection(COLLECTIONS.user).insertOne({
    _id: ID,
    email: 'hi@langx.test',
    name: 'xue',
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })
  await db.collection(COLLECTIONS.session).insertMany([
    { userId: ID, token: 'a', expiresAt: now },
    { userId: ID, token: 'b', expiresAt: now },
  ])
  await db.collection(COLLECTIONS.account).insertMany([
    { userId: ID, providerId: 'credential' },
    { userId: ID, providerId: 'google' },
  ])
}

describe('adopting an account that was run by hand', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_official_adopt_test')
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
      COLLECTIONS.session,
      COLLECTIONS.account,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    await seedRunByHand(handle.db)
  })

  it('closes every door into the account', async () => {
    const result = await adoptOfficialAccount(handle.db, 'langx')

    expect(result).toMatchObject({
      userId: USER_ID,
      previousEmail: 'hi@langx.test',
      sessionsRevoked: 2,
      credentialsRemoved: 2,
      alreadyOfficial: false,
    })
    expect(await handle.db.collection(COLLECTIONS.session).countDocuments()).toBe(0)
    expect(await handle.db.collection(COLLECTIONS.account).countDocuments()).toBe(0)

    // And the address is undeliverable, so no link can arrive at one either.
    const user = await handle.db
      .collection<{ email: string }>(COLLECTIONS.user)
      .findOne({ _id: ID })
    expect(user?.email).toBe('langx@official.langx.invalid')
  })

  it('frees the old address for the mailbox it actually is', async () => {
    await adoptOfficialAccount(handle.db, 'langx')
    expect(
      await handle.db.collection(COLLECTIONS.user).countDocuments({ email: 'hi@langx.test' }),
    ).toBe(0)
  })

  it('keeps what the account is and applies what an official one must be', async () => {
    await adoptOfficialAccount(handle.db, 'langx')

    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: USER_ID })
    // Kept.
    expect(profile?.photos).toHaveLength(1)
    expect(profile?.streak.current).toBe(9)
    expect(profile?.stats.messagesSent).toBe(24)
    // Applied.
    expect(profile?.official).toBe(true)
    expect(profile?.settings.discoverable).toBe(false)
    expect(profile?.settings.notifications).toBe(false)
    expect(profile?.privacy.hideOnlineStatus).toBe(true)
    expect(profile?.tokenFrozenAt).toBeInstanceOf(Date)
    // Same shape as one this boot created, rather than nearly the same.
    expect(profile?.nativeLanguages).toEqual([])
    expect(profile?.learning).toEqual([])
  })

  /**
   * The point of adopting rather than renaming: the boot that follows treats
   * it as its own, and the name and bio it has been wearing become the
   * assistant's.
   */
  it('is picked up by the next boot as the official account', async () => {
    await adoptOfficialAccount(handle.db, 'langx')
    const results = await ensureOfficialAccounts(handle.db, 'https://api.langx.test')

    expect(results.find((r) => r.handle === 'langx')).toMatchObject({
      outcome: 'updated',
      userId: USER_ID,
    })
    const profile = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: USER_ID })
    expect(profile?.displayName).toBe('LangX')
    expect(profile?.bio).toContain('LangX assistant')
    expect(profile?.avatarUrl).toBe('https://api.langx.test/public/avatar/official/langx')
  })

  it('does nothing the second time', async () => {
    await adoptOfficialAccount(handle.db, 'langx')
    const again = await adoptOfficialAccount(handle.db, 'langx')
    expect(again.alreadyOfficial).toBe(true)
    expect(again.sessionsRevoked).toBe(0)
  })

  it('refuses a handle nobody holds', async () => {
    await expect(adoptOfficialAccount(handle.db, 'copilot')).rejects.toThrow('nothing to adopt')
  })
})
