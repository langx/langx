import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { TranslationProvider } from '../../translation/TranslationProvider'
import type { Conversation, Message } from '../chat/conversations'
import type { Profile } from '../profiles/profiles'
import { backForReader, captureFromMessage, updateCard, type CaptureDeps } from './cards'
import type { EchoCardDoc } from './documents'

/** Ada reads Turkish and learns English; Bo is an English native. */
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

const TURKISH = "Bona'ya dc'den mesaj atayım"
const ENGLISH = "I'll send Bona a message on Discord"

/**
 * A provider that behaves like the real one: a sentence asked into the
 * language it is already in comes back as itself. Anything in `table` is a
 * real translation, keyed `<targetLang>:<text>`.
 */
function fakeTranslator(table: Record<string, string>) {
  const translate = vi.fn<TranslationProvider['translate']>(({ text, targetLang }) =>
    Promise.resolve({ translatedText: table[`${targetLang}:${text}`] ?? text, sourceLang: 'tr' }),
  )
  const deps: CaptureDeps = { translation: { translate } }
  return { deps, translate }
}

describe('a card kept from a sentence in the reader’s own language', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_echo_native_back_test')
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
      COLLECTIONS.echoCards,
      COLLECTIONS.translationCache,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  async function seed(ada: Partial<Profile>, bo: Partial<Profile> = {}) {
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .insertMany([
        person('ada', ada),
        person('bo', { nativeLanguages: [{ code: 'en' }], learning: [], ...bo }),
      ])
  }

  /** One message in a thread between Ada and Bo, written straight in. */
  async function message(body: string, senderId = 'ada'): Promise<Message> {
    const now = new Date()
    const conversation: Conversation = {
      _id: new ObjectId(),
      pairKey: 'ada:bo',
      participants: ['ada', 'bo'],
      lastMessage: { body, senderId, createdAt: now },
      unread: {},
      firstMessageBy: senderId,
      firstMessageAt: now,
      bothSpoke: true,
      messageCount: 1,
      messageCountBy: { ada: 1, bo: 0 },
      createdAt: now,
      updatedAt: now,
    }
    await handle.db.collection<Conversation>(COLLECTIONS.conversations).insertOne(conversation)
    const sent: Message = {
      _id: new ObjectId(),
      conversationId: conversation._id,
      senderId,
      type: 'text',
      body,
      createdAt: now,
    }
    await handle.db.collection<Message>(COLLECTIONS.messages).insertOne(sent)
    return sent
  }

  function keep(deps: CaptureDeps, sent: Message) {
    return captureFromMessage(handle.db, deps, 'ada', {
      conversationId: sent.conversationId.toHexString(),
      messageId: sent._id.toHexString(),
    })
  }

  async function stored(): Promise<EchoCardDoc | null> {
    return await handle.db.collection<EchoCardDoc>(COLLECTIONS.echoCards).findOne({})
  }

  it('puts the sentence in the language being learned on the back, and says so', async () => {
    await seed({})
    const { deps } = fakeTranslator({ [`en:${TURKISH}`]: ENGLISH })
    const { card } = await keep(deps, await message(TURKISH))

    expect(card.front).toBe(TURKISH)
    expect(card.back).toBe(ENGLISH)
    expect(card.backLang).toBe('en')
    // Her own message, in a chat with an English native: filed as Turkish,
    // which the guess from Bo's native language would have got wrong.
    expect(card.lang).toBe('tr')
  })

  it('leaves an ordinary card as it was: a meaning, in the reader’s own language', async () => {
    await seed({})
    const { deps, translate } = fakeTranslator({ 'tr:See you tomorrow': 'Yarın görüşürüz' })
    const { card } = await keep(deps, await message('See you tomorrow', 'bo'))

    expect(card.back).toBe('Yarın görüşürüz')
    expect(card.backLang).toBeUndefined()
    expect(card.lang).toBe('en')
    expect(translate).toHaveBeenCalledTimes(1)
  })

  it('learns into the language the partner speaks natively, before the first one learned', async () => {
    await seed({
      learning: [
        { code: 'de', level: 'beginner', priority: 1 },
        { code: 'en', level: 'intermediate', priority: 2 },
      ],
    })
    const { deps } = fakeTranslator({
      [`en:${TURKISH}`]: ENGLISH,
      [`de:${TURKISH}`]: 'Auf Deutsch',
    })
    expect((await keep(deps, await message(TURKISH))).card.backLang).toBe('en')
  })

  it('falls back to the first language learned when the partner speaks none of them', async () => {
    await seed(
      {
        learning: [
          { code: 'de', level: 'beginner', priority: 1 },
          { code: 'en', level: 'intermediate', priority: 2 },
        ],
      },
      { nativeLanguages: [{ code: 'ja' }] },
    )
    const { deps } = fakeTranslator({
      [`en:${TURKISH}`]: ENGLISH,
      [`de:${TURKISH}`]: 'Auf Deutsch',
    })
    const { card } = await keep(deps, await message(TURKISH))
    expect(card.back).toBe('Auf Deutsch')
    expect(card.backLang).toBe('de')
  })

  describe('keeps the empty back', () => {
    it('for somebody learning nothing', async () => {
      await seed({ learning: [] })
      const { deps, translate } = fakeTranslator({ [`en:${TURKISH}`]: ENGLISH })
      const { card } = await keep(deps, await message(TURKISH))
      expect(card.back).toBe('')
      expect(card.backLang).toBeUndefined()
      // The partner's guess stands: nothing proved otherwise.
      expect(card.lang).toBe('en')
      expect(translate).toHaveBeenCalledTimes(1)
    })

    it('when the translation into the language being learned fails', async () => {
      await seed({})
      const translate = vi
        .fn<TranslationProvider['translate']>()
        .mockResolvedValueOnce({ translatedText: TURKISH, sourceLang: 'tr' })
        .mockRejectedValueOnce(new Error('provider down'))
      const { card } = await keep({ translation: { translate } }, await message(TURKISH))
      expect(card.back).toBe('')
      expect(card.backLang).toBeUndefined()
    })

    it('when that translation is the sentence yet again', async () => {
      await seed({})
      const { deps, translate } = fakeTranslator({})
      const { card } = await keep(deps, await message('Bona!'))
      expect(card.back).toBe('')
      expect(card.backLang).toBeUndefined()
      expect(translate).toHaveBeenCalledTimes(2)
    })

    it('without asking again when the first translation failed', async () => {
      await seed({})
      const translate = vi.fn<TranslationProvider['translate']>().mockRejectedValue(new Error('x'))
      const { card } = await keep({ translation: { translate } }, await message(TURKISH))
      expect(card.back).toBe('')
      // An empty answer says nothing about which language the sentence is in.
      expect(translate).toHaveBeenCalledTimes(1)
    })
  })

  it('fills a card an older capture left empty, direction and all, on the next tap', async () => {
    await seed({})
    const sent = await message(TURKISH)
    const failing = vi.fn<TranslationProvider['translate']>().mockRejectedValue(new Error('x'))
    expect((await keep({ translation: { translate: failing } }, sent)).card.back).toBe('')

    const { deps } = fakeTranslator({ [`en:${TURKISH}`]: ENGLISH })
    const tapped = await keep(deps, sent)
    expect(tapped.created).toBe(false)
    expect(tapped.card).toMatchObject({ back: ENGLISH, backLang: 'en', lang: 'tr' })
    expect(await stored()).toMatchObject({ back: ENGLISH, backLang: 'en', lang: 'tr' })
  })

  it('takes off readings in the old language when a fill moves the card', async () => {
    await seed({})
    const sent = await message(TURKISH)
    const failing = vi.fn<TranslationProvider['translate']>().mockRejectedValue(new Error('x'))
    await keep({ translation: { translate: failing } }, sent)
    // Filed under Bo's English and read aloud by an English voice.
    await handle.db
      .collection<EchoCardDoc>(COLLECTIONS.echoCards)
      .updateOne({}, { $set: { voices: [{ url: 'https://x/en.mp3', voice: 'af_heart' }] } })

    const { deps } = fakeTranslator({ [`en:${TURKISH}`]: ENGLISH })
    const tapped = await keep(deps, sent)
    expect(tapped.card.lang).toBe('tr')
    expect(tapped.card.voices).toBeUndefined()
  })

  it('skips a learned language no machine can write', async () => {
    await seed({
      learning: [
        { code: 'ase', level: 'beginner', priority: 1 },
        { code: 'en', level: 'intermediate', priority: 2 },
      ],
    })
    const { deps } = fakeTranslator({ [`en:${TURKISH}`]: ENGLISH })
    expect((await keep(deps, await message(TURKISH))).card.backLang).toBe('en')
  })

  it('clears backLang when the owner empties the back', async () => {
    await seed({})
    const { deps } = fakeTranslator({ [`en:${TURKISH}`]: ENGLISH })
    const { card } = await keep(deps, await message(TURKISH))
    const edited = await updateCard(handle.db, 'ada', card._id, { front: card.front, back: '' })
    expect(edited.back).toBe('')
    expect(edited.backLang).toBeUndefined()
  })

  it('is what the backfill computes for a card it reads', async () => {
    await seed({})
    const { deps } = fakeTranslator({ [`en:${TURKISH}`]: ENGLISH })
    const ada = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: 'ada' })
    if (!ada) throw new Error('ada missing')
    expect(await backForReader(handle.db, deps, ada, [{ code: 'en' }], TURKISH)).toEqual({
      back: ENGLISH,
      backLang: 'en',
      lang: 'tr',
    })
  })
})
