import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Conversation } from '../chat/conversations'
import { listConversations } from '../chat/messages'
import type { Profile } from '../profiles/profiles'
import { ensureOfficialAccounts } from './accounts'
import { deliverOfficialMessage } from './deliver'

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

describe('a message from an official account', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_official_deliver_test')
    // `sender_client_id_unique` and `pair_key_unique` are what this is about.
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
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person('ada'))
  })

  it('opens the conversation and leaves the recipient one unread', async () => {
    const delivered = await deliverOfficialMessage(handle.db, {
      fromHandle: 'langx',
      toUserId: 'ada',
      body: 'hello',
    })

    expect(delivered?.message.body).toBe('hello')
    expect(delivered?.conversation.unread.ada).toBe(1)
    expect(delivered?.conversation.messageCount).toBe(1)
    expect(delivered?.conversation.lastMessage.body).toBe('hello')
    expect(await handle.db.collection(COLLECTIONS.messages).countDocuments()).toBe(1)
  })

  /**
   * The whole idempotency story, and the reason a half-finished announcement
   * can simply be run again.
   */
  it('cannot be sent twice under the same clientId', async () => {
    const first = await deliverOfficialMessage(handle.db, {
      fromHandle: 'langx',
      toUserId: 'ada',
      body: 'hello',
      clientId: 'welcome:ada',
    })
    const second = await deliverOfficialMessage(handle.db, {
      fromHandle: 'langx',
      toUserId: 'ada',
      body: 'hello again',
      clientId: 'welcome:ada',
    })

    expect(second?.message._id.toHexString()).toBe(first?.message._id.toHexString())
    expect(await handle.db.collection(COLLECTIONS.messages).countDocuments()).toBe(1)
    const conversation = await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({})
    expect(conversation?.unread.ada).toBe(1)
  })

  /** Two announcements are two messages in one thread, not two threads. */
  it('writes into the thread it already opened rather than a second one', async () => {
    await deliverOfficialMessage(handle.db, {
      fromHandle: 'langx',
      toUserId: 'ada',
      body: 'first',
      clientId: 'announcement:one',
    })
    const second = await deliverOfficialMessage(handle.db, {
      fromHandle: 'langx',
      toUserId: 'ada',
      body: 'second',
      clientId: 'announcement:two',
    })

    expect(await handle.db.collection(COLLECTIONS.conversations).countDocuments()).toBe(1)
    expect(second?.conversation.messageCount).toBe(2)
    expect(second?.conversation.unread.ada).toBe(2)
  })

  /**
   * The unreplied tab is a to-do list, and an announcement is not on it: the
   * account takes no messages, so nothing the viewer could do would ever clear
   * the thread from that tab. It belongs in the chat list and nowhere else.
   */
  it('stays out of the unreplied tab', async () => {
    const delivered = await deliverOfficialMessage(handle.db, {
      fromHandle: 'langx',
      toUserId: 'ada',
      body: 'hello',
    })

    const all = await listConversations(handle.db, 'ada', { limit: 20 })
    expect(all.items.map((c) => c._id)).toEqual([delivered?.conversation._id.toHexString()])

    const unreplied = await listConversations(handle.db, 'ada', { filter: 'unreplied', limit: 20 })
    expect(unreplied.items).toHaveLength(0)
    expect(unreplied.pinned).toHaveLength(0)
  })

  it('pays nobody for the exchange', async () => {
    await deliverOfficialMessage(handle.db, { fromHandle: 'langx', toUserId: 'ada', body: 'hello' })
    expect(await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments()).toBe(0)

    const langx = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ handle: 'langx' })
    expect(langx?.stats.messagesSent).toBe(0)
  })

  it('says nothing when a real account holds the handle', async () => {
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({ official: true })
    await handle.db.collection(COLLECTIONS.user).deleteMany({})
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person('langx'))
    await ensureOfficialAccounts(handle.db, 'https://api.langx.test')

    const delivered = await deliverOfficialMessage(handle.db, {
      fromHandle: 'langx',
      toUserId: 'ada',
      body: 'hello',
    })
    expect(delivered).toBeNull()
  })

  /**
   * A profile removed by hand leaves its `user` row behind, and reusing it is
   * what stops `user_email_uidx` turning the next boot into a crash loop.
   */
  it('reuses an account row whose profile has gone missing', async () => {
    const before = await handle.db
      .collection(COLLECTIONS.user)
      .findOne({ email: 'langx@official.langx.invalid' })
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({ official: true })

    const results = await ensureOfficialAccounts(handle.db, 'https://api.langx.test')
    expect(results.every((r) => r.outcome === 'created')).toBe(true)
    expect(await handle.db.collection(COLLECTIONS.user).countDocuments()).toBe(2)
    const after = await handle.db.collection(COLLECTIONS.profiles).findOne({ handle: 'langx' })
    expect(after?._id).toBe(String(before?._id))
  })
})
