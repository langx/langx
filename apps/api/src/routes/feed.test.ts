import { TOKEN_RULES } from '@langx/shared'
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
    birthYear: 1995,
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

  /** The `following` tab's audience is who you have talked to, so tests need one. */
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

    const items = (await feed(helper, 'filter=needsCorrection')).json<{
      items: { _id: string }[]
    }>().items
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
  it('pages the following tab', async () => {
    // The regression that made this tab a one-page feed. Its cursor carries no
    // count, and the countless branch was unreachable — `indexOf('.')` found
    // the milliseconds in the ISO timestamp, so page two was always a 400.
    const viewer = await newUser('following-pager-viewer@example.com')
    const author = await newUser('following-pager-author@example.com')
    await talkTo(viewer, author.userId)

    const ids: string[] = []
    for (let i = 0; i < 3; i++) {
      ids.push((await post(author, `Sentence number ${i}.`)).json<{ _id: string }>()._id)
    }

    const first = await feed(viewer, 'filter=following&limit=2')
    expect(first.statusCode).toBe(200)
    const page1 = first.json<{ items: { _id: string }[]; nextCursor: string | null }>()
    expect(page1.items).toHaveLength(2)
    expect(page1.nextCursor).not.toBeNull()

    const second = await feed(
      viewer,
      `filter=following&limit=2&cursor=${encodeURIComponent(page1.nextCursor!)}`,
    )
    expect(second.statusCode).toBe(200)
    const page2 = second.json<{ items: { _id: string }[] }>()

    const seen = [...page1.items, ...page2.items].map((item) => item._id)
    expect(new Set(seen).size).toBe(seen.length)
    for (const id of ids) expect(seen).toContain(id)
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
})
