import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Conversation } from '../chat/conversations'
import { recordCallLog } from './callLog'
import type { Call } from './calls'

describe('a call reviving a deleted thread', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_call_log_test')
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

  async function thread(extra: Partial<Conversation>): Promise<Conversation> {
    const at = new Date('2026-10-01T10:00:00Z')
    const conversation: Conversation = {
      _id: new ObjectId(),
      pairKey: 'ada_bo',
      participants: ['ada', 'bo'],
      lastMessage: { body: 'hi', senderId: 'bo', createdAt: at },
      unread: { ada: 0, bo: 0 },
      firstMessageBy: 'bo',
      firstMessageAt: at,
      bothSpoke: true,
      createdAt: at,
      updatedAt: at,
      ...extra,
    }
    await handle.db.collection<Conversation>(COLLECTIONS.conversations).insertOne(conversation)
    return conversation
  }

  function missedCall(conversationId: ObjectId): Call {
    const at = new Date('2026-10-02T10:00:00Z')
    return {
      _id: crypto.randomUUID(),
      conversationId,
      callerId: 'bo',
      calleeId: 'ada',
      parties: ['bo', 'ada'],
      media: 'audio',
      state: 'ended',
      ringDeadline: at,
      deadline: at,
      createdAt: at,
      endedAt: at,
      endedFrom: 'ringing',
      endCause: 'timeout',
      caller: { resumeKey: 'k' },
    }
  }

  it('brings an old deleted-and-pinned thread back unpinned, as a message does', async () => {
    // What a delete wrote before it cleared the pin (see `deleteConversationForUser`).
    const conversation = await thread({ pinnedBy: { ada: true }, deletedBy: { ada: true } })

    const logged = await recordCallLog(handle.db, missedCall(conversation._id))

    expect(logged?.conversation.deletedBy?.ada).toBeUndefined()
    expect(logged?.conversation.pinnedBy?.ada).toBeUndefined()
  })

  it('leaves a pin alone on a thread that was never deleted', async () => {
    const conversation = await thread({
      pinnedBy: { ada: true, bo: true },
      deletedBy: { bo: true },
    })

    const logged = await recordCallLog(handle.db, missedCall(conversation._id))

    // Ada never deleted it: her pin stays. Bo did: his goes with the deletion.
    expect(logged?.conversation.pinnedBy?.ada).toBe(true)
    expect(logged?.conversation.pinnedBy?.bo).toBeUndefined()
    expect(logged?.conversation.unread.ada).toBe(1)
  })
})
