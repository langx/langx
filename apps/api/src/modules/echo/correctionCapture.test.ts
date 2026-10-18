import { DEFAULT_APP_CONFIG, PLAN_LIMITS } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { TranslationProvider } from '../../translation/TranslationProvider'
import { updateAppConfig } from '../appConfig/appConfig'
import type { Conversation, Message } from '../chat/conversations'
import { sendCorrection } from '../chat/messages'
import type { Profile } from '../profiles/profiles'
import { rememberTranslation } from '../translation/translate'
import { captureFromMessage } from './cards'
import { captureReceivedCorrection } from './correctionCapture'
import type { EchoCardDoc } from './documents'

/** Ada is a Turkish native writing English; Bo, an English native, corrects her. */
function person(id: string, fields: Partial<Profile>): Profile {
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
    ...fields,
  }
}

describe('a received correction becomes an Echo card', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_correction_echo_test')
    await ensureIndexes(handle.db)
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.conversations,
      COLLECTIONS.messages,
      COLLECTIONS.blocks,
      COLLECTIONS.echoCards,
      COLLECTIONS.tokenLedger,
      COLLECTIONS.translationCache,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertMany([
      person('ada', {}),
      person('bo', {
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'tr', level: 'beginner', priority: 1 }],
      }),
    ])
    await setFlag(false)
  })

  async function setFlag(on: boolean) {
    await updateAppConfig(handle.db, {
      flags: { ...DEFAULT_APP_CONFIG.flags, echoFromCorrections: on },
    })
  }

  /**
   * Ada's sentence, and Bo's correction of it, written straight in — so no
   * capture is in flight behind the test's back. The one test about the
   * wiring sends through `sendCorrection` instead.
   */
  async function corrected(): Promise<{ conversation: Conversation; correction: Message }> {
    const { conversation, target } = await sentence()
    const correction: Message = {
      _id: new ObjectId(),
      conversationId: conversation._id,
      senderId: 'bo',
      type: 'correction',
      body: 'I went home',
      correction: { targetMessageId: target._id, original: target.body, corrected: 'I went home' },
      createdAt: new Date(),
    }
    await handle.db.collection<Message>(COLLECTIONS.messages).insertOne(correction)
    return { conversation, correction }
  }

  async function sentence(): Promise<{ conversation: Conversation; target: Message }> {
    const now = new Date()
    const conversation: Conversation = {
      _id: new ObjectId(),
      pairKey: 'ada:bo',
      participants: ['ada', 'bo'],
      lastMessage: { body: 'I goed home', senderId: 'ada', createdAt: now },
      unread: {},
      firstMessageBy: 'ada',
      firstMessageAt: now,
      bothSpoke: true,
      messageCount: 1,
      messageCountBy: { ada: 1, bo: 0 },
      createdAt: now,
      updatedAt: now,
    }
    await handle.db.collection<Conversation>(COLLECTIONS.conversations).insertOne(conversation)
    const target: Message = {
      _id: new ObjectId(),
      conversationId: conversation._id,
      senderId: 'ada',
      type: 'text',
      body: 'I goed home',
      createdAt: now,
    }
    await handle.db.collection<Message>(COLLECTIONS.messages).insertOne(target)
    return { conversation, target }
  }

  function cards() {
    return handle.db.collection<EchoCardDoc>(COLLECTIONS.echoCards).find({}).toArray()
  }

  it('keeps nothing while the switch is off', async () => {
    const { conversation, correction } = await corrected()
    expect(await captureReceivedCorrection(handle.db, conversation, correction)).toBe('off')
    expect(await cards()).toHaveLength(0)
  })

  describe('with the switch on', () => {
    beforeEach(async () => {
      await setFlag(true)
    })

    it('keeps the corrected sentence for the person who was corrected, with an empty back', async () => {
      const { conversation, correction } = await corrected()
      expect(await captureReceivedCorrection(handle.db, conversation, correction)).toBe('created')

      const all = await cards()
      expect(all).toHaveLength(1)
      const [card] = all
      expect(card?.userId).toBe('ada')
      expect(card?.front).toBe('I went home')
      expect(card?.lang).toBe('en')
      // Nothing on the message and nothing in the cache: no provider is asked.
      expect(card?.back).toBe('')
      expect(card?.sourceKey).toBe(`msg:${correction._id.toHexString()}`)
    })

    it('copies a translation the shared cache already holds', async () => {
      await rememberTranslation(
        handle.db,
        { text: 'I went home', targetLang: 'tr' },
        { translatedText: 'Eve gittim', sourceLang: 'en' },
      )
      const { conversation, correction } = await corrected()
      await captureReceivedCorrection(handle.db, conversation, correction)
      expect((await cards())[0]?.back).toBe('Eve gittim')
    })

    it('makes a second run a no-op, and a later "Add echo" tap fill the empty back once', async () => {
      const { conversation, correction } = await corrected()
      expect(await captureReceivedCorrection(handle.db, conversation, correction)).toBe('created')
      expect(await captureReceivedCorrection(handle.db, conversation, correction)).toBe('kept')

      const translate = vi
        .fn<TranslationProvider['translate']>()
        .mockResolvedValue({ translatedText: 'Eve gittim', sourceLang: 'en' })
      const tap = () =>
        captureFromMessage(handle.db, { translation: { translate } }, 'ada', {
          conversationId: conversation._id.toHexString(),
          messageId: correction._id.toHexString(),
        })

      const tapped = await tap()
      expect(tapped.created).toBe(false)
      expect(tapped.card.back).toBe('Eve gittim')
      // A filled back is never asked for again.
      expect((await tap()).card.back).toBe('Eve gittim')
      expect(translate).toHaveBeenCalledTimes(1)

      const all = await cards()
      expect(all).toHaveLength(1)
      expect(all[0]?.back).toBe('Eve gittim')
      // The card spent its capture when it was made; the taps spent nothing.
      const ada = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: 'ada' })
      expect(ada?.quota.echoCaptures).toHaveLength(1)
    })

    it('fills the back from a translation the tap brings, without asking the provider', async () => {
      const { conversation, correction } = await corrected()
      await captureReceivedCorrection(handle.db, conversation, correction)

      const translate = vi.fn<TranslationProvider['translate']>()
      const tapped = await captureFromMessage(handle.db, { translation: { translate } }, 'ada', {
        conversationId: conversation._id.toHexString(),
        messageId: correction._id.toHexString(),
        translation: 'Eve gittim',
        translationLang: 'tr',
      })
      expect(tapped.card.back).toBe('Eve gittim')
      expect(translate).not.toHaveBeenCalled()
    })

    it('skips silently when the daily capture ceiling is full', async () => {
      const { conversation, correction } = await corrected()
      const limit = PLAN_LIMITS.free.echoCapturesPerDay
      if (limit === null) throw new Error('echoCapturesPerDay is expected to be a number')
      const recent = Array.from({ length: limit }, () => new Date())
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: 'ada' }, { $set: { 'quota.echoCaptures': recent } })

      await expect(captureReceivedCorrection(handle.db, conversation, correction)).resolves.toBe(
        'capped',
      )
      expect(await cards()).toHaveLength(0)
    })

    it('keeps nothing once the pair has blocked each other', async () => {
      const { conversation, correction } = await corrected()
      await handle.db
        .collection(COLLECTIONS.blocks)
        .insertOne({ blockerId: 'ada', blockedId: 'bo', createdAt: new Date() })

      expect(await captureReceivedCorrection(handle.db, conversation, correction)).toBe('skipped')
      expect(await cards()).toHaveLength(0)
    })

    it('never turns a capture it cannot make into an error', async () => {
      const { conversation, correction } = await corrected()
      // The corrected person is gone, so the capture refuses.
      await handle.db.collection<Profile>(COLLECTIONS.profiles).deleteOne({ _id: 'ada' })
      await expect(captureReceivedCorrection(handle.db, conversation, correction)).resolves.toBe(
        'skipped',
      )
      expect(await cards()).toHaveLength(0)
    })

    it('runs behind every correction sent, without the sender waiting for it', async () => {
      const { conversation, target } = await sentence()
      const sent = await sendCorrection(handle.db, 'bo', {
        conversationId: conversation._id.toHexString(),
        targetMessageId: target._id.toHexString(),
        corrected: 'I went home',
      })
      expect(sent.message.type).toBe('correction')

      await vi.waitFor(async () => {
        const all = await cards()
        expect(all.map((card) => [card.userId, card.sourceKey])).toEqual([
          ['ada', `msg:${sent.message._id.toHexString()}`],
        ])
      })
    })
  })
})
