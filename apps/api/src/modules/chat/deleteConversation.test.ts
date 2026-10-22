import { MAX_PINNED_CONVERSATIONS } from '@langx/shared'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Conversation } from './conversations'
import { listConversations } from './messages'
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
  })

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
})
