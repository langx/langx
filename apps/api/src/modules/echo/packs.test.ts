import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { COLLECTIONS } from '../../db/collections'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { ensureIndexes } from '../../db/indexes'
import type { Profile } from '../profiles/profiles'
import type { EchoCardDoc } from './documents'
import {
  listPacks,
  packItemId,
  previewPack,
  startPack,
  type EchoPackDoc,
  type EchoPackItemDoc,
} from './packs'

/**
 * The two things the Chinese packs added to a module that did not know a pack
 * could have a second name or a reading: HSK 3 and HSK 4 share `intermediate`
 * and must still list in order, and the pinyin on an item has to reach the
 * card and the preview, since nothing else on a Chinese card says how it is
 * read.
 */
describe('Chinese packs', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  const userId = 'learner'

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_echo_packs_test')
    await ensureIndexes(handle.db)

    const now = new Date()
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: userId,
      displayName: 'Learner',
      birthDate: '1990-06-15',
      gender: 'undisclosed',
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'zh', level: 'intermediate', priority: 1 }],
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

    // Inserted out of order on purpose: the list has to put them right.
    const packs: EchoPackDoc[] = [4, 1, 3].map((hsk) => ({
      _id: `zh:hsk${hsk}`,
      lang: 'zh',
      level: hsk === 1 ? 'absoluteBeginner' : 'intermediate',
      hsk: hsk as 1 | 3 | 4,
      itemCount: 1,
      contentVersion: 1,
      glossLocales: ['en', 'tr'],
      updatedAt: now,
    }))
    await handle.db.collection<EchoPackDoc>(COLLECTIONS.echoPacks).insertMany(packs)
    await handle.db.collection<EchoPackItemDoc>(COLLECTIONS.echoPackItems).insertOne({
      _id: packItemId('zh:hsk1', 0),
      packId: 'zh:hsk1',
      index: 0,
      kind: 'phrase',
      text: '我是学生。',
      reading: 'Wǒ shì xuésheng.',
      gloss: { en: 'I am a student.', tr: 'Ben öğrenciyim.' },
      contentVersion: 1,
    })
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  it('lists HSK packs in HSK order, though two of them share a level', async () => {
    const { items } = await listPacks(handle.db, userId)
    expect(items.map((pack) => [pack._id, pack.hsk])).toEqual([
      ['zh:hsk1', 1],
      ['zh:hsk3', 3],
      ['zh:hsk4', 4],
    ])
  })

  it('shows the pinyin in the preview', async () => {
    const preview = await previewPack(handle.db, userId, 'zh:hsk1', { limit: 10 }, 'en')
    expect(preview.items).toEqual([
      { index: 0, text: '我是学生。', reading: 'Wǒ shì xuésheng.', back: 'Ben öğrenciyim.' },
    ])
  })

  it('copies the pinyin onto the card', async () => {
    const result = await startPack(handle.db, userId, { packId: 'zh:hsk1', count: 10 }, 'en')
    expect(result.started).toBe(1)
    const card = await handle.db.collection<EchoCardDoc>(COLLECTIONS.echoCards).findOne({ userId })
    expect(card).toMatchObject({ front: '我是学生。', reading: 'Wǒ shì xuésheng.' })
  })
})

/**
 * The same two things for Japanese, with one difference: JLPT counts down.
 * N5 is the first pack and N3 and N2 share `intermediate`, so the tiebreak
 * runs the other way from HSK's — and the kana reading has to reach the card
 * the way pinyin does.
 */
describe('Japanese packs', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  const userId = 'learner-ja'

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_echo_packs_ja_test')
    await ensureIndexes(handle.db)

    const now = new Date()
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: userId,
      displayName: 'Learner',
      birthDate: '1990-06-15',
      gender: 'undisclosed',
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'ja', level: 'beginner', priority: 1 }],
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

    // Out of order on purpose, N2 before N3 in particular: same level.
    const levels = { 2: 'intermediate', 5: 'absoluteBeginner', 3: 'intermediate', 4: 'beginner' }
    const packs: EchoPackDoc[] = Object.entries(levels).map(([jlpt, level]) => ({
      _id: `ja:jlptN${jlpt}`,
      lang: 'ja',
      level,
      jlpt: Number(jlpt) as 2 | 3 | 4 | 5,
      itemCount: 1,
      contentVersion: 1,
      glossLocales: ['en', 'tr'],
      updatedAt: now,
    }))
    await handle.db.collection<EchoPackDoc>(COLLECTIONS.echoPacks).insertMany(packs)
    await handle.db.collection<EchoPackItemDoc>(COLLECTIONS.echoPackItems).insertOne({
      _id: packItemId('ja:jlptN5', 0),
      packId: 'ja:jlptN5',
      index: 0,
      kind: 'phrase',
      text: '私は学生です。',
      reading: 'わたしは がくせいです。',
      gloss: { en: 'I am a student.', tr: 'Ben öğrenciyim.' },
      contentVersion: 1,
    })
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  it('lists JLPT packs from N5 down, though N3 and N2 share a level', async () => {
    const { items } = await listPacks(handle.db, userId)
    expect(items.map((pack) => [pack._id, pack.jlpt])).toEqual([
      ['ja:jlptN5', 5],
      ['ja:jlptN4', 4],
      ['ja:jlptN3', 3],
      ['ja:jlptN2', 2],
    ])
  })

  it('shows the kana in the preview', async () => {
    const preview = await previewPack(handle.db, userId, 'ja:jlptN5', { limit: 10 }, 'en')
    expect(preview.items).toEqual([
      {
        index: 0,
        text: '私は学生です。',
        reading: 'わたしは がくせいです。',
        back: 'Ben öğrenciyim.',
      },
    ])
  })

  it('copies the kana onto the card', async () => {
    const result = await startPack(handle.db, userId, { packId: 'ja:jlptN5', count: 10 }, 'en')
    expect(result.started).toBe(1)
    const card = await handle.db.collection<EchoCardDoc>(COLLECTIONS.echoCards).findOne({ userId })
    expect(card).toMatchObject({ front: '私は学生です。', reading: 'わたしは がくせいです。' })
  })
})
