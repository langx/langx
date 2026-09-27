import { MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES } from '@langx/shared'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Profile } from '../profiles/profiles'
import type { Conversation, Message } from './conversations'
import { sendLocation } from './messages'
import { toMessageView } from './messageView'

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

/** Kadıköy pier, to more places than anyone should be shown by accident. */
const PIER = { lat: 40.991234, lng: 29.023456 }

describe('sharing a location', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_location_test')
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
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .insertMany(['ada', 'bo', 'eve'].map(person))
  })

  /** `messageCountBy` is what the media gate reads: how much each side has sent. */
  async function thread(sentBy: Record<string, number>) {
    const now = new Date()
    const conversation: Conversation = {
      _id: new ObjectId(),
      pairKey: 'ada:bo',
      participants: ['ada', 'bo'],
      lastMessage: { body: 'hi', senderId: 'ada', createdAt: now },
      unread: {},
      firstMessageBy: 'ada',
      firstMessageAt: now,
      bothSpoke: true,
      messageCount: Object.values(sentBy).reduce((sum, n) => sum + n, 0),
      messageCountBy: sentBy,
      createdAt: now,
      updatedAt: now,
    }
    await handle.db.collection<Conversation>(COLLECTIONS.conversations).insertOne(conversation)
    return conversation
  }

  /** A thread where bo has written to ada enough times for her to share one. */
  const unlocked = () => thread({ ada: 1, bo: MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES })

  function stored(id: ObjectId) {
    return handle.db.collection<Message>(COLLECTIONS.messages).findOne({ _id: id })
  }

  it('rounds an approximate point on the server, whatever the client sent', async () => {
    const conversation = await unlocked()
    const { message } = await sendLocation(handle.db, 'ada', {
      conversationId: conversation._id.toHexString(),
      ...PIER,
      precision: 'approximate',
      label: 'Kadıköy, İstanbul',
    })

    const row = await stored(message._id)
    expect(row?.location).toEqual({
      lat: 40.99,
      lng: 29.02,
      precision: 'approximate',
      label: 'Kadıköy, İstanbul',
    })
    // The finer reading is not anywhere in the document, under any field.
    expect(JSON.stringify(row)).not.toContain('40.991234')
    expect(toMessageView(message, 'bo').location).toEqual(row?.location)
  })

  it('stores an exact point exactly as it was sent', async () => {
    const conversation = await unlocked()
    const { message } = await sendLocation(handle.db, 'ada', {
      conversationId: conversation._id.toHexString(),
      ...PIER,
      precision: 'exact',
    })

    expect((await stored(message._id))?.location).toEqual({ ...PIER, precision: 'exact' })
  })

  it('names itself in the chat list without saying where', async () => {
    const conversation = await unlocked()
    const { conversation: updated } = await sendLocation(handle.db, 'ada', {
      conversationId: conversation._id.toHexString(),
      ...PIER,
      precision: 'exact',
      label: 'Moda Sahili, Kadıköy',
    })

    expect(updated.lastMessage.body).toBe('📍 Location')
  })

  it('waits for the media gate, like a photo', async () => {
    const conversation = await thread({ ada: 3, bo: MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES - 1 })

    await expect(
      sendLocation(handle.db, 'ada', {
        conversationId: conversation._id.toHexString(),
        ...PIER,
        precision: 'approximate',
      }),
    ).rejects.toMatchObject({ code: 'MEDIA_LOCKED' })
    expect(await handle.db.collection(COLLECTIONS.messages).countDocuments()).toBe(0)
  })

  it('refuses somebody who is not in the conversation', async () => {
    const conversation = await unlocked()

    await expect(
      sendLocation(handle.db, 'eve', {
        conversationId: conversation._id.toHexString(),
        ...PIER,
        precision: 'approximate',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await handle.db.collection(COLLECTIONS.messages).countDocuments()).toBe(0)
  })

  it('sends once, however many times a lost ack is retried', async () => {
    const conversation = await unlocked()
    const input = {
      conversationId: conversation._id.toHexString(),
      ...PIER,
      precision: 'approximate' as const,
      clientId: 'retry-1',
    }

    const first = await sendLocation(handle.db, 'ada', input)
    const second = await sendLocation(handle.db, 'ada', input)

    expect(second.message._id.equals(first.message._id)).toBe(true)
    expect(await handle.db.collection(COLLECTIONS.messages).countDocuments()).toBe(1)
  })
})
