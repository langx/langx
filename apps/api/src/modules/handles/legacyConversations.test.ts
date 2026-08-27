import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Conversation, Message } from '../chat/conversations'
import {
  importLegacyConversations,
  sweepLegacyImports,
  type LegacyMessage,
  type LegacyRoom,
} from './legacyConversations'
import type { LegacyProfile } from './legacyProfiles'

const ROOM = 'v1room'
/** v1 (Appwrite) ids on the left, the v2 accounts they came back as on the right. */
const ADA_V1 = 'v1-ada'
const BO_V1 = 'v1-bo'
const ADA = 'user-ada'
const BO = 'user-bo'

describe('importing a v1 conversation', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_legacy_chat_test')
    // `messages.legacy_id_unique` is the invariant half this suite is about.
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.legacyRooms,
      COLLECTIONS.legacyMessages,
      COLLECTIONS.legacyProfiles,
      COLLECTIONS.conversations,
      COLLECTIONS.messages,
      COLLECTIONS.tokenLedger,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  function stageProfile(legacyId: string, restoredBy?: string): Promise<unknown> {
    const record: LegacyProfile = {
      _id: legacyId,
      handle: legacyId,
      legacyEmailHash: `hash-${legacyId}`,
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'en', level: 'B1', priority: 1 }],
      photos: [],
      migratedAt: new Date(),
    }
    if (restoredBy) {
      record.restoredBy = restoredBy
      record.restoredAt = new Date()
    }
    return handle.db.collection<LegacyProfile>(COLLECTIONS.legacyProfiles).insertOne(record)
  }

  async function stageRoom(messages: Partial<LegacyMessage>[]): Promise<void> {
    const room: LegacyRoom = {
      _id: ROOM,
      participants: [ADA_V1, BO_V1],
      counts: { text: messages.length, image: 0, audio: 0 },
      migratedAt: new Date(),
    }
    await handle.db.collection<LegacyRoom>(COLLECTIONS.legacyRooms).insertOne(room)
    await handle.db.collection<LegacyMessage>(COLLECTIONS.legacyMessages).insertMany(
      messages.map((partial, index) => ({
        _id: `m${index}`,
        roomId: ROOM,
        senderId: ADA_V1,
        type: 'text',
        body: `message ${index}`,
        seen: true,
        createdAt: new Date(Date.UTC(2023, 0, 1, 0, index)),
        ...partial,
      })),
    )
  }

  const messagesIn = (conversationId: ObjectId) =>
    handle.db
      .collection<Message>(COLLECTIONS.messages)
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .toArray()

  /**
   * The consent rule, and the reason this migration is delayed rather than a
   * bulk one-off: importing on one person's return would republish the other
   * person's words into an account they never opened.
   */
  it('writes nothing while the other side has not come back', async () => {
    await stageProfile(ADA_V1, ADA)
    await stageProfile(BO_V1) // never restored
    await stageRoom([{}, {}])

    const result = await importLegacyConversations(handle.db, ADA, ADA_V1)

    expect(result).toEqual({ waitingOnPeer: 1, conversationsImported: 0, messagesImported: 0 })
    expect(await handle.db.collection(COLLECTIONS.conversations).countDocuments()).toBe(0)
    expect(await handle.db.collection(COLLECTIONS.messages).countDocuments()).toBe(0)
    // Still unclaimed, so the day Bo returns it is picked up.
    const room = await handle.db.collection<LegacyRoom>(COLLECTIONS.legacyRooms).findOne({})
    expect(room?.importedAt).toBeUndefined()
  })

  it('brings the thread across once the second person returns', async () => {
    await stageProfile(ADA_V1, ADA)
    await stageProfile(BO_V1, BO)
    await stageRoom([
      { body: 'merhaba' },
      { senderId: BO_V1, body: 'hello!' },
      { body: 'how are you' },
    ])

    const result = await importLegacyConversations(handle.db, BO, BO_V1)
    expect(result.conversationsImported).toBe(1)
    expect(result.messagesImported).toBe(3)

    const conversation = await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({})
    expect(conversation).toBeTruthy()
    expect(conversation!.participants.slice().sort()).toEqual([ADA, BO])
    expect(conversation!.bothSpoke).toBe(true)
    expect(conversation!.firstMessageBy).toBe(ADA)
    // Dated by its own history, not by the restore — a 2023 thread must not
    // sort above what the user has actually been doing this week.
    expect(conversation!.createdAt.getUTCFullYear()).toBe(2023)
    expect(conversation!.lastMessage.body).toBe('how are you')

    const written = await messagesIn(conversation!._id)
    expect(written.map((m) => m.body)).toEqual(['merhaba', 'hello!', 'how are you'])
    expect(written.map((m) => m.senderId)).toEqual([ADA, BO, ADA])
    expect(written.every((m) => m.legacyId)).toBe(true)
  })

  it('carries voice notes and photos, with the bytes already in our bucket', async () => {
    await stageProfile(ADA_V1, ADA)
    await stageProfile(BO_V1, BO)
    await stageRoom([
      {
        type: 'image',
        body: '',
        media: {
          url: 'https://cdn.langx.io/legacy/rooms/v1room/m0.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 120_000,
          width: 1200,
          height: 1600,
        },
      },
      {
        type: 'audio',
        body: '',
        senderId: BO_V1,
        media: {
          url: 'https://cdn.langx.io/legacy/rooms/v1room/m1.m4a',
          contentType: 'audio/mp4',
          sizeBytes: 48_000,
        },
      },
    ])

    await importLegacyConversations(handle.db, ADA, ADA_V1)

    const conversation = await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({})
    const written = await messagesIn(conversation!._id)
    expect(written.map((m) => m.type)).toEqual(['image', 'audio'])
    expect(written[0]!.media?.width).toBe(1200)
    expect(written[1]!.media?.contentType).toBe('audio/mp4')
    // A caption-less attachment must not leave the chat list showing a blank row.
    expect(conversation!.lastMessage.body).toBe('🎤 Voice message')
  })

  /**
   * v1's read state is mirrored rather than flattened to "all read": a message
   * someone never opened is a real thing still waiting for them, and marking
   * the whole thread read to keep the badge tidy would hide it for good.
   */
  it('keeps what was never read unread, addressed to the person who never read it', async () => {
    await stageProfile(ADA_V1, ADA)
    await stageProfile(BO_V1, BO)
    await stageRoom([
      { body: 'seen one', seen: true },
      { body: 'never opened', seen: false },
      { body: 'nor this', seen: false },
    ])

    await importLegacyConversations(handle.db, ADA, ADA_V1)

    const conversation = await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({})
    // Ada sent all three, so the unread ones are Bo's to read.
    expect(conversation!.unread[BO]).toBe(2)
    expect(conversation!.unread[ADA]).toBe(0)

    const written = await messagesIn(conversation!._id)
    expect(written[0]!.readAt).toBeInstanceOf(Date)
    expect(written[1]!.readAt).toBeUndefined()
  })

  /**
   * The importer inserts messages *before* it marks the room done, so a crash
   * in between leaves the room unclaimed and the next run replays it. This is
   * that replay: `messages.legacy_id_unique` has to absorb it silently.
   */
  it('replays without writing anything twice', async () => {
    await stageProfile(ADA_V1, ADA)
    await stageProfile(BO_V1, BO)
    await stageRoom([{}, {}, {}])

    await importLegacyConversations(handle.db, ADA, ADA_V1)
    // Un-claim the room, exactly as a crash between the two writes would.
    await handle.db
      .collection<LegacyRoom>(COLLECTIONS.legacyRooms)
      .updateOne({ _id: ROOM }, { $unset: { importedAt: '', importedConversationId: '' } })

    const second = await importLegacyConversations(handle.db, ADA, ADA_V1)

    expect(second.messagesImported).toBe(0)
    expect(await handle.db.collection(COLLECTIONS.messages).countDocuments()).toBe(3)
    expect(await handle.db.collection(COLLECTIONS.conversations).countDocuments()).toBe(1)
  })

  it('finishes a thread whose first half was already written', async () => {
    await stageProfile(ADA_V1, ADA)
    await stageProfile(BO_V1, BO)
    await stageRoom([{}, {}, {}])

    await importLegacyConversations(handle.db, ADA, ADA_V1)
    const conversation = await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({})
    // Lose the tail, as a batch interrupted midway would.
    await handle.db.collection<Message>(COLLECTIONS.messages).deleteOne({ legacyId: 'm2' })
    await handle.db
      .collection<LegacyRoom>(COLLECTIONS.legacyRooms)
      .updateOne({ _id: ROOM }, { $unset: { importedAt: '' } })

    const second = await importLegacyConversations(handle.db, ADA, ADA_V1)

    expect(second.messagesImported).toBe(1)
    expect(await messagesIn(conversation!._id)).toHaveLength(3)
  })

  /**
   * Both restored, and they had already started talking in v2 before the
   * import ran. The history still belongs in that thread — it just sorts
   * underneath what they have said since.
   */
  it('merges into a conversation the two of them had already started', async () => {
    await stageProfile(ADA_V1, ADA)
    await stageProfile(BO_V1, BO)
    await stageRoom([{ body: 'from 2023', seen: false }])

    const live = new Date()
    const existing: Conversation = {
      _id: new ObjectId(),
      pairKey: [ADA, BO].sort().join('_'),
      participants: [ADA, BO],
      lastMessage: { body: 'sent today', senderId: BO, createdAt: live },
      unread: { [ADA]: 1, [BO]: 0 },
      firstMessageBy: BO,
      firstMessageAt: live,
      bothSpoke: false,
      createdAt: live,
      updatedAt: live,
    }
    await handle.db.collection<Conversation>(COLLECTIONS.conversations).insertOne(existing)

    await importLegacyConversations(handle.db, ADA, ADA_V1)

    expect(await handle.db.collection(COLLECTIONS.conversations).countDocuments()).toBe(1)
    const merged = await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({ _id: existing._id })
    // The newer message stays on top of the chat list...
    expect(merged!.lastMessage.body).toBe('sent today')
    // ...but the thread genuinely began in 2023, and the unread carries over.
    expect(merged!.firstMessageBy).toBe(ADA)
    expect(merged!.firstMessageAt.getUTCFullYear()).toBe(2023)
    expect(merged!.unread[BO]).toBe(1)
    expect(merged!.unread[ADA]).toBe(1)
    expect(await messagesIn(existing._id)).toHaveLength(1)
  })

  /**
   * These messages were paid for in v1, and that payment is already coming
   * back as the converted balance. Awarding tokens again would mint the same
   * work twice — and a 400-message thread would arrive as a leaderboard win.
   */
  it('pays out nothing — this is history, not activity', async () => {
    await stageProfile(ADA_V1, ADA)
    await stageProfile(BO_V1, BO)
    await stageRoom([{}, {}, {}, {}, {}])

    await importLegacyConversations(handle.db, ADA, ADA_V1)

    expect(await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments()).toBe(0)
  })

  it('leaves a thread alone when only one v2 account is behind both sides', async () => {
    await stageProfile(ADA_V1, ADA)
    await stageProfile(BO_V1, ADA) // both v1 accounts restored onto one person
    await stageRoom([{}])

    const result = await importLegacyConversations(handle.db, ADA, ADA_V1)

    expect(result.conversationsImported).toBe(0)
    expect(await handle.db.collection(COLLECTIONS.conversations).countDocuments()).toBe(0)
  })

  /**
   * The restore hook swallows its errors so a failed import can never fail a
   * sign-in — which is exactly why something has to come back for it later.
   */
  it('is caught by the sweep when the restore hook dropped it', async () => {
    await stageProfile(ADA_V1, ADA)
    await stageProfile(BO_V1, BO)
    await stageRoom([{}, {}])

    const result = await sweepLegacyImports(handle.db)

    expect(result.conversationsImported).toBe(1)
    expect(result.messagesImported).toBe(2)
    expect(await sweepLegacyImports(handle.db)).toEqual({
      waitingOnPeer: 0,
      conversationsImported: 0,
      messagesImported: 0,
    })
  })
})
