import { MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES, PLAN_LIMITS } from '@langx/shared'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Profile } from '../profiles/profiles'
import type { Conversation, Message } from './conversations'
import { forwardMessage } from './messages'
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

const PHOTO = {
  url: 'https://media.test/messages/source/a.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 1024,
}

describe('forwarding a message', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_forward_test')
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
      .insertMany(['ada', 'bo', 'cy', 'eve'].map(person))
  })

  /** `messageCountBy` is what the media gate reads: how much each side has sent. */
  async function thread(a: string, b: string, sentBy: Record<string, number> = {}) {
    const now = new Date()
    const conversation: Conversation = {
      _id: new ObjectId(),
      pairKey: [a, b].sort().join(':'),
      participants: [a, b],
      lastMessage: { body: 'hi', senderId: a, createdAt: now },
      unread: {},
      firstMessageBy: a,
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

  async function message(conversation: Conversation, fields: Partial<Message>) {
    const row: Message = {
      _id: new ObjectId(),
      conversationId: conversation._id,
      senderId: conversation.participants[1],
      type: 'text',
      body: 'Bonjour à tous',
      createdAt: new Date(),
      ...fields,
    }
    await handle.db.collection<Message>(COLLECTIONS.messages).insertOne(row)
    return row
  }

  function mediaUnitsSpent(userId: string) {
    return handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId })
      .then((profile) => (profile?.quota.media ?? []).length)
  }

  it('sends the words into the target thread, marked as forwarded', async () => {
    const source = await thread('ada', 'bo')
    const target = await thread('ada', 'cy')
    const original = await message(source, {})

    const { message: sent } = await forwardMessage(handle.db, 'ada', {
      conversationId: target._id.toHexString(),
      messageId: original._id.toHexString(),
    })

    expect(sent.conversationId.equals(target._id)).toBe(true)
    expect(sent.senderId).toBe('ada')
    expect(sent.body).toBe('Bonjour à tous')
    expect(sent.forwarded).toBe(true)
    expect(toMessageView(sent, 'cy').forwarded).toBe(true)
    // Nothing about where it came from reaches the new reader.
    expect(JSON.stringify(toMessageView(sent, 'cy'))).not.toContain(source._id.toHexString())
  })

  describe('the original has to be one the forwarder can read', () => {
    it('refuses a message from a thread they are not in', async () => {
      const elsewhere = await thread('bo', 'eve')
      const target = await thread('ada', 'cy')
      const original = await message(elsewhere, {})

      await expect(
        forwardMessage(handle.db, 'ada', {
          conversationId: target._id.toHexString(),
          messageId: original._id.toHexString(),
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      expect(await handle.db.collection(COLLECTIONS.messages).countDocuments()).toBe(1)
    })

    it('refuses one they hid, and one its sender withdrew', async () => {
      const source = await thread('ada', 'bo')
      const target = await thread('ada', 'cy')
      const hidden = await message(source, { hiddenFor: ['ada'] })
      const withdrawn = await message(source, { deletedAt: new Date(), body: '' })

      for (const original of [hidden, withdrawn]) {
        await expect(
          forwardMessage(handle.db, 'ada', {
            conversationId: target._id.toHexString(),
            messageId: original._id.toHexString(),
          }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      }
    })

    it('refuses one from a thread with somebody since blocked', async () => {
      const source = await thread('ada', 'bo')
      const target = await thread('ada', 'cy')
      const original = await message(source, {})
      await handle.db
        .collection(COLLECTIONS.blocks)
        .insertOne({ blockerId: 'bo', blockedId: 'ada', createdAt: new Date() })

      await expect(
        forwardMessage(handle.db, 'ada', {
          conversationId: target._id.toHexString(),
          messageId: original._id.toHexString(),
        }),
      ).rejects.toMatchObject({ code: 'BLOCKED' })
    })

    it('refuses the kinds that do not travel', async () => {
      const source = await thread('ada', 'bo')
      const target = await thread('ada', 'cy')
      const quiz = await message(source, {
        type: 'quiz',
        body: '',
        quiz: { question: '?', options: ['a', 'b'], correctIndex: 0 },
      })

      await expect(
        forwardMessage(handle.db, 'ada', {
          conversationId: target._id.toHexString(),
          messageId: quiz._id.toHexString(),
        }),
      ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    })
  })

  describe('a photo', () => {
    it('is held back by the target thread’s media gate, and spends nothing', async () => {
      // Unlocked where it came from, and nothing yet received from cy.
      const source = await thread('ada', 'bo', { bo: MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES })
      const target = await thread('ada', 'cy', { ada: 1 })
      const original = await message(source, { type: 'image', body: '', attachments: [PHOTO] })

      await expect(
        forwardMessage(handle.db, 'ada', {
          conversationId: target._id.toHexString(),
          messageId: original._id.toHexString(),
        }),
      ).rejects.toMatchObject({ code: 'MEDIA_LOCKED' })
      expect(
        await handle.db
          .collection(COLLECTIONS.messages)
          .countDocuments({ conversationId: target._id }),
      ).toBe(0)
      expect(await mediaUnitsSpent('ada')).toBe(0)
    })

    it('reuses the same file once the gate is open, and spends one unit', async () => {
      const source = await thread('ada', 'bo')
      const target = await thread('ada', 'cy', { cy: MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES })
      const original = await message(source, {
        type: 'image',
        body: 'the menu',
        attachments: [PHOTO],
        media: PHOTO,
      })

      const { message: sent } = await forwardMessage(handle.db, 'ada', {
        conversationId: target._id.toHexString(),
        messageId: original._id.toHexString(),
      })

      expect(sent.type).toBe('image')
      expect(sent.body).toBe('the menu')
      expect(sent.attachments).toEqual([PHOTO])
      expect(sent.forwarded).toBe(true)
      expect(await mediaUnitsSpent('ada')).toBe(1)
    })

    it('is refused once the day’s attachments are spent', async () => {
      const source = await thread('ada', 'bo')
      const target = await thread('ada', 'cy', { cy: MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES })
      const original = await message(source, { type: 'image', body: '', attachments: [PHOTO] })
      const now = new Date()
      await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
        { _id: 'ada' },
        {
          $set: {
            'quota.media': Array.from({ length: PLAN_LIMITS.free.mediaPer24h ?? 0 }, () => now),
          },
        },
      )

      await expect(
        forwardMessage(handle.db, 'ada', {
          conversationId: target._id.toHexString(),
          messageId: original._id.toHexString(),
        }),
      ).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
    })
  })
})
