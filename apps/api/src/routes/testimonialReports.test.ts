import {
  TESTIMONIAL_UNLOCK_MESSAGES_EACH,
  TESTIMONIAL_UNLOCK_MIN_DAYS,
  type TestimonialPage,
  type TestimonialWriteResult,
} from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { getReport } from '../modules/admin/reports'
import { pairKeyFor } from '../modules/chat/conversations'
import type { Report } from '../modules/moderation/blocks'
import type { TestimonialDoc } from '../modules/testimonials/testimonials'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const DAY_MS = 24 * 60 * 60 * 1000
const EACH = TESTIMONIAL_UNLOCK_MESSAGES_EACH
const BODY = 'Rude and dismissive every time we talked, avoid at all costs.'

function onboardingBody() {
  return {
    handle: `user${Math.random().toString(36).slice(2, 10)}`,
    displayName: 'Test User',
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
  }
}

/**
 * Reporting a review and deciding the report, through the signed link and the
 * panel's read. Mirrors "reporting a comment" in `commentReplies.test.ts`: the
 * review has to be the reported person's own, and hiding it is the
 * moderator's flag, which the profile's owner cannot undo.
 */
describe('reporting a review', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let counter = 0

  async function newUser() {
    counter += 1
    const user = await signUpAndSignIn(app, emailSender, {
      email: `testimonial-report-${counter}@example.com`,
      password: PASSWORD,
      name: 'T',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: onboardingBody(),
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  /** A real thread, then the gate's two inputs set directly. */
  async function talk(a: SignedUpUser, b: SignedUpUser): Promise<void> {
    const pairKey = pairKeyFor(a.userId, b.userId)
    const started = await app.inject({
      method: 'POST',
      url: '/conversations',
      headers: { cookie: a.cookie },
      payload: { toUserId: b.userId, body: 'hi there' },
    })
    if (started.statusCode >= 300) throw new Error(`start failed: ${started.body}`)
    await handle.db.collection(COLLECTIONS.conversations).updateOne(
      { pairKey },
      {
        $set: {
          messageCountBy: { [a.userId]: EACH, [b.userId]: EACH },
          firstMessageAt: new Date(Date.now() - (TESTIMONIAL_UNLOCK_MIN_DAYS + 1) * DAY_MS),
        },
      },
    )
  }

  async function written(author: SignedUpUser, subject: SignedUpUser): Promise<string> {
    await talk(author, subject)
    const response = await app.inject({
      method: 'PUT',
      url: `/testimonials/${subject.userId}`,
      headers: { cookie: author.cookie },
      payload: { body: BODY },
    })
    expect(response.statusCode, response.body).toBeLessThan(300)
    return response.json<TestimonialWriteResult>().testimonial._id
  }

  function report(reporter: SignedUpUser, payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/reports',
      headers: { cookie: reporter.cookie },
      payload,
    })
  }

  async function onProfile(viewer: SignedUpUser, subjectId: string): Promise<string[]> {
    const response = await app.inject({
      method: 'GET',
      url: `/profiles/${subjectId}/testimonials`,
      headers: { cookie: viewer.cookie },
    })
    expect(response.statusCode).toBe(200)
    return response.json<TestimonialPage>().items.map((row) => row._id)
  }

  const reportMails = () =>
    emailSender.messages.filter((message) => message.subject.includes('Report: '))

  function reviewPathFrom(text: string): string {
    const match = /Review: (\S+)/.exec(text)
    if (!match?.[1]) throw new Error(`no review link in mail:\n${text}`)
    const url = new URL(match[1])
    return `${url.pathname}${url.search}`
  }

  const decide = (path: string, action: string) =>
    app.inject({
      method: 'POST',
      url: path,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: new URLSearchParams({ action }).toString(),
    })

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_testimonial_reports_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_testimonial_reports_test',
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
      email: emailSender,
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

  it('must name a review the reported person wrote', async () => {
    const author = await newUser()
    const owner = await newUser()
    const reporter = await newUser()
    const id = await written(author, owner)

    // The profile's owner did not write it, so it is not evidence against them.
    const wrong = await report(reporter, {
      userId: owner.userId,
      reason: 'harassment',
      testimonialId: id,
    })
    expect(wrong.statusCode).toBe(404)
    const malformed = await report(reporter, {
      userId: author.userId,
      reason: 'harassment',
      testimonialId: 'not-an-id',
    })
    expect(malformed.statusCode).toBe(404)
  })

  it('shows it for review, removes it from the profile, and brings it back', async () => {
    const author = await newUser()
    const owner = await newUser()
    const reporter = await newUser()
    const id = await written(author, owner)

    emailSender.messages.length = 0
    const filed = await report(reporter, {
      userId: author.userId,
      reason: 'harassment',
      testimonialId: id,
      // Both ignored beside a review: neither was what was reported.
      postId: new ObjectId().toHexString(),
      commentId: new ObjectId().toHexString(),
    })
    expect(filed.statusCode, filed.body).toBe(201)
    const row = await handle.db
      .collection<Report>(COLLECTIONS.reports)
      .findOne({ testimonialId: new ObjectId(id) })
    expect(row?.postId).toBeUndefined()
    expect(row?.commentId).toBeUndefined()

    // The panel's read carries it.
    const detail = await getReport(handle.db, row!._id.toHexString())
    expect(detail?.aboutTestimonial).toBe(true)
    expect(detail?.testimonial).toMatchObject({
      id,
      body: BODY,
      subject: { userId: owner.userId },
      moderatorHiddenAt: null,
    })

    // The mail quotes the review itself, so most reports can be judged
    // without opening the link.
    const mail = reportMails().at(-1)
    expect(mail?.text).toContain('The review (on ')
    expect(mail?.text).toContain(BODY)
    expect(mail?.html).toContain('<strong>The review</strong>')

    const path = reviewPathFrom(mail?.text ?? '')
    const page = await app.inject({ method: 'GET', url: path })
    expect(page.body).toContain('Rude and dismissive')
    expect(page.body).toContain('Remove this review')
    expect(page.body).not.toContain('Hide this comment')

    expect((await decide(path, 'hide_testimonial')).statusCode).toBe(200)
    const hidden = await handle.db
      .collection<TestimonialDoc>(COLLECTIONS.testimonials)
      .findOne({ _id: new ObjectId(id) })
    expect(hidden?.moderatorHiddenAt).toBeInstanceOf(Date)
    expect(hidden?.ownerHiddenAt).toBeUndefined()
    expect(await onProfile(reporter, owner.userId)).not.toContain(id)
    expect((await app.inject({ method: 'GET', url: path })).body).toContain('Show it again')
    const decided = await handle.db
      .collection<Report>(COLLECTIONS.reports)
      .findOne({ testimonialId: new ObjectId(id) })
    expect(decided?.status).toBe('actioned')

    // The owner cannot undo the moderator's removal.
    const ownerUnhide = await app.inject({
      method: 'POST',
      url: `/me/testimonials/${id}/unhide`,
      headers: { cookie: owner.cookie },
    })
    expect(ownerUnhide.statusCode).toBe(404)
    expect(await onProfile(reporter, owner.userId)).not.toContain(id)

    expect((await decide(path, 'unhide_testimonial')).statusCode).toBe(200)
    expect(await onProfile(reporter, owner.userId)).toContain(id)
  })

  it('will not hide a review from a report that names none', async () => {
    const target = await newUser()
    const reporter = await newUser()
    emailSender.messages.length = 0
    await report(reporter, { userId: target.userId, reason: 'spam' })
    const path = reviewPathFrom(reportMails().at(-1)?.text ?? '')
    expect((await decide(path, 'hide_testimonial')).statusCode).toBe(400)
    expect((await decide(path, 'unhide_testimonial')).statusCode).toBe(400)
  })
})
