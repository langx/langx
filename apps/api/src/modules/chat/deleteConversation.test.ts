import { MAX_PINNED_CONVERSATIONS } from '@langx/shared'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Profile } from '../profiles/profiles'
import type { Conversation } from './conversations'
import { listConversations, sendTextMessage } from './messages'
import { deleteConversationForUser, setConversationFlag } from './mutations'

describe('deleting a pinned chat', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_delete_conversation_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.conversations).deleteMany({})
    await handle.db.collection(COLLECTIONS.messages).deleteMany({})
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await handle.db.collection(COLLECTIONS.tokenLedger).deleteMany({})
  })

  async function legacyDeletedPin(id: string): Promise<void> {
    // What a delete wrote before it cleared the pin.
    await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { 'pinnedBy.ada': true, 'deletedBy.ada': true } },
      )
  }

  async function thread(partner: string): Promise<string> {
    const at = new Date()
    const conversation: Conversation = {
      _id: new ObjectId(),
      pairKey: ['ada', partner].sort().join('_'),
      participants: ['ada', partner],
      lastMessage: { body: 'hi', senderId: partner, createdAt: at },
      unread: { ada: 0, [partner]: 0 },
      firstMessageBy: partner,
      firstMessageAt: at,
      bothSpoke: true,
      createdAt: at,
      updatedAt: at,
    }
    await handle.db.collection<Conversation>(COLLECTIONS.conversations).insertOne(conversation)
    return conversation._id.toHexString()
  }

  it('gives its pin slot back', async () => {
    const ids: string[] = []
    for (let i = 0; i < MAX_PINNED_CONVERSATIONS; i++) ids.push(await thread(`p${i}`))
    for (const id of ids) await setConversationFlag(handle.db, id, 'ada', 'pinnedBy', true)

    await deleteConversationForUser(handle.db, ids[0] ?? '', 'ada')
    const page = await listConversations(handle.db, 'ada', { limit: 50 })
    expect(page.pinned).toHaveLength(MAX_PINNED_CONVERSATIONS - 1)

    // One visible pin short of the cap, so one more fits.
    const extra = await thread('extra')
    await expect(setConversationFlag(handle.db, extra, 'ada', 'pinnedBy', true)).resolves.toEqual(
      expect.objectContaining({ pinned: true }),
    )
  })
  it('does not count a deleted thread that still carries an old pin', async () => {
    const ids: string[] = []
    for (let i = 0; i < MAX_PINNED_CONVERSATIONS; i++) ids.push(await thread(`p${i}`))
    for (const id of ids.slice(1)) await setConversationFlag(handle.db, id, 'ada', 'pinnedBy', true)
    await legacyDeletedPin(ids[0] ?? '')

    const extra = await thread('extra')
    await expect(setConversationFlag(handle.db, extra, 'ada', 'pinnedBy', true)).resolves.toEqual(
      expect.objectContaining({ pinned: true }),
    )
  })

  it('refuses a pin from a device that has not seen the delete', async () => {
    const id = await thread('bo')
    await deleteConversationForUser(handle.db, id, 'ada')
    await expect(setConversationFlag(handle.db, id, 'ada', 'pinnedBy', true)).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    )
    const row = await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({ _id: new ObjectId(id) })
    expect(row?.pinnedBy?.ada).toBeUndefined()
    // Unpinning, archiving and muting are still fine: nothing is held by them.
    await expect(setConversationFlag(handle.db, id, 'ada', 'mutedBy', true)).resolves.toBeDefined()
  })

  it('brings an old deleted-and-pinned thread back unpinned, and only for the deleter', async () => {
    const now = new Date()
    for (const id of ['ada', 'bo']) {
      await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne({
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
      })
    }
    const id = await thread('bo')
    await setConversationFlag(handle.db, id, 'bo', 'pinnedBy', true)
    await legacyDeletedPin(id)

    await sendTextMessage(handle.db, 'bo', { conversationId: id, body: 'back again' })
    const row = await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({ _id: new ObjectId(id) })
    expect(row?.deletedBy?.ada).toBeUndefined()
    expect(row?.pinnedBy?.ada).toBeUndefined()
    expect(row?.pinnedBy?.bo).toBe(true)
  })
})
