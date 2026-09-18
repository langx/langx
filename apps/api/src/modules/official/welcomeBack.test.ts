import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Message } from '../chat/conversations'
import type { Profile } from '../profiles/profiles'
import { ensureOfficialAccounts } from './accounts'
import { sendWelcomeBackMessage } from './welcomeBack'

function person(id: string, native: string): Profile {
  const now = new Date()
  return {
    _id: id,
    handle: id,
    displayName: id,
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: native }],
    learning: [{ code: native === 'en' ? 'tr' : 'en', level: 'intermediate', priority: 1 }],
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

describe('the welcome back from @langx', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_welcome_back_test')
    // `sender_client_id_unique` is the whole idempotency story here.
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
    await ensureOfficialAccounts(handle.db, 'https://api.langx.test')
  })

  async function messagesTo(userId: string): Promise<Message[]> {
    return handle.db
      .collection<Message>(COLLECTIONS.messages)
      .find({ clientId: `welcomeback:${userId}` })
      .toArray()
  }

  it('says the three parts, in the reader’s own language', async () => {
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person('ayse', 'tr'))

    await sendWelcomeBackMessage(handle.db, 'ayse')

    const [message] = await messagesTo('ayse')
    expect(message?.body?.split('\n\n')).toHaveLength(3)
    expect(message?.body).toContain('tekrar hoş geldin')
  })

  /**
   * `auth.ts` calls this on every session, not only the first one, so being
   * called again is the normal case rather than a retry. The index refuses the
   * second write; nothing here reads a flag to decide.
   */
  it('writes nothing on the second call', async () => {
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person('bob', 'en'))

    await sendWelcomeBackMessage(handle.db, 'bob')
    await sendWelcomeBackMessage(handle.db, 'bob')
    await sendWelcomeBackMessage(handle.db, 'bob')

    expect(await messagesTo('bob')).toHaveLength(1)
  })

  /**
   * An account seconds old has no languages yet, and `localeFor` answers
   * English when it has none to read. Sending here would spend the one message
   * this person ever gets on a guess; onboarding calls again once the answer
   * exists, and the `clientId` means it is still only sent once.
   */
  it('waits for the profile rather than guessing a language', async () => {
    await sendWelcomeBackMessage(handle.db, 'nobody')
    expect(await messagesTo('nobody')).toHaveLength(0)

    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person('nobody', 'de'))
    await sendWelcomeBackMessage(handle.db, 'nobody')

    const [message] = await messagesTo('nobody')
    expect(message?.body).toContain('wieder da bist')
  })
})
