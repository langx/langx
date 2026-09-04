import { MAX_ATTACHMENTS, MAX_VIDEO_SECONDS, TOKEN_RULES } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { Profile } from '../modules/profiles/profiles'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

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

describe('community feed', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender

  async function newUser(email: string, profileOverrides: Record<string, unknown> = {}) {
    const user = await signUpAndSignIn(app, emailSender, { email, password: PASSWORD, name: 'T' })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody(profileOverrides),
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  async function post(user: SignedUpUser, body: string, language = 'en') {
    return app.inject({
      method: 'POST',
      url: '/posts',
      headers: { cookie: user.cookie },
      payload: { body, language },
    })
  }

  async function correct(user: SignedUpUser, postId: string, corrected: string) {
    return app.inject({
      method: 'POST',
      url: `/posts/${postId}/corrections`,
      headers: { cookie: user.cookie },
      payload: { corrected },
    })
  }

  async function feed(user: SignedUpUser, qs = '') {
    return app.inject({
      method: 'GET',
      url: `/feed${qs ? `?${qs}` : ''}`,
      headers: { cookie: user.cookie },
    })
  }

  /** The front of the feed is who you have talked to, so tests need someone. */
  async function talkTo(user: SignedUpUser, toUserId: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { cookie: user.cookie },
      payload: { toUserId, body: 'Hello there.' },
    })
    if (response.statusCode !== 201) {
      throw new Error(`conversation failed (${response.statusCode}): ${response.body}`)
    }
  }

  async function corrections(user: SignedUpUser, postId: string, qs = '') {
    return app.inject({
      method: 'GET',
      url: `/posts/${postId}/corrections${qs ? `?${qs}` : ''}`,
      headers: { cookie: user.cookie },
    })
  }

  async function ask(user: SignedUpUser, body: string, language = 'en') {
    return app.inject({
      method: 'POST',
      url: '/posts',
      headers: { cookie: user.cookie },
      payload: { body, language, kind: 'pronunciation' },
    })
  }

  const take = (name: string) => ({
    url: `https://cdn.example.com/posts/u/${name}.m4a`,
    contentType: 'audio/m4a',
    sizeBytes: 4096,
    durationSeconds: 3,
  })

  async function answer(
    user: SignedUpUser,
    postId: string,
    payload: Record<string, unknown> = { media: take('fast') },
  ) {
    return app.inject({
      method: 'POST',
      url: `/posts/${postId}/answers`,
      headers: { cookie: user.cookie },
      payload,
    })
  }

  async function answers(user: SignedUpUser, postId: string, qs = '') {
    return app.inject({
      method: 'GET',
      url: `/posts/${postId}/answers${qs ? `?${qs}` : ''}`,
      headers: { cookie: user.cookie },
    })
  }

  async function comment(user: SignedUpUser, postId: string, body: string) {
    return app.inject({
      method: 'POST',
      url: `/posts/${postId}/comments`,
      headers: { cookie: user.cookie },
      payload: { body },
    })
  }

  async function comments(user: SignedUpUser, postId: string, qs = '') {
    return app.inject({
      method: 'GET',
      url: `/posts/${postId}/comments${qs ? `?${qs}` : ''}`,
      headers: { cookie: user.cookie },
    })
  }

  function ledgerRows(userId: string, kind?: string) {
    return handle.db
      .collection(COLLECTIONS.tokenLedger)
      .countDocuments({ userId, ...(kind ? { kind } : {}) })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_feed_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_feed_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
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

    // Same first-transaction warm-up as the other route suites.
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

  it('rejects an unauthenticated request', async () => {
    expect((await app.inject({ method: 'GET', url: '/feed' })).statusCode).toBe(401)
  })

  it('refuses a post in a language the author is not learning', async () => {
    const author = await newUser('wronglang@example.com')
    // Turkish is their native language, so a post in it is not a request for
    // help — it is just talking.
    const response = await post(author, 'Merhaba', 'tr')
    expect(response.statusCode).toBe(400)
  })

  it('returns a new post with no corrections', async () => {
    const author = await newUser('newpost@example.com')
    const created = await post(author, 'I go to the beach yesterday.')
    expect(created.statusCode).toBe(201)

    const page = await feed(author)
    expect(page.statusCode).toBe(200)
    const body = page.json<{
      items: { _id: string; correctionCount: number; level: string | null }[]
    }>()
    const mine = body.items.find((item) => item._id === created.json<{ _id: string }>()._id)
    expect(mine?.correctionCount).toBe(0)
    // Resolved from the author's `learning`, not stored on the post.
    expect(mine?.level).toBe('intermediate')
  })

  it('pays a correction through the same award as a chat correction', async () => {
    const author = await newUser('paid-author@example.com')
    const helper = await newUser('paid-helper@example.com')
    const postId = (await post(author, 'She go to school every day.')).json<{ _id: string }>()._id

    const response = await correct(helper, postId, 'She goes to school every day.')
    expect(response.statusCode).toBe(201)

    const row = await handle.db
      .collection(COLLECTIONS.tokenLedger)
      .findOne({ userId: helper.userId, kind: 'correction' })
    expect(row?.amount).toBe(TOKEN_RULES.award.correction)
  })

  it('refuses to let someone correct their own post', async () => {
    const author = await newUser('selfcorrect@example.com')
    const postId = (await post(author, 'I am go home.')).json<{ _id: string }>()._id
    expect((await correct(author, postId, 'I am going home.')).statusCode).toBe(400)
  })

  it('refuses a second correction from the same person', async () => {
    const author = await newUser('dupe-author@example.com')
    const helper = await newUser('dupe-helper@example.com')
    const postId = (await post(author, 'He have a car.')).json<{ _id: string }>()._id

    expect((await correct(helper, postId, 'He has a car.')).statusCode).toBe(201)
    // The unique index is what refuses it, not a prior read — two taps that
    // raced would both pass a check-then-insert and both pay.
    expect((await correct(helper, postId, 'He has a car!')).statusCode).toBe(400)
  })

  it('puts uncorrected posts before corrected ones', async () => {
    const author = await newUser('order-author@example.com')
    const helper = await newUser('order-helper@example.com')

    const older = (await post(author, 'The first sentence is wrong.')).json<{ _id: string }>()._id
    const newer = (await post(author, 'The second sentence is wrong.')).json<{ _id: string }>()._id
    await correct(helper, newer, 'The second sentence is fine.')

    const items = (await feed(helper)).json<{ items: { _id: string }[] }>().items
    // `newer` is more recent, so plain recency would put it first. The queue
    // exists so an unanswered post does not sink under every newer one.
    expect(items.findIndex((i) => i._id === older)).toBeLessThan(
      items.findIndex((i) => i._id === newer),
    )
  })

  it('shows the first correction as the top one, and marks the viewer as having corrected', async () => {
    const author = await newUser('top-author@example.com')
    const first = await newUser('top-first@example.com')
    const second = await newUser('top-second@example.com')
    const postId = (await post(author, 'They was late.')).json<{ _id: string }>()._id

    await correct(first, postId, 'They were late.')
    await correct(second, postId, 'They were running late.')

    const page = await feed(first)
    const item = page
      .json<{
        items: {
          _id: string
          correctionCount: number
          correctedByViewer: boolean
          topCorrection: { corrected: string } | null
        }[]
      }>()
      .items.find((i) => i._id === postId)

    expect(item?.correctionCount).toBe(2)
    // Oldest, not newest: whoever answered first is the one who answered.
    expect(item?.topCorrection?.corrected).toBe('They were late.')
    expect(item?.correctedByViewer).toBe(true)
  })

  it('returns one correction per post however many it has', async () => {
    const author = await newUser('many-author@example.com')
    const helpers = []
    for (let i = 0; i < 4; i++) helpers.push(await newUser(`many-helper-${i}@example.com`))
    const postId = (await post(author, 'I has been there.')).json<{ _id: string }>()._id

    for (const [i, helper] of helpers.entries()) {
      await correct(helper, postId, `I have been there. (${i})`)
    }

    const item = (await feed(helpers[0]!))
      .json<{
        items: {
          _id: string
          correctionCount: number
          topCorrection: { corrected: string } | null
        }[]
      }>()
      .items.find((i) => i._id === postId)

    // The count is the denormalized field; the payload carries exactly one
    // correction regardless, which is what stops a popular post making every
    // page that includes it transfer its whole answer list.
    expect(item?.correctionCount).toBe(4)
    expect(item?.topCorrection?.corrected).toBe('I have been there. (0)')
  })

  it('hides posts by someone the viewer has blocked, in both directions', async () => {
    const viewer = await newUser('block-viewer@example.com')
    const blocked = await newUser('block-author@example.com')
    const postId = (await post(blocked, 'This should not be visible.')).json<{ _id: string }>()._id

    await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { cookie: viewer.cookie },
      payload: { userId: blocked.userId },
    })

    const items = (await feed(viewer)).json<{ items: { _id: string }[] }>().items
    expect(items.some((item) => item._id === postId)).toBe(false)
  })
  it('puts the people you follow first, even when their post is already corrected', async () => {
    // Following outranks the queue: a friend's answered sentence still comes
    // before a stranger's unanswered one. Within each half the queue order
    // holds, which is what keeps the front from turning into a recency feed.
    const viewer = await newUser('front-viewer@example.com')
    const friend = await newUser('front-friend@example.com')
    const stranger = await newUser('front-stranger@example.com')
    const helper = await newUser('front-helper@example.com')
    await talkTo(viewer, friend.userId)

    const friendCorrected = (await post(friend, 'A friend, corrected.')).json<{ _id: string }>()._id
    const friendOpen = (await post(friend, 'A friend, waiting.')).json<{ _id: string }>()._id
    const strangerOpen = (await post(stranger, 'A stranger, waiting.')).json<{ _id: string }>()._id
    await correct(helper, friendCorrected, 'A friend, corrected indeed.')

    const items = (await feed(viewer, 'limit=50')).json<{ items: { _id: string }[] }>().items
    const at = (id: string) => items.findIndex((i) => i._id === id)
    expect(at(friendOpen)).toBe(0)
    expect(at(friendCorrected)).toBe(1)
    expect(at(strangerOpen)).toBeGreaterThan(1)
  })

  it('pages across the boundary between the people you follow and everybody else', async () => {
    // Two queries stitched into one list. The cursor has to say which half it
    // stopped in, or page two starts the first half again; and a page that
    // ends exactly on the boundary still has to know there is a page two.
    const viewer = await newUser('boundary-viewer@example.com')
    const friend = await newUser('boundary-friend@example.com')
    const stranger = await newUser('boundary-stranger@example.com')
    await talkTo(viewer, friend.userId)

    const friendIds: string[] = []
    for (let i = 0; i < 2; i++) {
      friendIds.push((await post(friend, `Friend sentence ${i}.`)).json<{ _id: string }>()._id)
    }
    const strangerIds: string[] = []
    for (let i = 0; i < 3; i++) {
      strangerIds.push(
        (await post(stranger, `Stranger sentence ${i}.`)).json<{ _id: string }>()._id,
      )
    }

    type Page = { items: { _id: string }[]; nextCursor: string | null }
    async function walk(firstLimit: number): Promise<{ first: Page; all: string[] }> {
      const first = (await feed(viewer, `limit=${firstLimit}`)).json<Page>()
      const all = first.items.map((i) => i._id)
      let cursor = first.nextCursor
      while (cursor) {
        const next = await feed(viewer, `limit=50&cursor=${encodeURIComponent(cursor)}`)
        expect(next.statusCode).toBe(200)
        const page = next.json<Page>()
        all.push(...page.items.map((i) => i._id))
        cursor = page.nextCursor
      }
      return { first, all }
    }

    // A page that ends exactly where the friend's posts do.
    const exact = await walk(2)
    expect(exact.first.items.map((i) => i._id)).toEqual(expect.arrayContaining(friendIds))
    expect(exact.first.items).toHaveLength(2)
    expect(exact.first.nextCursor).not.toBeNull()

    // A page that runs out of friend and is topped up with everybody else.
    const stitched = await walk(3)
    expect(stitched.first.items).toHaveLength(3)
    expect(friendIds).toContain(stitched.first.items[0]!._id)
    expect(friendIds).toContain(stitched.first.items[1]!._id)
    expect(friendIds).not.toContain(stitched.first.items[2]!._id)

    for (const { all } of [exact, stitched]) {
      expect(new Set(all).size).toBe(all.length)
      for (const id of [...friendIds, ...strangerIds]) expect(all).toContain(id)
      const lastFriend = Math.max(...friendIds.map((id) => all.indexOf(id)))
      const firstStranger = Math.min(...strangerIds.map((id) => all.indexOf(id)))
      expect(lastFriend).toBeLessThan(firstStranger)
    }
  })

  it('puts both the people you follow and the people you have talked to first', async () => {
    // The front of the feed is a union, not a replacement. Dropping the
    // conversation stand-in would have emptied it for every existing user on
    // the day the Follow button shipped.
    const viewer = await newUser('union-viewer@example.com')
    const followed = await newUser('union-followed@example.com')
    const partner = await newUser('union-partner@example.com')
    const both = await newUser('union-both@example.com')
    const stranger = await newUser('union-stranger@example.com')

    await app.inject({
      method: 'POST',
      url: `/profiles/${followed.userId}/follow`,
      headers: { cookie: viewer.cookie },
    })
    await talkTo(viewer, partner.userId)
    await app.inject({
      method: 'POST',
      url: `/profiles/${both.userId}/follow`,
      headers: { cookie: viewer.cookie },
    })
    await talkTo(viewer, both.userId)

    const ids = {
      followed: (await post(followed, 'From someone I follow.')).json<{ _id: string }>()._id,
      partner: (await post(partner, 'From someone I talked to.')).json<{ _id: string }>()._id,
      both: (await post(both, 'From someone who is both.')).json<{ _id: string }>()._id,
      stranger: (await post(stranger, 'From a stranger.')).json<{ _id: string }>()._id,
    }

    const items = (await feed(viewer, 'limit=50')).json<{ items: { _id: string }[] }>().items
    const seen = items.map((item) => item._id)

    expect(seen.slice(0, 3)).toEqual(expect.arrayContaining([ids.followed, ids.partner, ids.both]))
    // The stranger is still in the feed — just behind everybody you know.
    expect(seen.indexOf(ids.stranger)).toBeGreaterThan(2)
    // Being both is not being twice.
    expect(seen.filter((id) => id === ids.both)).toHaveLength(1)
  })

  it("counts a frozen user's correction even though it pays nothing", async () => {
    // Freezing stops the payout only. The lifetime count used to read ledger
    // rows, and a zero-amount award writes none — so a frozen user's
    // corrections tile and their correction badges sat at 0 forever.
    const author = await newUser('frozen-author@example.com')
    const corrector = await newUser('frozen-corrector@example.com')
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: corrector.userId }, { $set: { tokenFrozenAt: new Date() } })

    const postId = (await post(author, 'I has been there.')).json<{ _id: string }>()._id
    expect((await correct(corrector, postId, 'I have been there.')).statusCode).toBe(201)

    const summary = await app.inject({
      method: 'GET',
      url: '/me/tokens',
      headers: { cookie: corrector.cookie },
    })
    expect(summary.statusCode).toBe(200)
    expect(summary.json<{ lifetime: { corrections: number } }>().lifetime.corrections).toBe(1)

    // And it is still counting the act, not an award: the freeze means no
    // `correction` row was ever written. That gap is the whole bug.
    const paid = await handle.db
      .collection(COLLECTIONS.tokenLedger)
      .countDocuments({ userId: corrector.userId, kind: 'correction' })
    expect(paid).toBe(0)
  })

  it('counts a recording as teaching, alongside written corrections', async () => {
    // Reading a sentence out loud for somebody who cannot say it is the same
    // act in a different medium, and it pays the same ten tokens. It used to
    // leave the profile's number untouched, so an account that mostly answered
    // pronunciation requests looked like it had never helped anyone.
    const asker = await newUser('recording-asker@example.com')
    const helper = await newUser('recording-helper@example.com')

    const askId = (await ask(asker, 'squirrel')).json<{ _id: string }>()._id
    expect((await answer(helper, askId)).statusCode).toBe(201)

    const lifetime = async (user: SignedUpUser) => {
      const summary = await app.inject({
        method: 'GET',
        url: '/me/tokens',
        headers: { cookie: user.cookie },
      })
      expect(summary.statusCode).toBe(200)
      return summary.json<{ lifetime: { corrections: number } }>().lifetime.corrections
    }

    expect(await lifetime(helper)).toBe(1)

    // The two sources add up rather than replacing each other.
    const postId = (await post(asker, 'I has been there.')).json<{ _id: string }>()._id
    expect((await correct(helper, postId, 'I have been there.')).statusCode).toBe(201)
    expect(await lifetime(helper)).toBe(2)

    // Asking is not teaching. Only the person who recorded gets the number.
    expect(await lifetime(asker)).toBe(0)

    // Put the request back where it was found: the pronunciation section is
    // small enough that another test asserts its exact contents.
    const removed = await app.inject({
      method: 'DELETE',
      url: `/posts/${askId}`,
      headers: { cookie: asker.cookie },
    })
    expect(removed.statusCode).toBe(204)
  })

  it("pages a post's corrections oldest first, and carries the post", async () => {
    const author = await newUser('detail-author@example.com')
    const viewer = await newUser('detail-viewer@example.com')
    const postId = (await post(author, 'I has three friend.')).json<{ _id: string }>()._id

    for (let i = 0; i < 3; i++) {
      const helper = await newUser(`detail-helper-${i}@example.com`)
      expect((await correct(helper, postId, `I have three friends. (${i})`)).statusCode).toBe(201)
    }

    const first = await corrections(viewer, postId, 'limit=2')
    expect(first.statusCode).toBe(200)
    const page1 = first.json<{
      post: { _id: string; correctionCount: number }
      items: { corrected: string }[]
      nextCursor: string | null
    }>()

    // One round trip: the sentence being corrected comes back with the
    // corrections of it.
    expect(page1.post._id).toBe(postId)
    expect(page1.post.correctionCount).toBe(3)
    expect(page1.items.map((item) => item.corrected)).toEqual([
      'I have three friends. (0)',
      'I have three friends. (1)',
    ])
    expect(page1.nextCursor).not.toBeNull()

    const page2 = (
      await corrections(viewer, postId, `limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`)
    ).json<{ items: { corrected: string }[]; nextCursor: string | null }>()
    expect(page2.items.map((item) => item.corrected)).toEqual(['I have three friends. (2)'])
    expect(page2.nextCursor).toBeNull()
  })

  it("hides a blocked author's corrections, and the whole post if they wrote it", async () => {
    // This route took no viewer at all before anything called it, so it applied
    // no block filter — the one place in the app where a block was one-way.
    const author = await newUser('detail-block-author@example.com')
    const viewer = await newUser('detail-block-viewer@example.com')
    const rude = await newUser('detail-block-rude@example.com')
    const fine = await newUser('detail-block-fine@example.com')

    const postId = (await post(author, 'I goed home.')).json<{ _id: string }>()._id
    await correct(rude, postId, 'I went home. (rude)')
    await correct(fine, postId, 'I went home. (fine)')

    const block = (blocker: SignedUpUser, userId: string) =>
      app.inject({
        method: 'POST',
        url: '/blocks',
        headers: { cookie: blocker.cookie },
        payload: { userId },
      })

    await block(viewer, rude.userId)
    const visible = (await corrections(viewer, postId)).json<{ items: { corrected: string }[] }>()
    expect(visible.items.map((item) => item.corrected)).toEqual(['I went home. (fine)'])

    // Blocking the post's author makes the thread absent, not forbidden.
    await block(viewer, author.userId)
    expect((await corrections(viewer, postId)).statusCode).toBe(404)
  })
  describe('attachments', () => {
    const image = {
      url: 'https://cdn.example.com/posts/u/1.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      width: 800,
      height: 600,
    }

    const video = {
      url: 'https://cdn.example.com/posts/u/1.mp4',
      contentType: 'video/mp4',
      sizeBytes: 4 * 1024 * 1024,
      durationSeconds: 30,
      width: 1280,
      height: 720,
    }

    /** The one-attachment body an installed build still sends. */
    function postWithMedia(user: SignedUpUser, body: string, media: unknown) {
      return app.inject({
        method: 'POST',
        url: '/posts',
        headers: { cookie: user.cookie },
        payload: { body, language: 'en', media },
      })
    }

    function postWithAttachments(user: SignedUpUser, body: string, attachments: unknown[]) {
      return app.inject({
        method: 'POST',
        url: '/posts',
        headers: { cookie: user.cookie },
        payload: { body, language: 'en', attachments },
      })
    }

    it('carries an attachment back on the feed', async () => {
      const author = await newUser('media-author@example.com')
      const response = await postWithMedia(author, 'Is this handwriting right?', image)
      expect(response.statusCode).toBe(201)

      const item = (await feed(author))
        .json<{
          items: { _id: string; media?: { url: string; width?: number } }[]
        }>()
        .items.find((i) => i._id === response.json<{ _id: string }>()._id)
      expect(item?.media?.url).toBe(image.url)
      expect(item?.media?.width).toBe(800)
    })

    it('accepts a voice note on a correction', async () => {
      const author = await newUser('media-post-author@example.com')
      const helper = await newUser('media-corrector@example.com')
      const postId = (await post(author, 'I has said it wrong.')).json<{ _id: string }>()._id

      const response = await app.inject({
        method: 'POST',
        url: `/posts/${postId}/corrections`,
        headers: { cookie: helper.cookie },
        payload: {
          corrected: 'I said it wrong.',
          media: {
            url: 'https://cdn.example.com/posts/u/1.m4a',
            contentType: 'audio/m4a',
            sizeBytes: 4096,
            durationSeconds: 6,
          },
        },
      })
      expect(response.statusCode).toBe(201)
      expect(response.json<{ media?: { durationSeconds?: number } }>().media?.durationSeconds).toBe(
        6,
      )
    })

    it("refuses an attachment pointing at somebody else's host", async () => {
      // The check that matters most: a foreign URL would survive the account
      // purge, because we could never delete it.
      const author = await newUser('media-foreign@example.com')
      const response = await postWithMedia(author, 'Look at this.', {
        ...image,
        url: 'https://evil.example.net/a.jpg',
      })
      expect(response.statusCode).toBe(400)
    })

    it('refuses an oversized attachment', async () => {
      const author = await newUser('media-huge@example.com')
      const response = await postWithMedia(author, 'A very large photo.', {
        ...image,
        sizeBytes: 32 * 1024 * 1024,
      })
      // 413 rather than the 400 this used to be: now that video raises the
      // schema's outer bound to its own ceiling, 32MB is a well-formed number
      // that is simply too large for an image, and the per-kind check is what
      // says so.
      expect(response.statusCode).toBe(413)
      expect(response.json<{ code: string }>().code).toBe('MEDIA_TOO_LARGE')
    })

    it('refuses a content type we do not serve', async () => {
      const author = await newUser('media-type@example.com')
      const response = await postWithMedia(author, 'A document.', {
        ...image,
        contentType: 'application/pdf',
        url: 'https://cdn.example.com/posts/u/1.pdf',
      })
      expect(response.statusCode).toBe(415)
      expect(response.json()).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' })
    })

    it('charges nothing for an attachment on a post either', async () => {
      // The same bucket chat uses, and it is empty on every tier now — see
      // `PLAN_LIMITS.mediaPer24h`. Kept rather than deleted so a limit coming
      // back has to come back through a failing test.
      const author = await newUser('media-quota@example.com')

      await post(author, 'A sentence with nothing attached.')
      await postWithMedia(author, 'A sentence with a photo.', image)

      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: author.userId })
      expect(profile?.quota.media ?? []).toHaveLength(0)
    })

    it('carries a gallery back on the feed', async () => {
      const author = await newUser('media-gallery@example.com')
      const response = await postWithAttachments(author, 'Which of these is right?', [
        image,
        { ...image, url: 'https://cdn.example.com/posts/u/2.jpg' },
        video,
      ])
      expect(response.statusCode).toBe(201)
      const body = response.json<{ attachments?: unknown[]; media?: { url: string } }>()
      expect(body.attachments).toHaveLength(3)
      // Repeated as `media` so a build that predates the list shows the first.
      expect(body.media?.url).toBe(image.url)
    })

    it('still accepts the one-attachment body an installed build sends', async () => {
      const author = await newUser('media-legacy@example.com')
      const response = await postWithMedia(author, 'One photo, old client.', image)
      expect(response.statusCode).toBe(201)
      expect(response.json<{ attachments?: unknown[] }>().attachments).toHaveLength(1)
    })

    it('accepts a video on a post', async () => {
      const author = await newUser('media-video@example.com')
      const response = await postWithMedia(author, 'Am I saying this right?', video)
      expect(response.statusCode).toBe(201)
      expect(response.json<{ media?: { contentType: string } }>().media?.contentType).toBe(
        'video/mp4',
      )
    })

    it('accepts a video on a correction', async () => {
      const author = await newUser('media-video-post@example.com')
      const helper = await newUser('media-video-corrector@example.com')
      const postId = (await post(author, 'I has said it wrong.')).json<{ _id: string }>()._id

      const response = await app.inject({
        method: 'POST',
        url: `/posts/${postId}/corrections`,
        headers: { cookie: helper.cookie },
        payload: { corrected: 'I said it wrong.', attachments: [video] },
      })
      expect(response.statusCode).toBe(201)
      expect(response.json<{ attachments?: unknown[] }>().attachments).toHaveLength(1)
    })

    it('refuses a video longer than the ceiling', async () => {
      const author = await newUser('media-long@example.com')
      const response = await postWithMedia(author, 'A whole film.', {
        ...video,
        durationSeconds: MAX_VIDEO_SECONDS + 1,
      })
      expect(response.statusCode).toBe(413)
      expect(response.json<{ code: string }>().code).toBe('MEDIA_TOO_LONG')
    })

    it('refuses more attachments than one post may carry', async () => {
      const author = await newUser('media-toomany@example.com')
      const response = await postWithAttachments(
        author,
        'Every photo I own.',
        Array.from({ length: MAX_ATTACHMENTS + 1 }, () => image),
      )
      expect(response.statusCode).toBe(400)
    })

    it('takes a gallery without charging for it', async () => {
      // The per-file byte ceiling is the only thing bounding storage now.
      const author = await newUser('media-gallery-quota@example.com')
      const response = await postWithAttachments(author, 'Three of them.', [
        image,
        { ...image, url: 'https://cdn.example.com/posts/u/2.jpg' },
        { ...image, url: 'https://cdn.example.com/posts/u/3.jpg' },
      ])
      expect(response.statusCode).toBe(201)
      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: author.userId })
      expect(profile?.quota.media ?? []).toHaveLength(0)
    })

    it('signs an upload URL only for a type we serve', async () => {
      const author = await newUser('media-sign@example.com')
      const bad = await app.inject({
        method: 'POST',
        url: '/posts/upload-url',
        headers: { cookie: author.cookie },
        payload: { kind: 'image', contentType: 'application/pdf' },
      })
      expect(bad.statusCode).toBe(415)
      expect(bad.json()).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' })

      const webm = await app.inject({
        method: 'POST',
        url: '/posts/upload-url',
        headers: { cookie: author.cookie },
        payload: { kind: 'video', contentType: 'video/webm' },
      })
      expect(webm.statusCode).toBe(415)
    })
  })

  describe('post kind', () => {
    it('treats a post written before kinds existed as a correction post', async () => {
      // Written straight into the collection, because the API cannot produce a
      // post with no `kind` any more — and this is the exact shape every post
      // on disk has. It is the only test that proves the `$in: [..., null]`
      // reader, which is the difference between the main feed working and the
      // main feed being empty.
      const author = await newUser('legacy-kind-author@example.com')
      const reader = await newUser('legacy-kind-reader@example.com')
      const _id = new ObjectId()
      await handle.db.collection(COLLECTIONS.posts).insertOne({
        _id,
        authorId: author.userId,
        body: 'A sentence from before the sections.',
        language: 'en',
        correctionCount: 0,
        createdAt: new Date(),
      })

      const onCorrection = (await feed(reader, 'kind=correction')).json<{
        items: { _id: string; kind: string }[]
      }>().items
      const onPronunciation = (await feed(reader, 'kind=pronunciation')).json<{
        items: { _id: string }[]
      }>().items

      expect(onCorrection.find((i) => i._id === _id.toHexString())?.kind).toBe('correction')
      expect(onPronunciation.some((i) => i._id === _id.toHexString())).toBe(false)
    })

    it('keeps the two sections apart', async () => {
      const author = await newUser('sections-author@example.com')
      const reader = await newUser('sections-reader@example.com')
      const askId = (await ask(author, 'schadenfreude')).json<{ _id: string }>()._id
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id

      const corrections = (await feed(reader, 'kind=correction')).json<{
        items: { _id: string }[]
      }>().items
      const pronunciation = (await feed(reader, 'kind=pronunciation')).json<{
        items: { _id: string }[]
      }>().items

      expect(corrections.map((i) => i._id)).toContain(postId)
      expect(corrections.map((i) => i._id)).not.toContain(askId)
      expect(pronunciation.map((i) => i._id)).toEqual([askId])
    })

    it('refuses a correction on a pronunciation request', async () => {
      const author = await newUser('wrongkind-asker@example.com')
      const helper = await newUser('wrongkind-corrector@example.com')
      const askId = (await ask(author, 'squirrel')).json<{ _id: string }>()._id
      expect((await correct(helper, askId, 'squirrel')).statusCode).toBe(400)
    })

    it('refuses a recording on a correction post', async () => {
      const author = await newUser('wrongkind-poster@example.com')
      const helper = await newUser('wrongkind-answerer@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id
      expect((await answer(helper, postId)).statusCode).toBe(400)
    })
  })

  describe('comments', () => {
    it('counts a comment on the card and lists it on the post', async () => {
      const author = await newUser('comment-author@example.com')
      const reader = await newUser('comment-reader@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id

      expect((await comment(reader, postId, 'Nearly!')).statusCode).toBe(201)

      const card = (await feed(reader))
        .json<{ items: { _id: string; commentCount: number }[] }>()
        .items.find((i) => i._id === postId)
      expect(card?.commentCount).toBe(1)

      const listed = (await comments(reader, postId)).json<{ items: { body: string }[] }>().items
      expect(listed.map((c) => c.body)).toEqual(['Nearly!'])
    })

    it('lets the same person comment twice', async () => {
      // The deliberate absence of a unique index, pinned. Every other
      // child-of-post collection has one, so this is the test that stops
      // somebody adding a fourth by symmetry.
      const author = await newUser('comment-twice-author@example.com')
      const reader = await newUser('comment-twice-reader@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id

      expect((await comment(reader, postId, 'One.')).statusCode).toBe(201)
      expect((await comment(reader, postId, 'Two.')).statusCode).toBe(201)

      const card = (await feed(reader))
        .json<{ items: { _id: string; commentCount: number }[] }>()
        .items.find((i) => i._id === postId)
      expect(card?.commentCount).toBe(2)
    })

    it('pays nothing, and does not advance the streak', async () => {
      const author = await newUser('comment-pay-author@example.com')
      const reader = await newUser('comment-pay-reader@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id

      const before = await ledgerRows(reader.userId)
      const profileBefore = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: reader.userId })

      await comment(reader, postId, 'Nice one.')

      expect(await ledgerRows(reader.userId)).toBe(before)
      const profileAfter = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: reader.userId })
      expect(profileAfter?.streak?.lastQualifiedDay).toBe(profileBefore?.streak?.lastQualifiedDay)
    })

    it('lets you comment on your own post, unlike correcting it', async () => {
      const author = await newUser('comment-own@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id
      expect((await comment(author, postId, 'Actually I meant have.')).statusCode).toBe(201)
      expect((await correct(author, postId, 'I have a pen.')).statusCode).toBe(400)
    })

    it("pages a post's comments oldest first", async () => {
      const author = await newUser('comment-page-author@example.com')
      const reader = await newUser('comment-page-reader@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id
      for (const body of ['One.', 'Two.', 'Three.']) await comment(reader, postId, body)

      const first = (await comments(reader, postId, 'limit=2')).json<{
        items: { body: string }[]
        nextCursor: string | null
      }>()
      expect(first.items.map((c) => c.body)).toEqual(['One.', 'Two.'])
      expect(first.nextCursor).not.toBeNull()

      const second = (
        await comments(reader, postId, `limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`)
      ).json<{ items: { body: string }[] }>()
      expect(second.items.map((c) => c.body)).toEqual(['Three.'])
    })

    it('is not a likeable target', async () => {
      const author = await newUser('comment-like-author@example.com')
      const reader = await newUser('comment-like-reader@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id
      const commentId = (await comment(reader, postId, 'Nice.')).json<{ _id: string }>()._id

      const response = await app.inject({
        method: 'PUT',
        url: '/likes',
        headers: { cookie: author.cookie },
        payload: { targetType: 'comment', targetId: commentId },
      })
      // Rejected by the enum, before anything looks the id up.
      expect(response.statusCode).toBe(400)
    })
  })

  describe('pronunciation', () => {
    it('pays a recorded answer under its own kind, keyed on the request', async () => {
      const asker = await newUser('pron-asker@example.com')
      const helper = await newUser('pron-helper@example.com')
      const askId = (await ask(asker, 'thoroughly')).json<{ _id: string }>()._id

      expect((await answer(helper, askId)).statusCode).toBe(201)

      const row = await handle.db
        .collection(COLLECTIONS.tokenLedger)
        .findOne({ userId: helper.userId, kind: 'pronunciation' })
      expect(row?.amount).toBe(TOKEN_RULES.award.pronunciation)
      expect(row?.refId).toBe(`pron:${askId}`)
      // Its own kind, so the correction badges keep meaning corrections.
      expect(await ledgerRows(helper.userId, 'correction')).toBe(0)
    })

    it('accepts a fast take alone, and a fast take with a slow one', async () => {
      const asker = await newUser('pron-takes-asker@example.com')
      const one = await newUser('pron-takes-one@example.com')
      const two = await newUser('pron-takes-two@example.com')
      const a = (await ask(asker, 'colonel')).json<{ _id: string }>()._id
      const b = (await ask(asker, 'lieutenant')).json<{ _id: string }>()._id

      expect((await answer(one, a)).statusCode).toBe(201)
      const both = await answer(two, b, { media: take('fast'), slowMedia: take('slow') })
      expect(both.statusCode).toBe(201)
      expect(both.json<{ slowMedia?: { url: string } }>().slowMedia?.url).toContain('slow.m4a')
    })

    it('refuses an answer with no recording, and an image as one', async () => {
      const asker = await newUser('pron-bad-asker@example.com')
      const helper = await newUser('pron-bad-helper@example.com')
      const askId = (await ask(asker, 'worcestershire')).json<{ _id: string }>()._id

      expect((await answer(helper, askId, { note: 'Just words.' })).statusCode).toBe(400)
      const asImage = await answer(helper, askId, {
        media: {
          url: 'https://cdn.example.com/posts/u/1.jpg',
          contentType: 'image/jpeg',
          sizeBytes: 1024,
        },
      })
      // A photo where a recording belongs is the wrong *kind* of media, which
      // is what 415 says; 400 would claim the request itself was malformed.
      expect(asImage.statusCode).toBe(415)
    })

    it('takes a two-take answer without charging for it', async () => {
      // The ruling the half-speed decision left open was two files, one unit.
      // It is now two files and nothing, because attachments are unlimited on
      // every tier — but the shape it protected still holds: an answer must
      // never be more expensive for having recorded the slow take.
      const asker = await newUser('pron-quota-asker@example.com')
      const helper = await newUser('pron-quota-helper@example.com')
      const askId = (await ask(asker, 'anemone')).json<{ _id: string }>()._id

      const response = await answer(helper, askId, {
        media: take('fast'),
        slowMedia: take('slow'),
      })
      expect(response.statusCode).toBe(201)

      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: helper.userId })
      expect(profile?.quota?.media ?? []).toHaveLength(0)
    })

    it('refuses the whole answer when the second take is rejected', async () => {
      // Assert-all-then-write, pinned: a bad slow take must not leave half an
      // answer behind. It used to be phrased as "must not burn a unit"; there
      // is no unit any more, and the write is the thing that matters.
      const asker = await newUser('pron-quota2-asker@example.com')
      const helper = await newUser('pron-quota2-helper@example.com')
      const askId = (await ask(asker, 'quinoa')).json<{ _id: string }>()._id

      const response = await answer(helper, askId, {
        media: take('fast'),
        slowMedia: { ...take('slow'), url: 'https://evil.example.net/slow.m4a' },
      })
      expect(response.statusCode).toBe(400)

      const answers = await handle.db
        .collection(COLLECTIONS.pronunciationAnswers)
        .countDocuments({ authorId: helper.userId })
      expect(answers).toBe(0)
    })

    it('refuses answering your own request, and answering twice', async () => {
      const asker = await newUser('pron-own-asker@example.com')
      const helper = await newUser('pron-own-helper@example.com')
      const askId = (await ask(asker, 'gnocchi')).json<{ _id: string }>()._id

      expect((await answer(asker, askId)).statusCode).toBe(400)
      expect((await answer(helper, askId)).statusCode).toBe(201)
      expect((await answer(helper, askId)).statusCode).toBe(400)
    })

    it('pays exactly once however many times the answer is replayed', async () => {
      const asker = await newUser('pron-race-asker@example.com')
      const helper = await newUser('pron-race-helper@example.com')
      const askId = (await ask(asker, 'phenomenon')).json<{ _id: string }>()._id

      const results = await Promise.all([
        answer(helper, askId),
        answer(helper, askId),
        answer(helper, askId),
      ])
      expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1)

      expect(
        await handle.db
          .collection(COLLECTIONS.pronunciationAnswers)
          .countDocuments({ authorId: helper.userId }),
      ).toBe(1)
      expect(await ledgerRows(helper.userId, 'pronunciation')).toBe(1)
      // The one the sequential duplicate test cannot catch: an `$inc` that
      // drifted above the unique-index guard.
      const request = await handle.db
        .collection<{ answerCount?: number }>(COLLECTIONS.posts)
        .findOne({ _id: new ObjectId(askId) })
      expect(request?.answerCount).toBe(1)
    })

    it('puts unanswered requests first', async () => {
      const asker = await newUser('pron-queue-asker@example.com')
      const helper = await newUser('pron-queue-helper@example.com')
      const answered = (await ask(asker, 'first word')).json<{ _id: string }>()._id
      await answer(helper, answered)
      const untouched = (await ask(asker, 'second word')).json<{ _id: string }>()._id

      const items = (await feed(helper, 'kind=pronunciation')).json<{ items: { _id: string }[] }>()
        .items
      expect(items[0]?._id).toBe(untouched)
      expect(items.map((i) => i._id)).toContain(answered)
    })

    it('pages the pronunciation queue across an answerCount boundary', async () => {
      const asker = await newUser('pron-page-asker@example.com')
      const helper = await newUser('pron-page-helper@example.com')
      const answered = (await ask(asker, 'alpha')).json<{ _id: string }>()._id
      await answer(helper, answered)
      const open1 = (await ask(asker, 'bravo')).json<{ _id: string }>()._id
      const open2 = (await ask(asker, 'charlie')).json<{ _id: string }>()._id

      // Paged to exhaustion rather than compared to a fixed list: the feed is
      // global, so other tests' requests share these pages. What is being
      // pinned is the keyset itself — every row exactly once, and the answered
      // one after both open ones, across a boundary where `answerCount`
      // changes.
      const seen: string[] = []
      let cursor: string | null = null
      for (let page = 0; page < 20; page++) {
        const body: { items: { _id: string }[]; nextCursor: string | null } = (
          await feed(
            helper,
            `kind=pronunciation&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
          )
        ).json()
        seen.push(...body.items.map((i) => i._id))
        cursor = body.nextCursor
        if (!cursor) break
      }

      expect(new Set(seen).size).toBe(seen.length)
      for (const id of [open1, open2, answered]) expect(seen).toContain(id)
      expect(seen.indexOf(answered)).toBeGreaterThan(seen.indexOf(open1))
      expect(seen.indexOf(answered)).toBeGreaterThan(seen.indexOf(open2))
    })

    it('carries the top answer and the viewer flag on the card', async () => {
      const asker = await newUser('pron-card-asker@example.com')
      const helper = await newUser('pron-card-helper@example.com')
      const askId = (await ask(asker, 'espresso')).json<{ _id: string }>()._id
      await answer(helper, askId, { media: take('fast'), slowMedia: take('slow') })

      const card = (await feed(helper, 'kind=pronunciation'))
        .json<{
          items: {
            _id: string
            answerCount: number
            answeredByViewer: boolean
            topAnswer: { slowMedia?: { url: string } } | null
          }[]
        }>()
        .items.find((i) => i._id === askId)
      expect(card?.answerCount).toBe(1)
      expect(card?.answeredByViewer).toBe(true)
      expect(card?.topAnswer?.slowMedia?.url).toContain('slow.m4a')
    })

    it("counts a frozen user's answer even though it pays nothing", async () => {
      const asker = await newUser('pron-frozen-asker@example.com')
      const helper = await newUser('pron-frozen-helper@example.com')
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: helper.userId }, { $set: { tokenFrozenAt: new Date() } })
      const askId = (await ask(asker, 'jalapeno')).json<{ _id: string }>()._id

      expect((await answer(helper, askId)).statusCode).toBe(201)
      expect(await ledgerRows(helper.userId, 'pronunciation')).toBe(0)
      const request = await handle.db
        .collection<{ answerCount?: number }>(COLLECTIONS.posts)
        .findOne({ _id: new ObjectId(askId) })
      expect(request?.answerCount).toBe(1)
    })

    it("pages a request's answers oldest first, and carries the request", async () => {
      const asker = await newUser('pron-list-asker@example.com')
      const one = await newUser('pron-list-one@example.com')
      const two = await newUser('pron-list-two@example.com')
      const askId = (await ask(asker, 'sixth')).json<{ _id: string }>()._id
      await answer(one, askId)
      await answer(two, askId)

      const page = (await answers(asker, askId)).json<{
        post: { _id: string; kind: string }
        items: { author: { _id: string } }[]
      }>()
      expect(page.post._id).toBe(askId)
      expect(page.post.kind).toBe('pronunciation')
      expect(page.items.map((i) => i.author._id)).toEqual([one.userId, two.userId])
    })
  })

  describe('deleting your own things', () => {
    it('takes the corrections, answers, comments and likes with the post', async () => {
      const author = await newUser('del-post-author@example.com')
      const helper = await newUser('del-post-helper@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id
      const correctionId = (await correct(helper, postId, 'I have a pen.')).json<{ _id: string }>()
        ._id
      await comment(helper, postId, 'Close.')
      await app.inject({
        method: 'PUT',
        url: '/likes',
        headers: { cookie: helper.cookie },
        payload: { targetType: 'post', targetId: postId },
      })

      const paidBefore = await ledgerRows(helper.userId, 'correction')
      expect(paidBefore).toBe(1)

      const response = await app.inject({
        method: 'DELETE',
        url: `/posts/${postId}`,
        headers: { cookie: author.cookie },
      })
      expect(response.statusCode).toBe(204)

      const _id = new ObjectId(postId)
      expect(await handle.db.collection(COLLECTIONS.posts).countDocuments({ _id })).toBe(0)
      expect(
        await handle.db.collection(COLLECTIONS.postCorrections).countDocuments({ postId: _id }),
      ).toBe(0)
      expect(
        await handle.db.collection(COLLECTIONS.postComments).countDocuments({ postId: _id }),
      ).toBe(0)
      expect(
        await handle.db
          .collection(COLLECTIONS.likes)
          .countDocuments({ targetId: { $in: [_id, new ObjectId(correctionId)] } }),
      ).toBe(0)
      // Nobody loses what they earned: the ledger is append-only, and the
      // person who corrected this still did the work.
      expect(await ledgerRows(helper.userId, 'correction')).toBe(paidBefore)
    })

    it("refuses to delete somebody else's post, comment or correction", async () => {
      const author = await newUser('del-other-author@example.com')
      const helper = await newUser('del-other-helper@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id
      const correctionId = (await correct(helper, postId, 'I have a pen.')).json<{ _id: string }>()
        ._id
      const commentId = (await comment(helper, postId, 'Close.')).json<{ _id: string }>()._id

      const del = (url: string, user: SignedUpUser) =>
        app.inject({ method: 'DELETE', url, headers: { cookie: user.cookie } })

      // 404, never 403 — a 403 confirms the row exists.
      expect((await del(`/posts/${postId}`, helper)).statusCode).toBe(404)
      expect((await del(`/posts/${postId}/corrections/${correctionId}`, author)).statusCode).toBe(
        404,
      )
      expect((await del(`/posts/${postId}/comments/${commentId}`, author)).statusCode).toBe(404)
    })

    it('lets you rewrite a deleted correction, and does not pay for it twice', async () => {
      // The reason the award is keyed on the post rather than on the row.
      // Without it, delete-and-rewrite is an unbounded payout from one post.
      const author = await newUser('del-rewrite-author@example.com')
      const helper = await newUser('del-rewrite-helper@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id
      const correctionId = (await correct(helper, postId, 'I have a pen.')).json<{ _id: string }>()
        ._id
      expect(await ledgerRows(helper.userId, 'correction')).toBe(1)

      const removed = await app.inject({
        method: 'DELETE',
        url: `/posts/${postId}/corrections/${correctionId}`,
        headers: { cookie: helper.cookie },
      })
      expect(removed.statusCode).toBe(204)
      const post_ = await handle.db
        .collection<{ correctionCount: number }>(COLLECTIONS.posts)
        .findOne({ _id: new ObjectId(postId) })
      expect(post_?.correctionCount).toBe(0)

      expect((await correct(helper, postId, 'I have a pen!')).statusCode).toBe(201)
      expect(await ledgerRows(helper.userId, 'correction')).toBe(1)
    })

    it('lets you re-record a deleted answer, and does not pay for it twice', async () => {
      const asker = await newUser('del-answer-asker@example.com')
      const helper = await newUser('del-answer-helper@example.com')
      const askId = (await ask(asker, 'brioche')).json<{ _id: string }>()._id
      const answerId = (await answer(helper, askId)).json<{ _id: string }>()._id
      expect(await ledgerRows(helper.userId, 'pronunciation')).toBe(1)

      const removed = await app.inject({
        method: 'DELETE',
        url: `/posts/${askId}/answers/${answerId}`,
        headers: { cookie: helper.cookie },
      })
      expect(removed.statusCode).toBe(204)
      const request = await handle.db
        .collection<{ answerCount?: number }>(COLLECTIONS.posts)
        .findOne({ _id: new ObjectId(askId) })
      expect(request?.answerCount).toBe(0)

      expect((await answer(helper, askId)).statusCode).toBe(201)
      expect(await ledgerRows(helper.userId, 'pronunciation')).toBe(1)
    })

    it('deletes a post once when two devices press delete together', async () => {
      const author = await newUser('del-race-author@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id

      const del = () =>
        app.inject({
          method: 'DELETE',
          url: `/posts/${postId}`,
          headers: { cookie: author.cookie },
        })
      const results = await Promise.all([del(), del()])
      expect(results.filter((r) => r.statusCode === 204)).toHaveLength(1)
      expect(results.filter((r) => r.statusCode === 404)).toHaveLength(1)
    })

    it('drops the comment count when a comment is deleted', async () => {
      const author = await newUser('del-comment-author@example.com')
      const helper = await newUser('del-comment-helper@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id
      const commentId = (await comment(helper, postId, 'Close.')).json<{ _id: string }>()._id

      const response = await app.inject({
        method: 'DELETE',
        url: `/posts/${postId}/comments/${commentId}`,
        headers: { cookie: helper.cookie },
      })
      expect(response.statusCode).toBe(204)

      const card = (await feed(helper))
        .json<{ items: { _id: string; commentCount: number }[] }>()
        .items.find((i) => i._id === postId)
      expect(card?.commentCount).toBe(0)
    })
  })

  describe('your own posts', () => {
    async function mine(user: SignedUpUser, qs = '') {
      return app.inject({
        method: 'GET',
        url: `/me/posts${qs ? `?${qs}` : ''}`,
        headers: { cookie: user.cookie },
      })
    }

    it('mixes both sections, newest first, and nobody else', async () => {
      const author = await newUser('mine-author@example.com')
      const other = await newUser('mine-other@example.com')

      const corrected = (await post(author, 'I has a question.')).json<{ _id: string }>()._id
      const asked = (await ask(author, 'squirrel')).json<{ _id: string }>()._id
      const theirs = (await post(other, 'Not yours.')).json<{ _id: string }>()._id

      const items = (await mine(author)).json<{ items: { _id: string; kind: string }[] }>().items
      // Newest first: the pronunciation request was written second.
      expect(items.map((i) => i._id)).toEqual([asked, corrected])
      // Which is the point of the mix — the section is not a filter here.
      expect(items.map((i) => i.kind)).toEqual(['pronunciation', 'correction'])
      expect(items.map((i) => i._id)).not.toContain(theirs)

      // And the other way round, so this is not just an ordering coincidence.
      expect(
        (await mine(other)).json<{ items: { _id: string }[] }>().items.map((i) => i._id),
      ).toEqual([theirs])
    })

    it('carries what a card draws, for both kinds', async () => {
      const author = await newUser('mine-card-author@example.com')
      const helper = await newUser('mine-card-helper@example.com')

      const corrected = (await post(author, 'I has been there.')).json<{ _id: string }>()._id
      const asked = (await ask(author, 'thorough')).json<{ _id: string }>()._id
      expect((await correct(helper, corrected, 'I have been there.')).statusCode).toBe(201)
      expect((await answer(helper, asked)).statusCode).toBe(201)

      const items = (await mine(author)).json<{
        items: {
          _id: string
          author: { handle: string }
          topCorrection: { corrected: string } | null
          topAnswer: { _id: string } | null
        }[]
      }>().items

      // The reason `hydratePosts` is asked for both summaries here: a list that
      // mixes the sections needs the reply each kind shows.
      expect(items.find((i) => i._id === corrected)?.topCorrection?.corrected).toBe(
        'I have been there.',
      )
      expect(items.find((i) => i._id === asked)?.topAnswer).not.toBeNull()
      expect(items[0]?.author.handle).toBeTruthy()
    })

    it('pages without repeating or dropping a post', async () => {
      const author = await newUser('mine-paging@example.com')
      const ids: string[] = []
      for (let i = 0; i < 5; i++) {
        ids.unshift((await post(author, `Sentence number ${i}.`)).json<{ _id: string }>()._id)
      }

      const first = (await mine(author, 'limit=2')).json<{
        items: { _id: string }[]
        nextCursor: string | null
      }>()
      expect(first.items.map((i) => i._id)).toEqual(ids.slice(0, 2))
      expect(first.nextCursor).toBeTruthy()

      const second = (
        await mine(author, `limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`)
      ).json<{ items: { _id: string }[]; nextCursor: string | null }>()
      expect(second.items.map((i) => i._id)).toEqual(ids.slice(2, 4))

      const third = (
        await mine(author, `limit=2&cursor=${encodeURIComponent(second.nextCursor ?? '')}`)
      ).json<{ items: { _id: string }[]; nextCursor: string | null }>()
      expect(third.items.map((i) => i._id)).toEqual(ids.slice(4))
      expect(third.nextCursor).toBeNull()
    })

    it('says nothing rather than everything when you have posted nothing', async () => {
      const quiet = await newUser('mine-quiet@example.com')
      const page = (await mine(quiet)).json<{ items: unknown[]; nextCursor: string | null }>()
      expect(page.items).toEqual([])
      expect(page.nextCursor).toBeNull()
    })
  })
})
