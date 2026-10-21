import { BADGE_CALL_MIN_SECONDS, isV3BadgeKind } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import {
  countEchoReviews,
  countLanguagesPractised,
  countLongCalls,
  countPeopleHelped,
  countTestimonialsAbout,
} from './badgeCounts'
import { getBadgeSummary, getPublicBadges } from './badges'

describe('the v3 badge counts', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'badge_counts_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of Object.values(COLLECTIONS)) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  const id = () => new ObjectId().toHexString()

  async function profile(userId: string, extra: Record<string, unknown> = {}) {
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(0, 8)}`,
      streak: { current: 0, longest: 0 },
      stats: {},
      nativeLanguages: [{ code: 'es' }],
      createdAt: new Date(),
      ...extra,
    } as never)
  }

  async function conversation(a: string, b: string): Promise<ObjectId> {
    const _id = new ObjectId()
    await handle.db
      .collection(COLLECTIONS.conversations)
      .insertOne({ _id, participants: [a, b], pairKey: [a, b].sort().join(':') })
    return _id
  }

  async function call(conversationId: ObjectId, callerId: string, seconds: number) {
    await handle.db.collection(COLLECTIONS.messages).insertOne({
      conversationId,
      senderId: callerId,
      type: 'call',
      body: '',
      call: {
        callId: new ObjectId(),
        media: 'audio',
        outcome: 'completed',
        durationSeconds: seconds,
      },
      createdAt: new Date(),
    })
  }

  it('counts Echo reviews, whatever the grade', async () => {
    const me = id()
    await handle.db.collection(COLLECTIONS.echoReviews).insertMany(
      ['again', 'good', 'easy'].map((grade, i) => ({
        userId: me,
        reviewId: `r${i}`,
        cardId: new ObjectId(),
        grade,
        at: new Date(),
        durationMs: 1000,
      })),
    )
    expect(await countEchoReviews(handle.db, me)).toBe(3)
  })

  it('counts kind words, hidden by the owner or not, but not ones a moderator took down', async () => {
    const me = id()
    const base = { subjectId: me, conversationId: new ObjectId(), body: 'x', createdAt: new Date() }
    await handle.db.collection(COLLECTIONS.testimonials).insertMany([
      { ...base, authorId: id() },
      { ...base, authorId: id(), ownerHiddenAt: new Date() },
      { ...base, authorId: id(), moderatorHiddenAt: new Date() },
    ])
    expect(await countTestimonialsAbout(handle.db, me)).toBe(2)
  })

  it('counts calls of five minutes or more, placed or answered', async () => {
    const me = id()
    const anna = id()
    const pavel = id()
    const withAnna = await conversation(me, anna)
    const withPavel = await conversation(pavel, me)
    await call(withAnna, me, BADGE_CALL_MIN_SECONDS)
    await call(withAnna, anna, BADGE_CALL_MIN_SECONDS + 60)
    await call(withPavel, pavel, BADGE_CALL_MIN_SECONDS - 1)
    // Somebody else's call in a thread that is not mine.
    await call(await conversation(anna, pavel), anna, 3600)
    expect(await countLongCalls(handle.db, me)).toBe(2)
  })

  it('counts different people corrected, once each and never yourself', async () => {
    const me = id()
    const anna = id()
    const pavel = id()
    const olga = id()
    const posts = handle.db.collection(COLLECTIONS.posts)
    const annaPost = new ObjectId()
    const annaPost2 = new ObjectId()
    const myPost = new ObjectId()
    const olgaRequest = new ObjectId()
    await posts.insertMany([
      { _id: annaPost, authorId: anna, language: 'en', createdAt: new Date() },
      { _id: annaPost2, authorId: anna, language: 'en', createdAt: new Date() },
      { _id: myPost, authorId: me, language: 'en', createdAt: new Date() },
      { _id: olgaRequest, authorId: olga, language: 'en', createdAt: new Date() },
    ])
    await handle.db.collection(COLLECTIONS.postCorrections).insertMany(
      [annaPost, annaPost2, myPost].map((postId) => ({
        postId,
        authorId: me,
        corrected: 'x',
        createdAt: new Date(),
      })),
    )
    await handle.db
      .collection(COLLECTIONS.pronunciationAnswers)
      .insertOne({ postId: olgaRequest, authorId: me, createdAt: new Date() })
    const withPavel = await conversation(me, pavel)
    await handle.db.collection(COLLECTIONS.messages).insertMany([
      { conversationId: withPavel, senderId: me, type: 'correction', createdAt: new Date() },
      { conversationId: withPavel, senderId: me, type: 'correction', createdAt: new Date() },
    ])
    expect(await countPeopleHelped(handle.db, me)).toBe(3)
  })

  it('counts languages practised besides the native ones', async () => {
    const me = id()
    await handle.db.collection(COLLECTIONS.echoCards).insertMany([
      { userId: me, lang: 'en', srs: { reps: 2 } },
      { userId: me, lang: 'fr', srs: { reps: 0 } },
      { userId: me, lang: 'ES', srs: { reps: 1 } },
    ])
    await handle.db.collection(COLLECTIONS.posts).insertMany([
      { authorId: me, language: 'de' },
      { authorId: me, language: 'en' },
    ])
    // en and de: fr was never reviewed, and Spanish is native.
    expect(await countLanguagesPractised(handle.db, me, ['es'])).toBe(2)
  })

  describe('in the summary', () => {
    it('sends the v3 kinds only to a caller that asks for them', async () => {
      const me = id()
      await profile(me, { stats: { openersAnsweredWithinDay: 12 } })

      const classic = await getBadgeSummary(handle.db, me)
      expect(classic.badges.some((badge) => isV3BadgeKind(badge.kind))).toBe(false)
      expect(classic.progress).not.toHaveProperty('openers')
      expect((await getPublicBadges(handle.db, me)).total).toBe(classic.badges.length)

      const v3 = await getBadgeSummary(handle.db, me, new Date(), 'v3')
      expect(v3.badges.length).toBe(classic.badges.length + 18)
      expect(v3.progress?.openers).toBe(12)
      expect(v3.badges.find((badge) => badge.id === 'openers.10')?.earned).toBe(true)
      expect(v3.badges.find((badge) => badge.id === 'openers.50')?.earned).toBe(false)
    })

    it('never pays for a v3 badge, even as the nearest one', async () => {
      const me = id()
      await profile(me, { stats: { openersAnsweredWithinDay: 49 } })
      const v3 = await getBadgeSummary(handle.db, me, new Date(), 'v3')
      expect(v3.next?.id).toBe('openers.50')
      expect(v3.next?.reward).toBe(0)
    })

    it('reads the same twice: a badge earned is derived, never written', async () => {
      const me = id()
      await profile(me, { stats: { openersAnsweredWithinDay: 10 } })
      const first = await getBadgeSummary(handle.db, me, new Date(), 'v3')
      const second = await getBadgeSummary(handle.db, me, new Date(), 'v3')
      expect(second.earnedCount).toBe(first.earnedCount)
      expect(await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments({})).toBe(0)
    })
  })
})
