import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Profile } from '../profiles/profiles'
import type { Conversation } from './conversations'
import { sendTextMessage } from './messages'
import { deleteConversationForUser, deleteMessage } from './mutations'

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

describe('withdrawing a message and the recipient’s unread count', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_withdraw_unread_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.conversations,
      COLLECTIONS.messages,
      COLLECTIONS.blocks,
      COLLECTIONS.tokenLedger,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertMany(['ada', 'bo'].map(person))
  })

  async function thread(): Promise<string> {
    const at = new Date(Date.now() - 1000)
    const conversation: Conversation = {
      _id: new ObjectId(),
      pairKey: 'ada_bo',
      participants: ['ada', 'bo'],
      lastMessage: { body: 'hi', senderId: 'ada', createdAt: at },
      unread: { ada: 0, bo: 0 },
      firstMessageBy: 'ada',
      firstMessageAt: at,
      bothSpoke: true,
      messageCount: 0,
      messageCountBy: {},
      createdAt: at,
      updatedAt: at,
    }
    await handle.db.collection<Conversation>(COLLECTIONS.conversations).insertOne(conversation)
    return conversation._id.toHexString()
  }

  async function unreadFor(conversationId: string, userId: string): Promise<number | undefined> {
    const row = await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({ _id: new ObjectId(conversationId) })
    return row?.unread[userId]
  }

  it('takes an unread message off the count', async () => {
    const id = await thread()
    await sendTextMessage(handle.db, 'ada', { conversationId: id, body: 'one' })
    const sent = await sendTextMessage(handle.db, 'ada', { conversationId: id, body: 'two' })
    await deleteMessage(handle.db, 'ada', {
      conversationId: id,
      messageId: sent.message._id.toHexString(),
      scope: 'everyone',
    })
    expect(await unreadFor(id, 'bo')).toBe(1)
  })

  it('leaves a newer message counted when the withdrawn one went with a deleted chat', async () => {
    const id = await thread()
    const old = await sendTextMessage(handle.db, 'ada', { conversationId: id, body: 'one' })
    // Bo deletes the chat unread, then Ada writes again and the thread comes back.
    await deleteConversationForUser(handle.db, id, 'bo')
    await sendTextMessage(handle.db, 'ada', { conversationId: id, body: 'two' })
    expect(await unreadFor(id, 'bo')).toBe(1)

    await deleteMessage(handle.db, 'ada', {
      conversationId: id,
      messageId: old.message._id.toHexString(),
      scope: 'everyone',
    })
    expect(await unreadFor(id, 'bo')).toBe(1)
  })
})
