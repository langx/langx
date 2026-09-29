import {
  FEED_POSTS_PER_24H,
  FEED_RANK_VERSION,
  MAX_ATTACHMENTS,
  MAX_VIDEO_SECONDS,
  TOKEN_RULES,
} from '@langx/shared'
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
import { deleteCorrection, deletePost } from '../modules/feed/feed'
import { listTimeline, olderThan, visibleTo, withinRange } from '../modules/feed/timeline'
import type { StorageProvider, UploadUrl } from '../storage/StorageProvider'
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

  // Signed by `/posts/upload-url`, so the key carries the uploader's own id —
  // the shape the route really mints, and the one the ownership check reads.
  const take = (owner: SignedUpUser, name: string) => ({
    url: `https://cdn.example.com/posts/${owner.userId}/${name}.m4a`,
    contentType: 'audio/m4a',
    sizeBytes: 4096,
    durationSeconds: 3,
  })

  async function answer(
    user: SignedUpUser,
    postId: string,
    payload: Record<string, unknown> = { media: take(user, 'fast') },
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
      email: emailSender,
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
    // Owner-aware, because the key a post attachment really has is
    // `posts/<uploaderId>/…` and that prefix is now checked.
    const image = (owner: SignedUpUser) => ({
      url: `https://cdn.example.com/posts/${owner.userId}/1.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      width: 800,
      height: 600,
    })

    const video = (owner: SignedUpUser) => ({
      url: `https://cdn.example.com/posts/${owner.userId}/1.mp4`,
      contentType: 'video/mp4',
      sizeBytes: 4 * 1024 * 1024,
      durationSeconds: 30,
      width: 1280,
      height: 720,
    })

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
      const response = await postWithMedia(author, 'Is this handwriting right?', image(author))
      expect(response.statusCode).toBe(201)

      const item = (await feed(author))
        .json<{
          items: { _id: string; media?: { url: string; width?: number } }[]
        }>()
        .items.find((i) => i._id === response.json<{ _id: string }>()._id)
      expect(item?.media?.url).toBe(image(author).url)
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
            url: `https://cdn.example.com/posts/${helper.userId}/1.m4a`,
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
        ...image(author),
        url: 'https://evil.example.net/a.jpg',
      })
      expect(response.statusCode).toBe(400)
    })

    it('refuses an oversized attachment', async () => {
      const author = await newUser('media-huge@example.com')
      const response = await postWithMedia(author, 'A very large photo.', {
        ...image(author),
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
        ...image(author),
        contentType: 'application/pdf',
        url: `https://cdn.example.com/posts/${author.userId}/1.pdf`,
      })
      expect(response.statusCode).toBe(415)
      expect(response.json()).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' })
    })

    it('spends the media quota only when there is an attachment', async () => {
      // The same bucket chat uses: it is the same abuse surface, and a second
      // one would be a free tier that is really twice the limit through two
      // doors.
      const author = await newUser('media-quota@example.com')

      await post(author, 'A sentence with nothing attached.')
      const afterPlain = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: author.userId })
      expect(afterPlain?.quota.media ?? []).toHaveLength(0)

      await postWithMedia(author, 'A sentence with a photo.', image(author))
      const afterMedia = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: author.userId })
      expect(afterMedia?.quota.media ?? []).toHaveLength(1)
    })

    it('carries a gallery back on the feed', async () => {
      const author = await newUser('media-gallery@example.com')
      const response = await postWithAttachments(author, 'Which of these is right?', [
        image(author),
        { ...image(author), url: `https://cdn.example.com/posts/${author.userId}/2.jpg` },
        video(author),
      ])
      expect(response.statusCode).toBe(201)
      const body = response.json<{ attachments?: unknown[]; media?: { url: string } }>()
      expect(body.attachments).toHaveLength(3)
      // Repeated as `media` so a build that predates the list shows the first.
      expect(body.media?.url).toBe(image(author).url)
    })

    it('still accepts the one-attachment body an installed build sends', async () => {
      const author = await newUser('media-legacy@example.com')
      const response = await postWithMedia(author, 'One photo, old client.', image(author))
      expect(response.statusCode).toBe(201)
      expect(response.json<{ attachments?: unknown[] }>().attachments).toHaveLength(1)
    })

    it('accepts a video on a post', async () => {
      const author = await newUser('media-video@example.com')
      const response = await postWithMedia(author, 'Am I saying this right?', video(author))
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
        payload: { corrected: 'I said it wrong.', attachments: [video(helper)] },
      })
      expect(response.statusCode).toBe(201)
      expect(response.json<{ attachments?: unknown[] }>().attachments).toHaveLength(1)
    })

    it('refuses a video longer than the ceiling', async () => {
      const author = await newUser('media-long@example.com')
      const response = await postWithMedia(author, 'A whole film.', {
        ...video(author),
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
        Array.from({ length: MAX_ATTACHMENTS + 1 }, () => image(author)),
      )
      expect(response.statusCode).toBe(400)
    })

    it('spends one media unit for a gallery, not one per file', async () => {
      // The byte ceiling is per file and is the control that bounds storage;
      // the daily count is a ceiling on abuse, and six photos are one post.
      const author = await newUser('media-gallery-quota@example.com')
      await postWithAttachments(author, 'Three of them.', [
        image(author),
        { ...image(author), url: `https://cdn.example.com/posts/${author.userId}/2.jpg` },
        { ...image(author), url: `https://cdn.example.com/posts/${author.userId}/3.jpg` },
      ])
      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: author.userId })
      expect(profile?.quota.media ?? []).toHaveLength(1)
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

  describe('asks', () => {
    it('stores the one ask an old-style post names, beside its section', async () => {
      const author = await newUser('asks-stored-author@example.com')
      const postId = (await post(author, 'I has a pen.')).json<{ _id: string }>()._id
      const askId = (await ask(author, 'squirrel')).json<{ _id: string }>()._id

      const rows = await handle.db
        .collection<{ _id: ObjectId; asks?: string[]; kind?: string; answerCount?: number }>(
          COLLECTIONS.posts,
        )
        .find({ _id: { $in: [new ObjectId(postId), new ObjectId(askId)] } })
        .toArray()
      const byId = new Map(rows.map((row) => [row._id.toHexString(), row]))
      expect(byId.get(postId)).toMatchObject({
        asks: ['correction'],
        kind: 'correction',
        answerCount: 0,
      })
      expect(byId.get(askId)).toMatchObject({
        asks: ['pronunciation'],
        kind: 'pronunciation',
        answerCount: 0,
      })
    })

    it('carries the asks on the card, and reads them for a post that predates them', async () => {
      const author = await newUser('asks-dto-author@example.com')
      const reader = await newUser('asks-dto-reader@example.com')
      const created = await post(author, 'I has a pen.')
      expect(created.json<{ asks: string[]; kind: string }>()).toMatchObject({
        asks: ['correction'],
        kind: 'correction',
      })
      const legacyId = new ObjectId()
      await handle.db.collection(COLLECTIONS.posts).insertOne({
        _id: legacyId,
        authorId: author.userId,
        body: 'From before the sections.',
        language: 'en',
        correctionCount: 0,
        createdAt: new Date(),
      })

      const items = (await feed(reader, 'kind=correction')).json<{
        items: { _id: string; asks: string[]; kind: string }[]
      }>().items
      expect(items.find((i) => i._id === legacyId.toHexString())).toMatchObject({
        asks: ['correction'],
        kind: 'correction',
      })
    })

    /*
     * A post that asks for nothing cannot be written through this API yet, so
     * the row goes in directly. The refusal is the author's consent holding.
     */
    it('refuses a correction and a recording on a post that asked for neither', async () => {
      const author = await newUser('asks-moment-author@example.com')
      const helper = await newUser('asks-moment-helper@example.com')
      const _id = new ObjectId()
      await handle.db.collection(COLLECTIONS.posts).insertOne({
        _id,
        authorId: author.userId,
        body: 'My lunch today.',
        language: 'en',
        asks: [],
        kind: 'moment',
        correctionCount: 0,
        answerCount: 0,
        createdAt: new Date(),
      })

      const corrected = await correct(helper, _id.toHexString(), 'My lunch, today.')
      expect(corrected.statusCode).toBe(400)
      expect(corrected.json<{ reason?: string }>().reason).toBe('not_asked')
      const recorded = await answer(helper, _id.toHexString())
      expect(recorded.statusCode).toBe(400)
      expect(recorded.json<{ reason?: string }>().reason).toBe('not_asked')

      // And an old build's sections never list it.
      for (const kind of ['correction', 'pronunciation']) {
        const ids = (await feed(helper, `kind=${kind}`))
          .json<{ items: { _id: string }[] }>()
          .items.map((i) => i._id)
        expect(ids).not.toContain(_id.toHexString())
      }
    })

    function postAsks(user: SignedUpUser, payload: Record<string, unknown>) {
      return app.inject({
        method: 'POST',
        url: '/posts',
        headers: { cookie: user.cookie },
        payload: { language: 'en', ...payload },
      })
    }

    const photo = (owner: SignedUpUser, name = 'moment') => ({
      url: `https://cdn.example.com/posts/${owner.userId}/${name}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      width: 800,
      height: 600,
    })

    const sectionIds = async (user: SignedUpUser, kind: string) =>
      (await feed(user, `kind=${kind}`))
        .json<{ items: { _id: string }[] }>()
        .items.map((i) => i._id)

    it('posts a moment, and keeps it out of both of an old build’s sections', async () => {
      const author = await newUser('moment-author@example.com')
      const reader = await newUser('moment-reader@example.com')
      const created = await postAsks(author, { body: 'Lunch by the river.', asks: [] })
      expect(created.statusCode, created.body).toBe(201)
      const moment = created.json<{ _id: string; asks: string[]; kind: string }>()
      expect(moment.asks).toEqual([])
      // The two values an installed build's enum has; never `'moment'`.
      expect(moment.kind).toBe('correction')

      const stored = await handle.db
        .collection<{ kind?: string }>(COLLECTIONS.posts)
        .findOne({ _id: new ObjectId(moment._id) })
      expect(stored?.kind).toBe('moment')
      expect(await sectionIds(reader, 'correction')).not.toContain(moment._id)
      expect(await sectionIds(reader, 'pronunciation')).not.toContain(moment._id)
    })

    it('files a post asking for both under corrections only, and takes both helps', async () => {
      const author = await newUser('both-api-author@example.com')
      const helper = await newUser('both-api-helper@example.com')
      const created = await postAsks(author, {
        body: 'I has a squirrel.',
        asks: ['pronunciation', 'correction'],
      })
      expect(created.statusCode, created.body).toBe(201)
      const both = created.json<{ _id: string; asks: string[]; kind: string }>()
      // Stored sorted, whatever order they were sent in.
      expect(both.asks).toEqual(['correction', 'pronunciation'])
      expect(both.kind).toBe('correction')
      expect(await sectionIds(helper, 'correction')).toContain(both._id)
      expect(await sectionIds(helper, 'pronunciation')).not.toContain(both._id)

      expect((await correct(helper, both._id, 'I have a squirrel.')).statusCode).toBe(201)
      expect((await answer(helper, both._id)).statusCode).toBe(201)
    })

    it('lets asks win over kind', async () => {
      const author = await newUser('asks-win-author@example.com')
      const created = await postAsks(author, {
        body: 'Squirrel.',
        kind: 'pronunciation',
        asks: ['correction'],
      })
      expect(created.json<{ asks: string[]; kind: string }>()).toMatchObject({
        asks: ['correction'],
        kind: 'correction',
      })
    })

    it('refuses the same ask twice, and more asks than exist', async () => {
      const author = await newUser('asks-dup-author@example.com')
      expect(
        (await postAsks(author, { body: 'Hi.', asks: ['correction', 'correction'] })).statusCode,
      ).toBe(400)
    })

    it('posts a photo with no words when it asks for nothing', async () => {
      const author = await newUser('photo-moment-author@example.com')
      const created = await postAsks(author, { body: '', asks: [], attachments: [photo(author)] })
      expect(created.statusCode, created.body).toBe(201)
      expect(created.json<{ body: string }>().body).toBe('')
    })

    it('says which rule refused a post, and keeps the old code for each', async () => {
      const author = await newUser('post-rules-author@example.com')
      const refusal = async (payload: Record<string, unknown>) => {
        const response = await postAsks(author, payload)
        expect(response.statusCode, response.body).toBe(400)
        const body = response.json<{ code: string; reason?: string }>()
        expect(body.code).toBe('VALIDATION_FAILED')
        return body.reason
      }
      const voice = {
        url: `https://cdn.example.com/posts/${author.userId}/voice.m4a`,
        contentType: 'audio/m4a',
        sizeBytes: 4096,
        durationSeconds: 3,
      }

      // A voice note alone is not a moment: nothing on the card to look at.
      expect(await refusal({ body: '', asks: [], attachments: [voice] })).toBe(
        'moment_needs_content',
      )
      expect(await refusal({ body: '   ', asks: [] })).toBe('moment_needs_content')
      // Any ask needs words, a photo or not.
      expect(await refusal({ body: '', asks: ['correction'], attachments: [photo(author)] })).toBe(
        'ask_needs_words',
      )
      // An installed build's empty body: still refused, with the code it knows.
      expect(await refusal({ body: '' })).toBe('ask_needs_words')
      // The author is `tr` native, `en` learning (see `onboardingBody`).
      expect(await refusal({ body: 'Merhaba.', language: 'tr', asks: ['correction'] })).toBe(
        'ask_needs_learning_language',
      )
      expect(await refusal({ body: 'Bonjour.', language: 'fr', asks: [] })).toBe(
        'language_not_yours',
      )
    })

    it('posts a moment in a language the author speaks natively', async () => {
      const author = await newUser('native-moment-author@example.com')
      const created = await postAsks(author, {
        body: 'Bugün hava çok güzel.',
        language: 'tr',
        asks: [],
      })
      expect(created.statusCode, created.body).toBe(201)
    })

    it('stops at the daily post cap, and says when the next slot frees', async () => {
      const author = await newUser('post-cap-author@example.com')
      const now = Date.now()
      // The earlier posts written straight in: twenty requests would only
      // test the same insert twenty times.
      await handle.db.collection(COLLECTIONS.posts).insertMany(
        Array.from({ length: FEED_POSTS_PER_24H }, (_, i) => ({
          _id: new ObjectId(),
          authorId: author.userId,
          body: `Post ${i}.`,
          language: 'en',
          asks: [],
          kind: 'moment',
          correctionCount: 0,
          answerCount: 0,
          createdAt: new Date(now - (FEED_POSTS_PER_24H - i) * 60_000),
        })),
      )

      const refused = await postAsks(author, { body: 'One too many.', asks: [] })
      const body = refused.json<{ code: string; limit?: string; retryAt?: string }>()
      expect(body.code).toBe('QUOTA_EXCEEDED')
      expect(body.limit).toBe('postsPer24h')
      expect(new Date(body.retryAt ?? 0).getTime()).toBeGreaterThan(now)
    })

    it('takes both kinds of help on a post asking for both, and pays for each', async () => {
      const author = await newUser('asks-both-author@example.com')
      const helper = await newUser('asks-both-helper@example.com')
      const _id = new ObjectId()
      await handle.db.collection(COLLECTIONS.posts).insertOne({
        _id,
        authorId: author.userId,
        body: 'I has a squirrel.',
        language: 'en',
        asks: ['correction', 'pronunciation'],
        kind: 'correction',
        correctionCount: 0,
        answerCount: 0,
        createdAt: new Date(),
      })

      expect((await correct(helper, _id.toHexString(), 'I have a squirrel.')).statusCode).toBe(201)
      expect((await answer(helper, _id.toHexString())).statusCode).toBe(201)
      expect(await ledgerRows(helper.userId, 'correction')).toBe(1)
      expect(await ledgerRows(helper.userId, 'pronunciation')).toBe(1)
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
      const both = await answer(two, b, { media: take(two, 'fast'), slowMedia: take(two, 'slow') })
      expect(both.statusCode).toBe(201)
      expect(both.json<{ slowMedia?: { url: string } }>().slowMedia?.url).toContain('slow.m4a')
    })

    it('stores both takes as the normaliser leaves them', async () => {
      const asker = await newUser('pron-normalise-asker@example.com')
      const helper = await newUser('pron-normalise-helper@example.com')
      const askId = (await ask(asker, 'squirrel')).json<{ _id: string }>()._id

      /*
       * An answer is the one place a recording is two fields rather than a
       * list, so it is the one place the pair could come back in the wrong
       * order or lose a take. It is also the page most likely to be recorded
       * in a browser, which is what the conversion exists for.
       */
      const real = app.normalizeAttachments
      app.normalizeAttachments = (items) =>
        Promise.resolve(
          items.map((item) => ({
            ...item,
            url: item.url.replace('.webm', '.m4a'),
            contentType: 'audio/mp4',
          })),
        )

      try {
        const webm = (name: string) => ({
          url: `https://cdn.example.com/posts/${helper.userId}/${name}.webm`,
          contentType: 'audio/webm',
          sizeBytes: 4096,
          durationSeconds: 3,
        })
        const response = await answer(helper, askId, {
          media: webm('fast'),
          slowMedia: webm('slow'),
        })

        expect(response.statusCode, response.body).toBe(201)
        const body = response.json<{
          media: { url: string; contentType: string }
          slowMedia?: { url: string }
        }>()
        expect(body.media.contentType).toBe('audio/mp4')
        expect(body.media.url).toContain('fast.m4a')
        expect(body.slowMedia?.url).toContain('slow.m4a')
      } finally {
        app.normalizeAttachments = real
      }
    })

    it('refuses an answer with no recording, and an image as one', async () => {
      const asker = await newUser('pron-bad-asker@example.com')
      const helper = await newUser('pron-bad-helper@example.com')
      const askId = (await ask(asker, 'worcestershire')).json<{ _id: string }>()._id

      expect((await answer(helper, askId, { note: 'Just words.' })).statusCode).toBe(400)
      const asImage = await answer(helper, askId, {
        media: {
          url: `https://cdn.example.com/posts/${helper.userId}/1.jpg`,
          contentType: 'image/jpeg',
          sizeBytes: 1024,
        },
      })
      // A photo where a recording belongs is the wrong *kind* of media, which
      // is what 415 says; 400 would claim the request itself was malformed.
      expect(asImage.statusCode).toBe(415)
    })

    it('spends one media unit for a two-take answer', async () => {
      // The ruling the half-speed decision left open. Two files, one unit —
      // charging twice would make the optional slow take feel expensive and be
      // skipped, which is the behaviour it exists to encourage.
      const asker = await newUser('pron-quota-asker@example.com')
      const helper = await newUser('pron-quota-helper@example.com')
      const askId = (await ask(asker, 'anemone')).json<{ _id: string }>()._id

      await answer(helper, askId, { media: take(helper, 'fast'), slowMedia: take(helper, 'slow') })

      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: helper.userId })
      expect(profile?.quota?.media).toHaveLength(1)
    })

    it('spends nothing when the second take is rejected', async () => {
      // Assert-all-then-consume, pinned: a bad slow take must not burn a unit
      // for an answer that never got written.
      const asker = await newUser('pron-quota2-asker@example.com')
      const helper = await newUser('pron-quota2-helper@example.com')
      const askId = (await ask(asker, 'quinoa')).json<{ _id: string }>()._id

      const response = await answer(helper, askId, {
        media: take(helper, 'fast'),
        slowMedia: { ...take(helper, 'slow'), url: 'https://evil.example.net/slow.m4a' },
      })
      expect(response.statusCode).toBe(400)

      const profile = await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: helper.userId })
      expect(profile?.quota?.media ?? []).toHaveLength(0)
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
      await answer(helper, askId, { media: take(helper, 'fast'), slowMedia: take(helper, 'slow') })

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

  describe('somebody else’s corrections', () => {
    interface AuthoredPage {
      items: {
        _id: string
        postId: string
        original: string
        corrected: string
        language: string
      }[]
      nextCursor: string | null
    }

    function written(viewer: SignedUpUser, of: string, qs = '') {
      return app.inject({
        method: 'GET',
        url: `/profiles/${of}/corrections${qs ? `?${qs}` : ''}`,
        headers: { cookie: viewer.cookie },
      })
    }

    it('carries the sentence each correction was of, newest first', async () => {
      const teacher = await newUser('written-teacher@example.com', { handle: 'writtenteacher' })
      const asker = await newUser('written-asker@example.com')
      const viewer = await newUser('written-viewer@example.com')

      const first = (await post(asker, 'I has been there.')).json<{ _id: string }>()._id
      const second = (await post(asker, 'She go home.')).json<{ _id: string }>()._id
      expect((await correct(teacher, first, 'I have been there.')).statusCode).toBe(201)
      expect((await correct(teacher, second, 'She goes home.')).statusCode).toBe(201)

      const page = (await written(viewer, 'writtenteacher')).json<AuthoredPage>()
      expect(page.items).toHaveLength(2)
      // Newest first, the opposite of a post's own correction list: this one
      // is read as "what has this person been doing", not as a thread.
      expect(page.items.map((item) => item.corrected)).toEqual([
        'She goes home.',
        'I have been there.',
      ])
      expect(page.items[0]).toMatchObject({
        postId: second,
        original: 'She go home.',
        language: 'en',
      })
      expect(page.nextCursor).toBeNull()
    })

    it('counts only what was written on posts, not what was written in a chat', async () => {
      const teacher = await newUser('written-chat@example.com', { handle: 'writtenchat' })
      const viewer = await newUser('written-chat-viewer@example.com')

      // The tile that opens this screen counts chat corrections too. They are
      // not here, which is the whole reason the screen carries a note saying so.
      const page = (await written(viewer, 'writtenchat')).json<AuthoredPage>()
      expect(page.items).toEqual([])
      void teacher
    })

    it('leaves out a correction whose post is by somebody the viewer blocked', async () => {
      const teacher = await newUser('written-block-teacher@example.com', {
        handle: 'writtenblockteacher',
      })
      const shunned = await newUser('written-block-author@example.com')
      const friend = await newUser('written-block-friend@example.com')
      const viewer = await newUser('written-block-viewer@example.com')

      const hiddenPost = (await post(shunned, 'Hidden sentence.')).json<{ _id: string }>()._id
      const shownPost = (await post(friend, 'Shown sentence.')).json<{ _id: string }>()._id
      await correct(teacher, hiddenPost, 'Hidden, fixed.')
      await correct(teacher, shownPost, 'Shown, fixed.')

      await app.inject({
        method: 'POST',
        url: '/blocks',
        headers: { cookie: viewer.cookie },
        payload: { userId: shunned.userId },
      })

      const page = (await written(viewer, 'writtenblockteacher')).json<AuthoredPage>()
      expect(page.items.map((item) => item.corrected)).toEqual(['Shown, fixed.'])
    })

    it('pages newest first and stops', async () => {
      const teacher = await newUser('written-page-teacher@example.com', { handle: 'writtenpager' })
      const asker = await newUser('written-page-asker@example.com')
      const viewer = await newUser('written-page-viewer@example.com')

      const corrected: string[] = []
      for (let i = 0; i < 3; i++) {
        const postId = (await post(asker, `Sentence ${i}.`)).json<{ _id: string }>()._id
        await correct(teacher, postId, `Fixed ${i}.`)
        corrected.push(`Fixed ${i}.`)
      }
      corrected.reverse()

      const first = (await written(viewer, 'writtenpager', 'limit=2')).json<AuthoredPage>()
      expect(first.items.map((item) => item.corrected)).toEqual(corrected.slice(0, 2))
      expect(first.nextCursor).not.toBeNull()

      const second = (
        await written(
          viewer,
          'writtenpager',
          `limit=2&cursor=${encodeURIComponent(first.nextCursor ?? '')}`,
        )
      ).json<AuthoredPage>()
      expect(second.items.map((item) => item.corrected)).toEqual(corrected.slice(2))
      expect(second.nextCursor).toBeNull()
    })

    it('is absent rather than forbidden for a handle nobody answers to', async () => {
      const viewer = await newUser('written-missing-viewer@example.com')
      expect((await written(viewer, 'nobodyatall')).statusCode).toBe(404)
    })
  })

  describe('somebody else’s posts', () => {
    function theirs(viewer: SignedUpUser, of: string, qs = '') {
      return app.inject({
        method: 'GET',
        url: `/profiles/${of}/posts${qs ? `?${qs}` : ''}`,
        headers: { cookie: viewer.cookie },
      })
    }

    function summaryOf(viewer: SignedUpUser, of: string) {
      return app.inject({
        method: 'GET',
        url: `/profiles/${of}/summary`,
        headers: { cookie: viewer.cookie },
      })
    }

    it('lists their posts newest first, and the summary counts the same ones', async () => {
      const author = await newUser('theirs-author@example.com', { handle: 'theirsauthor' })
      const other = await newUser('theirs-other@example.com')
      const viewer = await newUser('theirs-viewer@example.com')

      const corrected = (await post(author, 'I has a question.')).json<{ _id: string }>()._id
      const asked = (await ask(author, 'squirrel')).json<{ _id: string }>()._id
      const hidden = (await post(author, 'Hidden by a moderator.')).json<{ _id: string }>()._id
      await post(other, 'Not theirs.')
      await handle.db
        .collection(COLLECTIONS.posts)
        .updateOne({ _id: new ObjectId(hidden) }, { $set: { hiddenAt: new Date() } })

      const page = (await theirs(viewer, 'theirsauthor')).json<{
        items: { _id: string }[]
        nextCursor: string | null
      }>()
      // A hidden post is absent, as it is from the author's own list: hiding
      // is silent, and a stranger's view of the profile must not break that.
      expect(page.items.map((i) => i._id)).toEqual([asked, corrected])
      expect(page.nextCursor).toBeNull()

      // The tile's number and the list it opens are one filter, not two.
      const summary = (await summaryOf(viewer, 'theirsauthor')).json<{ posts: number }>()
      expect(summary.posts).toBe(2)

      // And the owner's Me tab counts them the same way.
      const own = await app.inject({
        method: 'GET',
        url: '/me/tokens',
        headers: { cookie: author.cookie },
      })
      expect(own.json<{ lifetime: { posts: number } }>().lifetime.posts).toBe(2)
    })

    it('is absent to somebody the author blocked', async () => {
      const author = await newUser('theirs-block-author@example.com', {
        handle: 'theirsblocker',
      })
      const viewer = await newUser('theirs-block-viewer@example.com')
      await post(author, 'Not for you.')
      await app.inject({
        method: 'POST',
        url: '/blocks',
        headers: { cookie: author.cookie },
        payload: { userId: viewer.userId },
      })

      expect((await theirs(viewer, 'theirsblocker')).statusCode).toBe(404)
    })

    it('is absent rather than forbidden for a handle nobody answers to', async () => {
      const viewer = await newUser('theirs-missing-viewer@example.com')
      expect((await theirs(viewer, 'nobodyatall')).statusCode).toBe(404)
    })
  })

  describe('hardening before moments', () => {
    const BASE = 'https://cdn.example.com'
    const picture = (owner: SignedUpUser, name: string) => ({
      url: `${BASE}/posts/${owner.userId}/${name}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      width: 800,
      height: 600,
    })

    /** Records every key it is asked to delete; `supportsPut` needs `putObject`. */
    function recordingStorage(): StorageProvider & { deleted: string[] } {
      const deleted: string[] = []
      return {
        deleted,
        getUploadUrl: (): Promise<UploadUrl> => Promise.reject(new Error('unused')),
        putObject: (): Promise<string> => Promise.reject(new Error('unused')),
        getObject: (): Promise<Uint8Array> => Promise.reject(new Error('unused')),
        deleteObject: (key: string): Promise<void> => {
          deleted.push(key)
          return Promise.resolve()
        },
        keyFromPublicUrl: (url: string): string | null =>
          url.startsWith(`${BASE}/`) ? url.slice(BASE.length + 1) : null,
      } as StorageProvider & { deleted: string[] }
    }

    it('deletes every file of a gallery with its post, not only the first', async () => {
      const author = await newUser('gallery-del-author@example.com')
      const helper = await newUser('gallery-del-helper@example.com')
      const created = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { cookie: author.cookie },
        payload: {
          body: 'Two pictures of my notes.',
          language: 'en',
          attachments: [picture(author, 'a'), picture(author, 'b')],
        },
      })
      expect(created.statusCode, created.body).toBe(201)
      const postId = created.json<{ _id: string }>()._id
      const corrected = await app.inject({
        method: 'POST',
        url: `/posts/${postId}/corrections`,
        headers: { cookie: helper.cookie },
        payload: {
          corrected: 'Two pictures of my notes!',
          attachments: [picture(helper, 'c'), picture(helper, 'd')],
        },
      })
      expect(corrected.statusCode, corrected.body).toBe(201)

      const storage = recordingStorage()
      await deletePost(handle.db, author.userId, postId, storage)
      expect(storage.deleted.sort()).toEqual(
        [
          `posts/${author.userId}/a.jpg`,
          `posts/${author.userId}/b.jpg`,
          `posts/${helper.userId}/c.jpg`,
          `posts/${helper.userId}/d.jpg`,
        ].sort(),
      )
    })

    it('deletes every file of a correction with it', async () => {
      const author = await newUser('gallery-corr-author@example.com')
      const helper = await newUser('gallery-corr-helper@example.com')
      const postId = (await post(author, 'I has two pen.')).json<{ _id: string }>()._id
      const correction = await app.inject({
        method: 'POST',
        url: `/posts/${postId}/corrections`,
        headers: { cookie: helper.cookie },
        payload: {
          corrected: 'I have two pens.',
          attachments: [picture(helper, 'e'), picture(helper, 'f')],
        },
      })
      const correctionId = correction.json<{ _id: string }>()._id

      const storage = recordingStorage()
      await deleteCorrection(handle.db, helper.userId, postId, correctionId, storage)
      expect(storage.deleted.sort()).toEqual(
        [`posts/${helper.userId}/e.jpg`, `posts/${helper.userId}/f.jpg`].sort(),
      )
    })

    it('will not take a correction or a recording across a block', async () => {
      const author = await newUser('block-write-author@example.com')
      const helper = await newUser('block-write-helper@example.com')
      const postId = (await post(author, 'I goes there.')).json<{ _id: string }>()._id
      const askId = (await ask(author, 'squirrel')).json<{ _id: string }>()._id
      // The author blocks the helper; blocks read both ways, so the helper is
      // the one refused.
      await app.inject({
        method: 'POST',
        url: '/blocks',
        headers: { cookie: author.cookie },
        payload: { userId: helper.userId },
      })

      expect((await correct(helper, postId, 'I go there.')).statusCode).toBe(404)
      expect((await answer(helper, askId)).statusCode).toBe(404)
      expect(await ledgerRows(helper.userId, 'correction')).toBe(0)
      expect(await ledgerRows(helper.userId, 'pronunciation')).toBe(0)
    })

    it('draws the recorded half of a post opened through its corrections', async () => {
      const asker = await newUser('thread-answer-asker@example.com')
      const helper = await newUser('thread-answer-helper@example.com')
      const viewer = await newUser('thread-answer-viewer@example.com')
      const askId = (await ask(asker, 'squirrel')).json<{ _id: string }>()._id
      const answerId = (await answer(helper, askId)).json<{ _id: string }>()._id
      const liked = await app.inject({
        method: 'PUT',
        url: '/likes',
        headers: { cookie: viewer.cookie },
        payload: { targetType: 'answer', targetId: answerId },
      })
      expect(liked.statusCode, liked.body).toBeLessThan(300)

      type Thread = {
        post: {
          topAnswer: { _id: string; likedByViewer: boolean; likeCount: number } | null
          answeredByViewer: boolean
        }
      }
      const seen = (await corrections(viewer, askId)).json<Thread>()
      expect(seen.post.topAnswer?._id).toBe(answerId)
      expect(seen.post.topAnswer?.likedByViewer).toBe(true)
      expect(seen.post.topAnswer?.likeCount).toBe(1)
      expect(seen.post.answeredByViewer).toBe(false)
      expect((await corrections(helper, askId)).json<Thread>().post.answeredByViewer).toBe(true)
    })

    it('draws the corrected half of a post opened through its recordings', async () => {
      const author = await newUser('thread-corr-author@example.com')
      const helper = await newUser('thread-corr-helper@example.com')
      const postId = (await post(author, 'He go to school.')).json<{ _id: string }>()._id
      await correct(helper, postId, 'He goes to school.')

      const seen = (await answers(helper, postId)).json<{
        post: { topCorrection: { corrected: string } | null; correctedByViewer: boolean }
      }>()
      expect(seen.post.topCorrection?.corrected).toBe('He goes to school.')
      expect(seen.post.correctedByViewer).toBe(true)
    })

    // `asks` itself is accepted since moments shipped; an ask this API does not
    // know is still refused by the schema rather than stripped.
    it('refuses an ask it does not know rather than filing it as a correction', async () => {
      const author = await newUser('asks-refused@example.com')
      const response = await app.inject({
        method: 'POST',
        url: '/posts',
        headers: { cookie: author.cookie },
        payload: { body: 'A photo of my lunch.', language: 'en', asks: ['compliment'] },
      })
      expect(response.statusCode).toBe(400)
      const body = response.json<{ code: string; details?: unknown }>()
      expect(body.code).toBe('VALIDATION_FAILED')
      // A schema failure still carries zod's issues in `details`.
      expect(Array.isArray(body.details)).toBe(true)
      expect(
        await handle.db.collection(COLLECTIONS.posts).countDocuments({ authorId: author.userId }),
      ).toBe(0)
    })

    it('never sends a client a kind outside the two it knows', async () => {
      const author = await newUser('kind-normalised@example.com')
      await handle.db.collection(COLLECTIONS.posts).insertOne({
        _id: new ObjectId(),
        authorId: author.userId,
        body: 'written by a later build',
        language: 'en',
        kind: 'moment',
        correctionCount: 0,
        createdAt: new Date(),
      })
      const mine = await app.inject({
        method: 'GET',
        url: '/me/posts',
        headers: { cookie: author.cookie },
      })
      expect(mine.json<{ items: { kind: string }[] }>().items.map((i) => i.kind)).toEqual([
        'correction',
      ])
    })
  })

  describe('timeline', () => {
    type Page = {
      items: {
        _id: string
        asks?: string[]
        kind: string
        topCorrection: { corrected: string } | null
        topAnswer: { _id: string; likedByViewer: boolean } | null
      }[]
      nextCursor: string | null
    }

    function timeline(user: SignedUpUser, qs = '') {
      return app.inject({
        method: 'GET',
        url: `/feed/timeline${qs ? `?${qs}` : ''}`,
        headers: { cookie: user.cookie },
      })
    }

    /** Every page through the route, to exhaustion. */
    async function walkRoute(user: SignedUpUser): Promise<Page['items']> {
      const seen: Page['items'] = []
      let cursor: string | null = null
      for (let guard = 0; guard < 100; guard++) {
        const response = await timeline(
          user,
          `limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        )
        expect(response.statusCode, response.body).toBe(200)
        const page = response.json<Page>()
        seen.push(...page.items)
        cursor = page.nextCursor
        if (!cursor) return seen
      }
      throw new Error('the timeline never ended')
    }

    /**
     * One page straight from the module, with a window small enough to cross.
     * Injectable because this suite shares one database: the window is always
     * the newest posts in the whole collection, and each test's fixtures are
     * the newest when it runs.
     */
    function modulePage(user: SignedUpUser, limit: number, cursor: string | null, window: number) {
      return listTimeline(
        handle.db,
        { userId: user.userId, canAnswer: true },
        { limit, ...(cursor ? { cursor } : {}) },
        { window },
      )
    }

    async function walkModule(
      user: SignedUpUser,
      { limit, window }: { limit: number; window: number },
      between?: (page: number, served: string[]) => Promise<void>,
    ): Promise<string[]> {
      const ids: string[] = []
      let cursor: string | null = null
      for (let page = 0; page < 500; page++) {
        const result = await modulePage(user, limit, cursor, window)
        ids.push(...result.items.map((item) => item._id))
        if (between) await between(page, ids)
        cursor = result.nextCursor
        if (!cursor) return ids
      }
      throw new Error('the timeline never ended')
    }

    async function visiblePostIds(): Promise<string[]> {
      const rows = await handle.db
        .collection(COLLECTIONS.posts)
        .find({ hiddenAt: { $exists: false } })
        .project<{ _id: ObjectId }>({ _id: 1 })
        .toArray()
      return rows.map((row) => row._id.toHexString())
    }

    /** Posts a second apart, newest first, written straight in. */
    async function insertPosts(
      authorId: string,
      count: number,
      fields: Record<string, unknown> = {},
    ): Promise<string[]> {
      const base = Date.now()
      const rows = Array.from({ length: count }, (_, i) => ({
        _id: new ObjectId(),
        authorId,
        body: `Timeline fixture ${i}.`,
        language: 'en',
        asks: [],
        kind: 'moment',
        correctionCount: 0,
        answerCount: 0,
        createdAt: new Date(base - i * 1000),
        ...fields,
      }))
      await handle.db.collection(COLLECTIONS.posts).insertMany(rows)
      return rows.map((row) => row._id.toHexString())
    }

    it('has every kind of post in it — asks of every shape, legacy rows and moments', async () => {
      const author = await newUser('tl-shapes-author@example.com')
      const viewer = await newUser('tl-shapes-viewer@example.com')
      const ids: string[] = []
      for (const asks of [[], ['correction'], ['pronunciation'], ['correction', 'pronunciation']]) {
        const created = await app.inject({
          method: 'POST',
          url: '/posts',
          headers: { cookie: author.cookie },
          payload: { body: `Asks ${asks.join('+') || 'nothing'}.`, language: 'en', asks },
        })
        expect(created.statusCode, created.body).toBe(201)
        ids.push(created.json<{ _id: string }>()._id)
      }
      const legacy = new ObjectId()
      await handle.db.collection(COLLECTIONS.posts).insertOne({
        _id: legacy,
        authorId: author.userId,
        body: 'From before the sections.',
        language: 'en',
        correctionCount: 0,
        createdAt: new Date(),
      })

      const byId = new Map((await walkRoute(viewer)).map((item) => [item._id, item]))
      for (const id of [...ids, legacy.toHexString()]) expect(byId.has(id), id).toBe(true)
      expect(byId.get(legacy.toHexString())?.asks).toEqual(['correction'])
      expect(byId.get(ids[0]!)?.asks).toEqual([])
      expect(byId.get(ids[3]!)?.asks).toEqual(['correction', 'pronunciation'])
    })

    it('draws the top reply and the viewer’s like on a mixed page', async () => {
      const author = await newUser('tl-hydrate-author@example.com')
      const helper = await newUser('tl-hydrate-helper@example.com')
      const viewer = await newUser('tl-hydrate-viewer@example.com')
      const written = (await post(author, 'He go home.')).json<{ _id: string }>()._id
      await correct(helper, written, 'He goes home.')
      const spoken = (await ask(author, 'squirrel')).json<{ _id: string }>()._id
      const answerId = (await answer(helper, spoken)).json<{ _id: string }>()._id
      await app.inject({
        method: 'PUT',
        url: '/likes',
        headers: { cookie: viewer.cookie },
        payload: { targetType: 'answer', targetId: answerId },
      })

      // Walked rather than read from page one: where these rank depends on
      // everything else this suite has posted.
      const items = await walkRoute(viewer)
      const correction = items.find((item) => item._id === written)
      const recording = items.find((item) => item._id === spoken)
      expect(correction?.topCorrection?.corrected).toBe('He goes home.')
      expect(recording?.topAnswer?._id).toBe(answerId)
      expect(recording?.topAnswer?.likedByViewer).toBe(true)
    })

    it('walks every page once, across the window and into the tail', async () => {
      const a = await newUser('tl-walk-a@example.com')
      const b = await newUser('tl-walk-b@example.com')
      const viewer = await newUser('tl-walk-viewer@example.com')
      await insertPosts(a.userId, 6)
      await insertPosts(b.userId, 6, { language: 'tr', asks: ['correction'], kind: 'correction' })

      const ids = await walkModule(viewer, { limit: 4, window: 7 })
      expect(new Set(ids).size).toBe(ids.length)
      expect(new Set(ids)).toEqual(new Set(await visiblePostIds()))
    })

    it('neither repeats nor skips when a post in the window is deleted between pages', async () => {
      const a = await newUser('tl-delete-a@example.com')
      const viewer = await newUser('tl-delete-viewer@example.com')
      const fixtures = await insertPosts(a.userId, 8)

      let deleted: string | undefined
      const ids = await walkModule(viewer, { limit: 3, window: 8 }, async (page, served) => {
        if (page !== 0) return
        deleted = fixtures.find((id) => !served.includes(id))
        if (deleted) await deletePost(handle.db, a.userId, deleted)
      })
      expect(deleted).toBeDefined()
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).not.toContain(deleted)
      expect(new Set(ids)).toEqual(new Set(await visiblePostIds()))
    })

    it('never serves a post hidden between one page and the next', async () => {
      const a = await newUser('tl-hide-a@example.com')
      const viewer = await newUser('tl-hide-viewer@example.com')
      const fixtures = await insertPosts(a.userId, 8)

      let hidden: string | undefined
      const ids = await walkModule(viewer, { limit: 3, window: 8 }, async (page, served) => {
        if (page !== 0) return
        hidden = fixtures.find((id) => !served.includes(id))
        if (hidden) {
          await handle.db
            .collection(COLLECTIONS.posts)
            .updateOne({ _id: new ObjectId(hidden) }, { $set: { hiddenAt: new Date() } })
        }
      })
      expect(hidden).toBeDefined()
      expect(ids).not.toContain(hidden)
    })

    it('leaves out a blocked author, in both directions', async () => {
      const rude = await newUser('tl-block-rude@example.com')
      const viewer = await newUser('tl-block-viewer@example.com')
      const theirs = await insertPosts(rude.userId, 3)
      await app.inject({
        method: 'POST',
        url: '/blocks',
        headers: { cookie: rude.cookie },
        payload: { userId: viewer.userId },
      })

      const ids = await walkModule(viewer, { limit: 20, window: 10 })
      for (const id of theirs) expect(ids).not.toContain(id)
    })

    it('does not shift page two when somebody posts in between', async () => {
      const a = await newUser('tl-stable-a@example.com')
      const viewer = await newUser('tl-stable-viewer@example.com')
      await insertPosts(a.userId, 6)

      const first = await modulePage(viewer, 3, null, 6)
      const before = await modulePage(viewer, 3, first.nextCursor, 6)
      await post(a, 'A post written between the two pages.')
      const after = await modulePage(viewer, 3, first.nextCursor, 6)
      expect(after.items.map((item) => item._id)).toEqual(before.items.map((item) => item._id))
    })

    it('refuses a cursor from another ranking version as stale, and a section cursor', async () => {
      const viewer = await newUser('tl-stale-viewer@example.com')
      const stale = `tl${FEED_RANK_VERSION + 1}.t.${Date.now()}-${new ObjectId().toHexString()}`
      const response = await timeline(viewer, `cursor=${encodeURIComponent(stale)}`)
      expect(response.statusCode).toBe(400)
      expect(response.json<{ code: string; reason?: string }>()).toMatchObject({
        code: 'VALIDATION_FAILED',
        reason: 'stale_cursor',
      })

      const section = (await feed(viewer, 'limit=1')).json<{ nextCursor: string | null }>()
      expect(section.nextCursor).not.toBeNull()
      const crossed = await timeline(viewer, `cursor=${encodeURIComponent(section.nextCursor!)}`)
      expect(crossed.statusCode).toBe(400)
    })

    /*
     * The reads the timeline makes, each on the index it was written for — and
     * bounded: the range read has to stop at the floor rather than walk the
     * rest of the collection looking for rows that are not there.
     */
    describe('index use', () => {
      async function explain(filter: Record<string, unknown>, limit: number) {
        const result = (await handle.db
          .collection(COLLECTIONS.posts)
          .find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit)
          .explain('executionStats')) as unknown as {
          executionStats: { totalKeysExamined: number; nReturned: number }
        }
        return { serialized: JSON.stringify(result), stats: result.executionStats }
      }

      it('reads the window, a pinned range and the tail on `recent`', async () => {
        const a = await newUser('tl-explain-a@example.com')
        const fixtures = await insertPosts(a.userId, 10)
        const rows = await handle.db
          .collection(COLLECTIONS.posts)
          .find({ _id: { $in: fixtures.map((id) => new ObjectId(id)) } })
          .sort({ createdAt: -1, _id: -1 })
          .toArray()
        const point = (i: number) => ({ date: rows[i]!.createdAt as Date, id: rows[i]!._id })
        const filter = visibleTo(['someone-blocked'])

        const window = await explain(filter, 10)
        expect(window.serialized).toContain('"indexName":"recent"')
        expect(window.serialized).not.toContain('COLLSCAN')

        const range = await explain({ ...filter, ...withinRange(point(2), point(6)) }, 400)
        expect(range.serialized).toContain('"indexName":"recent"')
        expect(range.serialized).not.toContain('COLLSCAN')
        // Everything in the range — this suite's other posts from the same
        // seconds included — and bounded by it, not by the collection.
        const inRange = await handle.db
          .collection(COLLECTIONS.posts)
          .countDocuments({ ...filter, ...withinRange(point(2), point(6)) })
        expect(range.stats.nReturned).toBe(inRange)
        expect(range.stats.totalKeysExamined).toBeLessThanOrEqual(inRange + 2)
        expect(inRange).toBeLessThan(await handle.db.collection(COLLECTIONS.posts).countDocuments())

        const tail = await explain({ ...filter, ...olderThan(point(6)) }, 3)
        expect(tail.serialized).toContain('"indexName":"recent"')
        expect(tail.serialized).not.toContain('COLLSCAN')
      })

      it('counts the daily post cap on `author`', async () => {
        const result = await handle.db
          .collection(COLLECTIONS.posts)
          .find({ authorId: 'anyone', createdAt: { $gte: new Date(Date.now() - 86_400_000) } })
          .limit(FEED_POSTS_PER_24H + 1)
          .explain('executionStats')
        const serialized = JSON.stringify(result)
        expect(serialized).toContain('"indexName":"author"')
        expect(serialized).not.toContain('COLLSCAN')
      })
    })
  })
})
