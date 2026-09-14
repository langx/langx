import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { newCardSrs, SRS_RULES, TOKEN_RULES } from '@langx/shared'

const PASSWORD = 'correct horse battery staple'
const DB_NAME = 'langx_echo_test'

function onboardingBody(overrides: Record<string, unknown> = {}) {
  return {
    handle: `user${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Test User',
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    ...overrides,
  }
}

/**
 * Built with no translation key and no storage, which is the not-configured
 * path on purpose: no test here can reach a third party, and the degradation
 * the design document promises — a card with a front and no back — is what
 * every capture below actually exercises.
 */
describe('echo', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string, overrides: Record<string, unknown> = {}) {
    const user = await signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name: 'T' })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody(overrides),
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  /**
   * Two accounts, one after the other.
   *
   * Never in parallel: `signUpAndSignIn` reads the newest verification link
   * out of one shared outbox, so two sign-ups in flight at once each take the
   * other's token and both fail to verify.
   */
  async function newPair(prefix: string, overrides: Record<string, unknown> = {}) {
    const a = await newUser(`${prefix}-a@example.com`, overrides)
    const b = await newUser(`${prefix}-b@example.com`)
    return [a, b] as const
  }

  async function startConversation(
    from: SignedUpUser,
    toUserId: string,
    body = 'On y va demain ?',
  ) {
    const response = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { cookie: from.cookie },
      payload: { toUserId, body },
    })
    if (response.statusCode !== 201) {
      throw new Error(`conversation failed (${response.statusCode}): ${response.body}`)
    }
    return response.json<{ _id: string }>()
  }

  /** The opening message of a thread, which `POST /conversations` wrote. */
  async function firstMessageId(conversationId: string): Promise<string> {
    const message = await handle.db
      .collection(COLLECTIONS.messages)
      .findOne({ conversationId: new ObjectId(conversationId) }, { sort: { createdAt: 1 } })
    if (!message) throw new Error('no message in the seeded conversation')
    return message._id.toHexString()
  }

  function capture(user: SignedUpUser, source: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/echo/cards',
      headers: { cookie: user.cookie },
      payload: { source },
    })
  }

  function captureMessage(user: SignedUpUser, conversationId: string, messageId: string) {
    return capture(user, { kind: 'chat', conversationId, messageId })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), DB_NAME)

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: DB_NAME,
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })

    await ensureIndexes(handle.db)

    emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage: createStorageProvider(env),
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
    })
    await app.ready()

    for (let attempt = 1; attempt <= 5; attempt++) {
      const warmUp = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warmup-${attempt}@example.com`, password: PASSWORD, name: 'Warm Up' },
      })
      if (warmUp.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    emailSender.messages.length = 0
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('keeps one card however many times the same message is added', async () => {
    const [a, b] = await newPair('cap')
    const conversation = await startConversation(a, b.userId)
    const messageId = await firstMessageId(conversation._id)

    const first = await captureMessage(b, conversation._id, messageId)
    expect(first.statusCode).toBe(201)
    expect(first.json<{ created: boolean }>().created).toBe(true)

    const second = await captureMessage(b, conversation._id, messageId)
    // 200 and not 201: nothing was written, and the toast should say so
    // rather than claim a new card.
    expect(second.statusCode).toBe(200)
    expect(second.json<{ created: boolean }>().created).toBe(false)
    expect(second.json<{ card: { _id: string } }>().card._id).toBe(
      first.json<{ card: { _id: string } }>().card._id,
    )

    expect(
      await handle.db.collection(COLLECTIONS.echoCards).countDocuments({ userId: b.userId }),
    ).toBe(1)
  })

  it('files the card under the partner’s language and leaves the back empty with no provider', async () => {
    const [a, b] = await newPair('lang', { nativeLanguages: [{ code: 'fr' }] })
    const conversation = await startConversation(a, b.userId)
    const messageId = await firstMessageId(conversation._id)

    const response = await captureMessage(b, conversation._id, messageId)
    expect(response.statusCode).toBe(201)
    const { card } = response.json<{
      card: { lang: string; back: string; front: string; srs: { due: string } }
    }>()
    expect(card.lang).toBe('fr')
    expect(card.front).toBe('On y va demain ?')
    // Nothing configured to translate it, and the card still stands.
    expect(card.back).toBe('')
  })

  it('refuses a message from a conversation the person is not in', async () => {
    const [a, b] = await newPair('out')
    const stranger = await newUser('out-c@example.com')
    const conversation = await startConversation(a, b.userId)
    const messageId = await firstMessageId(conversation._id)

    const response = await captureMessage(stranger, conversation._id, messageId)
    expect(response.statusCode).toBe(404)
    expect(
      await handle.db.collection(COLLECTIONS.echoCards).countDocuments({ userId: stranger.userId }),
    ).toBe(0)
  })

  it('marks the message as echoed for the person who kept it, and for nobody else', async () => {
    const [a, b] = await newPair('mark')
    const conversation = await startConversation(a, b.userId)
    const messageId = await firstMessageId(conversation._id)
    await captureMessage(b, conversation._id, messageId)

    const page = async (user: SignedUpUser) =>
      (
        await app.inject({
          method: 'GET',
          url: `/conversations/${conversation._id}/messages`,
          headers: { cookie: user.cookie },
        })
      ).json<{ items: { _id: string; echoed?: boolean }[] }>()

    expect((await page(b)).items.find((m) => m._id === messageId)?.echoed).toBe(true)
    expect((await page(a)).items.find((m) => m._id === messageId)?.echoed).toBeUndefined()
  })

  it('puts a new card straight into the queue, because it is due the moment it is made', async () => {
    const [a, b] = await newPair('queue')
    const conversation = await startConversation(a, b.userId)
    await captureMessage(b, conversation._id, await firstMessageId(conversation._id))

    const response = await app.inject({
      method: 'GET',
      url: '/echo/queue',
      headers: { cookie: b.cookie },
    })
    expect(response.statusCode).toBe(200)
    const queue = response.json<{ cards: unknown[]; dueCount: number; sessionSize: number }>()
    expect(queue.cards).toHaveLength(1)
    expect(queue.dueCount).toBe(1)
    expect(queue.sessionSize).toBeGreaterThan(0)
  })

  it('advances a card once when the same batch is sent twice', async () => {
    const [a, b] = await newPair('rev')
    const conversation = await startConversation(a, b.userId)
    const captured = await captureMessage(
      b,
      conversation._id,
      await firstMessageId(conversation._id),
    )
    const cardId = captured.json<{ card: { _id: string } }>().card._id

    const batch = {
      reviews: [{ reviewId: 'r-deadbeef-1', cardId, grade: 'good', durationMs: 1200 }],
    }
    const send = () =>
      app.inject({
        method: 'POST',
        url: '/echo/reviews',
        headers: { cookie: b.cookie },
        payload: batch,
      })

    const first = await send()
    expect(first.statusCode).toBe(200)
    const applied = first.json<{
      results: { status: string; srs: { due: string; reps: number } }[]
    }>()
    expect(applied.results[0]?.status).toBe('applied')
    expect(applied.results[0]?.srs.reps).toBe(1)

    const second = await send()
    const repeated = second.json<{
      results: { status: string; srs: { due: string; reps: number } }[]
    }>()
    // The unique index decided, not the handler — and the answer carries the
    // card as it actually stands, so a retrying client converges.
    expect(repeated.results[0]?.status).toBe('duplicate')
    expect(repeated.results[0]?.srs.reps).toBe(1)
    expect(repeated.results[0]?.srs.due).toBe(applied.results[0]?.srs.due)

    expect(
      await handle.db.collection(COLLECTIONS.echoReviews).countDocuments({ userId: b.userId }),
    ).toBe(1)
  })

  it('keeps the good grades in a batch that also names a card that is gone', async () => {
    const [a, b] = await newPair('mix')
    const conversation = await startConversation(a, b.userId)
    const captured = await captureMessage(
      b,
      conversation._id,
      await firstMessageId(conversation._id),
    )
    const cardId = captured.json<{ card: { _id: string } }>().card._id

    const response = await app.inject({
      method: 'POST',
      url: '/echo/reviews',
      headers: { cookie: b.cookie },
      payload: {
        reviews: [
          {
            reviewId: 'r-mixed-gone',
            cardId: new ObjectId().toHexString(),
            grade: 'again',
            durationMs: 10,
          },
          { reviewId: 'r-mixed-bad-id', cardId: 'not-an-object-id', grade: 'good', durationMs: 10 },
          { reviewId: 'r-mixed-good', cardId, grade: 'easy', durationMs: 900 },
        ],
      },
    })
    expect(response.statusCode).toBe(200)
    const { results } = response.json<{ results: { status: string }[] }>()
    expect(results.map((r) => r.status)).toEqual(['missing', 'missing', 'applied'])
  })

  it('removes a card by its source key, which is all the chat screen knows', async () => {
    const [a, b] = await newPair('rm')
    const conversation = await startConversation(a, b.userId)
    const messageId = await firstMessageId(conversation._id)
    await captureMessage(b, conversation._id, messageId)

    const response = await app.inject({
      method: 'DELETE',
      url: `/echo/cards/${encodeURIComponent(`msg:${messageId}`)}`,
      headers: { cookie: b.cookie },
    })
    expect(response.statusCode).toBe(204)
    expect(
      await handle.db.collection(COLLECTIONS.echoCards).countDocuments({ userId: b.userId }),
    ).toBe(0)
  })

  it('will not let one person delete another’s card', async () => {
    const [a, b] = await newPair('own')
    const conversation = await startConversation(a, b.userId)
    const captured = await captureMessage(
      b,
      conversation._id,
      await firstMessageId(conversation._id),
    )
    const cardId = captured.json<{ card: { _id: string } }>().card._id

    await app.inject({
      method: 'DELETE',
      url: `/echo/cards/${cardId}`,
      headers: { cookie: a.cookie },
    })
    expect(
      await handle.db.collection(COLLECTIONS.echoCards).countDocuments({ userId: b.userId }),
    ).toBe(1)
  })

  it('edits the two lines of a card without touching its schedule', async () => {
    const [a, b] = await newPair('edit')
    const conversation = await startConversation(a, b.userId)
    const captured = await captureMessage(
      b,
      conversation._id,
      await firstMessageId(conversation._id),
    )
    const card = captured.json<{ card: { _id: string; srs: { due: string } } }>().card

    const response = await app.inject({
      method: 'PATCH',
      url: `/echo/cards/${card._id}`,
      headers: { cookie: b.cookie },
      payload: { front: 'On y va demain.', back: 'Yarın gidiyoruz.' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      _id: card._id,
      front: 'On y va demain.',
      back: 'Yarın gidiyoruz.',
      // The source still points at the message the sentence came from, and the
      // interval the card earned is the card's, not the wording's.
      source: { kind: 'chat' },
      srs: { due: card.srs.due },
    })
  })

  it('will not let one person edit another’s card', async () => {
    const [a, b] = await newPair('edit-own')
    const conversation = await startConversation(a, b.userId)
    const captured = await captureMessage(
      b,
      conversation._id,
      await firstMessageId(conversation._id),
    )
    const cardId = captured.json<{ card: { _id: string; front: string } }>().card._id

    const response = await app.inject({
      method: 'PATCH',
      url: `/echo/cards/${cardId}`,
      headers: { cookie: a.cookie },
      payload: { front: 'mine now', back: '' },
    })
    expect(response.statusCode).toBe(404)
    expect(
      await handle.db
        .collection(COLLECTIONS.echoCards)
        .countDocuments({ userId: b.userId, front: 'mine now' }),
    ).toBe(0)
  })

  it('counts the cards by language on the summary', async () => {
    const [a, b] = await newPair('sum', { nativeLanguages: [{ code: 'fr' }] })
    const conversation = await startConversation(a, b.userId)
    await captureMessage(b, conversation._id, await firstMessageId(conversation._id))

    const response = await app.inject({
      method: 'GET',
      url: '/echo/summary',
      headers: { cookie: b.cookie },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      due: 1,
      total: 1,
      languages: [{ lang: 'fr', total: 1, due: 1 }],
    })
  })

  it('counts the week on the summary as a rolling seven days', async () => {
    const [a, b] = await newPair('week')
    const conversation = await startConversation(a, b.userId)
    const captured = await captureMessage(
      b,
      conversation._id,
      await firstMessageId(conversation._id),
    )
    const cardId = captured.json<{ card: { _id: string } }>().card._id

    // Three grades on the one card, then two of them moved back: the counts
    // are read off the ledger rather than off the card, so the same card
    // carrying all three is what the week actually sums.
    await app.inject({
      method: 'POST',
      url: '/echo/reviews',
      headers: { cookie: b.cookie },
      payload: {
        reviews: [
          { reviewId: 'r-week-now', cardId, grade: 'good', durationMs: 900 },
          { reviewId: 'r-week-inside', cardId, grade: 'good', durationMs: 900 },
          { reviewId: 'r-week-outside', cardId, grade: 'good', durationMs: 900 },
        ],
      },
    })

    const reviews = handle.db.collection(COLLECTIONS.echoReviews)
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    await reviews.updateOne(
      { userId: b.userId, reviewId: 'r-week-inside' },
      {
        $set: { at: daysAgo(3) },
      },
    )
    await reviews.updateOne(
      { userId: b.userId, reviewId: 'r-week-outside' },
      {
        $set: { at: daysAgo(8) },
      },
    )

    const response = await app.inject({
      method: 'GET',
      url: '/echo/summary',
      headers: { cookie: b.cookie },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ reviewedToday: 1, reviewedThisWeek: 2 })
  })

  it('refuses a message type with no sentence on it', async () => {
    const [a, b] = await newPair('type')
    const conversation = await startConversation(a, b.userId)

    const sticker = await handle.db.collection(COLLECTIONS.messages).insertOne({
      conversationId: new ObjectId(conversation._id),
      senderId: a.userId,
      type: 'sticker',
      body: '',
      sticker: { packId: 'p', stickerId: 's' },
      createdAt: new Date(),
    })

    const response = await captureMessage(b, conversation._id, sticker.insertedId.toHexString())
    expect(response.statusCode).toBe(400)
  })

  it('keeps the corrected sentence from a post, not the one that needed correcting', async () => {
    const author = await newUser('post-author@example.com', { nativeLanguages: [{ code: 'tr' }] })
    const teacher = await newUser('post-teacher@example.com')

    const created = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { cookie: author.cookie },
      payload: { body: 'I go to the beach yesterday.', language: 'en' },
    })
    expect(created.statusCode).toBe(201)
    const postId = created.json<{ _id: string }>()._id

    await app.inject({
      method: 'POST',
      url: `/posts/${postId}/corrections`,
      headers: { cookie: teacher.cookie },
      payload: { corrected: 'I went to the beach yesterday.' },
    })

    const response = await capture(author, { kind: 'post', postId })
    expect(response.statusCode).toBe(201)
    const { card } = response.json<{
      card: { front: string; lang: string; source: { kind: string } }
    }>()
    // The version that is right is the version worth learning.
    expect(card.front).toBe('I went to the beach yesterday.')
    expect(card.lang).toBe('en')
    expect(card.source.kind).toBe('post')
  })

  it('refuses a post a moderator has hidden', async () => {
    const author = await newUser('hidden-author@example.com')
    const created = await app.inject({
      method: 'POST',
      url: '/posts',
      headers: { cookie: author.cookie },
      payload: { body: 'Something that was taken down.', language: 'en' },
    })
    const postId = created.json<{ _id: string }>()._id
    await handle.db
      .collection(COLLECTIONS.posts)
      .updateOne({ _id: new ObjectId(postId) }, { $set: { hiddenAt: new Date() } })

    expect((await capture(author, { kind: 'post', postId })).statusCode).toBe(404)
  })

  /**
   * A session pays once and fills the streak square once. Written as a route
   * test rather than a unit one because the thing worth asserting is that the
   * ledger, the streak and the review rows agree after a *resubmitted* batch —
   * which is exactly where a handler that remembered what it had paid would
   * get it wrong.
   */
  describe('what a completed session pays', () => {
    /** `sessionSize` cards, straight into the collection: intake is not the subject here. */
    async function giveCards(userId: string, count: number): Promise<string[]> {
      const now = new Date()
      const docs = Array.from({ length: count }, (_, index) => ({
        _id: new ObjectId(),
        userId,
        lang: 'fr',
        front: `phrase ${index}`,
        back: `meaning ${index}`,
        source: { kind: 'pack' as const, packId: 'fr:test', itemId: `fr:test#${index}` },
        sourceKey: `pack:fr:test#${index}`,
        srs: newCardSrs(now),
        createdAt: now,
      }))
      await handle.db.collection(COLLECTIONS.echoCards).insertMany(docs)
      return docs.map((doc) => doc._id.toHexString())
    }

    const grade = (user: SignedUpUser, reviews: unknown[]) =>
      app.inject({
        method: 'POST',
        url: '/echo/reviews',
        headers: { cookie: user.cookie },
        payload: { reviews },
      })

    const balanceOf = async (userId: string) =>
      (
        await handle.db
          .collection(COLLECTIONS.tokenLedger)
          .aggregate<{ total: number }>([
            { $match: { userId, kind: 'echo' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ])
          .toArray()
      )[0]?.total ?? 0

    it('pays nothing for a part of a session', async () => {
      const user = await newUser('pay-part@example.com')
      const cards = await giveCards(user.userId, SRS_RULES.sessionSize - 1)
      const response = await grade(
        user,
        cards.map((cardId, index) => ({
          reviewId: `rv-part-${index}-0000`,
          cardId,
          grade: 'good',
          durationMs: 900,
        })),
      )
      expect(response.statusCode).toBe(200)
      expect(await balanceOf(user.userId)).toBe(0)
    })

    it('pays once for a session, and not again when the batch is resent', async () => {
      const user = await newUser('pay-full@example.com')
      const cards = await giveCards(user.userId, SRS_RULES.sessionSize)
      const reviews = cards.map((cardId, index) => ({
        reviewId: `rv-full-${index}-0000`,
        cardId,
        grade: 'good',
        durationMs: 900,
      }))

      const first = await grade(user, reviews)
      expect(first.statusCode).toBe(200)
      expect(await balanceOf(user.userId)).toBe(TOKEN_RULES.award.echoSession)

      // The network dropped and the app retried. The ledger decides, twice.
      await grade(user, reviews)
      expect(await balanceOf(user.userId)).toBe(TOKEN_RULES.award.echoSession)
      expect(
        await handle.db.collection(COLLECTIONS.echoReviews).countDocuments({ userId: user.userId }),
      ).toBe(SRS_RULES.sessionSize)
    })

    it('fills the streak square, and leaves the daily pool alone', async () => {
      const user = await newUser('pay-streak@example.com')
      const cards = await giveCards(user.userId, SRS_RULES.sessionSize)
      await grade(
        user,
        cards.map((cardId, index) => ({
          reviewId: `rv-streak-${index}-0000`,
          cardId,
          grade: 'good',
          durationMs: 900,
        })),
      )

      const profile = await handle.db
        .collection<{ streak?: { current: number } }>(COLLECTIONS.profiles)
        .findOne({ _id: user.userId as never })
      expect(profile?.streak?.current).toBe(1)

      // Outside the pool, deliberately: `dailyActivity` is the pool's input and
      // a solitary action must not dilute the people it exists to reward.
      expect(
        await handle.db
          .collection(COLLECTIONS.dailyActivity)
          .countDocuments({ userId: user.userId }),
      ).toBe(0)
    })
  })

  it('mirrors a saved phrase into its author’s cards', async () => {
    const [a, b] = await newPair('ph')
    const conversation = await startConversation(a, b.userId)

    const { sendPhrase } = await import('../modules/chat/messages')
    await sendPhrase(handle.db, a.userId, {
      conversationId: conversation._id,
      term: 'quand même',
      meaning: 'all the same',
      lang: 'fr',
    })

    const cards = await handle.db
      .collection(COLLECTIONS.echoCards)
      .find({ userId: a.userId })
      .toArray()
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ front: 'quand même', back: 'all the same', lang: 'fr' })
    expect(cards[0]?.sourceKey).toMatch(/^phrase:/)
    // The person who did not save it gets nothing; it was not their act.
    expect(
      await handle.db.collection(COLLECTIONS.echoCards).countDocuments({ userId: b.userId }),
    ).toBe(0)
  })

  /**
   * A card asks the feed how its sentence is said, and the answer comes back
   * to the card in one tap. Route tests rather than unit ones: the whole point
   * is a link between two modules that otherwise know nothing about each other.
   */
  describe('asking the feed, and keeping the answer', () => {
    const take = (name: string) => ({
      url: `https://cdn.example.com/posts/u/${name}.m4a`,
      contentType: 'audio/m4a',
      sizeBytes: 4096,
      durationSeconds: 3,
    })

    async function askPost(user: SignedUpUser, body = 'squirrel') {
      const created = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { cookie: user.cookie },
        payload: { body, language: 'en', kind: 'pronunciation' },
      })
      expect(created.statusCode, created.body).toBe(201)
      return created.json<{ _id: string }>()._id
    }

    /**
     * An answer written straight into the collection.
     *
     * `POST /posts/:id/answers` would refuse every URL above: this suite
     * builds the app with no storage configured, on purpose, so no attachment
     * can point into "our own bucket". What is under test here is what happens
     * to an answer once it exists, not how it came to.
     */
    async function answerWith(author: SignedUpUser, postId: string, fast = 'fast', slow?: string) {
      const _id = new ObjectId()
      await handle.db.collection(COLLECTIONS.pronunciationAnswers).insertOne({
        _id,
        postId: new ObjectId(postId),
        authorId: author.userId,
        media: take(fast),
        ...(slow ? { slowMedia: take(slow) } : {}),
        createdAt: new Date(),
      })
      return _id.toHexString()
    }

    /** A card from something the partner wrote, which is the ordinary case. */
    async function makeCard(owner: SignedUpUser, partner: SignedUpUser, body: string) {
      const conversation = await startConversation(partner, owner.userId, body)
      const created = await captureMessage(
        owner,
        conversation._id,
        await firstMessageId(conversation._id),
      )
      expect(created.statusCode, created.body).toBe(201)
      return created.json<{ card: { _id: string } }>().card._id
    }

    function link(user: SignedUpUser, cardId: string, postId: string) {
      return app.inject({
        method: 'POST',
        url: `/echo/cards/${cardId}/ask`,
        headers: { cookie: user.cookie },
        payload: { postId },
      })
    }

    function attach(user: SignedUpUser, cardId: string, answerId: string) {
      return app.inject({
        method: 'POST',
        url: `/echo/cards/${cardId}/audio`,
        headers: { cookie: user.cookie },
        payload: { answerId },
      })
    }

    function forPost(user: SignedUpUser, postId: string) {
      return app.inject({
        method: 'GET',
        url: `/echo/cards/for-post/${postId}`,
        headers: { cookie: user.cookie },
      })
    }

    it('answers with nothing when no card asked the post', async () => {
      const asker = await newUser('ask-none@example.com')
      const response = await forPost(asker, await askPost(asker))
      expect(response.statusCode).toBe(200)
      expect(response.json()).toBeNull()
    })

    it('links a card to the post it asked, and finds it again by the post', async () => {
      const [asker, friend] = await newPair('ask-link')
      const cardId = await makeCard(asker, friend, 'squirrel')
      const postId = await askPost(asker)

      expect((await link(asker, cardId, postId)).statusCode).toBe(200)
      expect((await forPost(asker, postId)).json<{ _id: string }>()._id).toBe(cardId)
      // Somebody else's cards are not consulted, whoever wrote the post.
      expect((await forPost(friend, postId)).json()).toBeNull()
    })

    it('refuses to link a post somebody else wrote', async () => {
      const [asker, other] = await newPair('ask-theirs')
      const cardId = await makeCard(asker, other, 'squirrel')

      expect((await link(asker, cardId, await askPost(other))).statusCode).toBe(404)
    })

    /*
     * Asking again from a second card moves the link rather than colliding on
     * `owner_asked_post_unique`. The first card keeps whatever recording it
     * had and simply stops offering the button.
     */
    it('moves the link when a second card asks the same post', async () => {
      const [asker, friend] = await newPair('ask-move')
      const first = await makeCard(asker, friend, 'squirrel')
      const postId = await askPost(asker)
      const second = (await capture(asker, { kind: 'post', postId })).json<{
        card: { _id: string }
      }>().card._id

      expect((await link(asker, first, postId)).statusCode).toBe(200)
      expect((await link(asker, second, postId)).statusCode).toBe(200)
      expect((await forPost(asker, postId)).json<{ _id: string }>()._id).toBe(second)
    })

    it('keeps an answer\u2019s recording, both takes and the speaker\u2019s name', async () => {
      const [asker, friend] = await newPair('ask-keep')
      const cardId = await makeCard(asker, friend, 'squirrel')
      const postId = await askPost(asker)
      await link(asker, cardId, postId)
      const answerId = await answerWith(friend, postId, 'fast', 'slow')

      const response = await attach(asker, cardId, answerId)
      expect(response.statusCode, response.body).toBe(200)
      const { audio } = response.json<{
        audio?: { url: string; slowUrl?: string; origin: string; speakerName?: string }
      }>()
      expect(audio?.url).toContain('fast.m4a')
      expect(audio?.slowUrl).toContain('slow.m4a')
      expect(audio?.origin).toBe('post')
      expect(audio?.speakerName).toBe('Test User')
    })

    /* The reason to tap this twice is that the first voice was hard to follow. */
    it('replaces a recording the card already had', async () => {
      const [asker, first] = await newPair('ask-replace')
      const second = await newUser('ask-replace-c@example.com')
      const cardId = await makeCard(asker, first, 'squirrel')
      const postId = await askPost(asker)
      await link(asker, cardId, postId)

      await attach(asker, cardId, await answerWith(first, postId, 'first'))
      const later = await answerWith(second, postId, 'second')

      const response = await attach(asker, cardId, later)
      expect(response.statusCode, response.body).toBe(200)
      expect(response.json<{ audio: { url: string } }>().audio.url).toContain('second.m4a')
    })

    /*
     * `answer.postId === card.askedPostId` is the whole authorisation story for
     * the attach, so this is the test holding it up: without the check, any
     * answer anywhere could be pointed at any of your cards.
     */
    it('refuses an answer written on a different post', async () => {
      const [asker, friend] = await newPair('ask-elsewhere')
      const cardId = await makeCard(asker, friend, 'squirrel')
      await link(asker, cardId, await askPost(asker))

      const elsewhere = await askPost(friend, 'thorough')
      const answerId = await answerWith(asker, elsewhere)

      expect((await attach(asker, cardId, answerId)).statusCode).toBe(404)
    })

    it('refuses to attach to a card that never asked anything', async () => {
      const [asker, friend] = await newPair('ask-unlinked')
      const cardId = await makeCard(asker, friend, 'squirrel')
      const answerId = await answerWith(friend, await askPost(asker))

      expect((await attach(asker, cardId, answerId)).statusCode).toBe(404)
    })
  })
})
