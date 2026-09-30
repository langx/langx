import {
  TESTIMONIAL_UNLOCK_MESSAGES_EACH,
  TESTIMONIAL_UNLOCK_MIN_DAYS,
  type ReceivedTestimonialsPage,
  type TestimonialPage,
  type TestimonialWriteResult,
  type WrittenTestimonialsPage,
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
import { encodeDateIdCursor } from '../lib/dateIdCursor'
import { pairKeyFor } from '../modules/chat/conversations'
import { ensureOfficialAccounts, officialIds } from '../modules/official/accounts'
import {
  purgeTestimonialsOf,
  setTestimonialModeratorHidden,
  testimonialsForExport,
} from '../modules/testimonials/testimonials'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const DAY_MS = 24 * 60 * 60 * 1000
const EACH = TESTIMONIAL_UNLOCK_MESSAGES_EACH
const BODY = 'A patient partner who corrected my Turkish every single day.'

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

describe('testimonials', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let counter = 0

  async function newUser() {
    counter += 1
    const user = await signUpAndSignIn(app, emailSender, {
      email: `testimonial-${counter}@example.com`,
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

  /**
   * A real thread through the real endpoint, then the gate's two inputs set
   * directly — sending a hundred messages through HTTP would test the chat,
   * not this.
   */
  async function talk(
    a: SignedUpUser,
    b: SignedUpUser,
    counts: [number, number] = [EACH, EACH],
    daysAgo = TESTIMONIAL_UNLOCK_MIN_DAYS + 1,
  ): Promise<ObjectId> {
    const pairKey = pairKeyFor(a.userId, b.userId)
    const conversations = handle.db.collection(COLLECTIONS.conversations)
    if (!(await conversations.findOne({ pairKey }))) {
      const started = await app.inject({
        method: 'POST',
        url: '/conversations',
        headers: { cookie: a.cookie },
        payload: { toUserId: b.userId, body: 'hi there' },
      })
      if (started.statusCode >= 300) throw new Error(`start failed: ${started.body}`)
    }
    await conversations.updateOne(
      { pairKey },
      {
        $set: {
          messageCountBy: { [a.userId]: counts[0], [b.userId]: counts[1] },
          firstMessageAt: new Date(Date.now() - daysAgo * DAY_MS),
        },
      },
    )
    const conversation = await conversations.findOne({ pairKey })
    return conversation!._id
  }

  function write(author: SignedUpUser, subjectId: string, body = BODY) {
    return app.inject({
      method: 'PUT',
      url: `/testimonials/${subjectId}`,
      headers: { cookie: author.cookie },
      payload: { body },
    })
  }

  async function profileList(viewer: SignedUpUser, subjectId: string, qs = '') {
    const response = await app.inject({
      method: 'GET',
      url: `/profiles/${subjectId}/testimonials${qs ? `?${qs}` : ''}`,
      headers: { cookie: viewer.cookie },
    })
    return response
  }

  async function mine<T extends 'received' | 'written'>(
    user: SignedUpUser,
    tab: T,
  ): Promise<T extends 'written' ? WrittenTestimonialsPage : ReceivedTestimonialsPage> {
    const response = await app.inject({
      method: 'GET',
      url: `/me/testimonials?tab=${tab}`,
      headers: { cookie: user.cookie },
    })
    expect(response.statusCode).toBe(200)
    return response.json()
  }

  function setHidden(user: SignedUpUser, id: string, hidden: boolean) {
    return app.inject({
      method: 'POST',
      url: `/me/testimonials/${id}/${hidden ? 'hide' : 'unhide'}`,
      headers: { cookie: user.cookie },
    })
  }

  function block(blocker: SignedUpUser, userId: string) {
    return app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { cookie: blocker.cookie },
      payload: { userId },
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_testimonials_test')

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_testimonials_test',
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
    // `index.ts` does this at boot; `buildApp` does not, and the official
    // refusal needs the accounts to exist.
    await ensureOfficialAccounts(handle.db, 'http://localhost:4000')

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

  describe('the gate', () => {
    it('opens at the threshold on both sides and not one message before', async () => {
      const a = await newUser()
      const b = await newUser()

      await talk(a, b, [EACH - 1, EACH])
      const early = await write(a, b.userId)
      expect(early.statusCode).toBe(409)
      expect(early.json<{ code: string }>().code).toBe('TESTIMONIAL_LOCKED')
      expect((await profileList(a, b.userId)).json<TestimonialPage>().viewer).toBe('locked')

      await talk(a, b, [EACH, EACH])
      expect((await profileList(a, b.userId)).json<TestimonialPage>().viewer).toBe('can_write')
      const ok = await write(a, b.userId)
      expect(ok.statusCode).toBe(200)
      expect(ok.json<TestimonialWriteResult>().created).toBe(true)
      // Symmetric: the other side is unlocked by the same thread.
      expect((await write(b, a.userId)).statusCode).toBe(200)
    })

    it('refuses a one-sided thread', async () => {
      const a = await newUser()
      const b = await newUser()
      await talk(a, b, [EACH * 2, 0])
      expect((await write(a, b.userId)).statusCode).toBe(409)
      expect((await write(b, a.userId)).statusCode).toBe(409)
    })

    it('refuses a thread younger than the minimum days', async () => {
      const a = await newUser()
      const b = await newUser()
      await talk(a, b, [EACH, EACH], TESTIMONIAL_UNLOCK_MIN_DAYS - 1)
      expect((await write(a, b.userId)).statusCode).toBe(409)
    })

    it('refuses without any thread, and about yourself', async () => {
      const a = await newUser()
      const b = await newUser()
      expect((await write(a, b.userId)).statusCode).toBe(409)
      expect((await write(a, a.userId)).statusCode).toBe(400)
    })

    it('refuses an official account on the receiving end', async () => {
      const a = await newUser()
      const officialId = officialIds().get('langx')
      expect(officialId).toBeDefined()
      await handle.db.collection(COLLECTIONS.conversations).insertOne({
        _id: new ObjectId(),
        pairKey: pairKeyFor(a.userId, officialId!),
        participants: [officialId!, a.userId],
        lastMessage: { body: 'hi', senderId: officialId!, createdAt: new Date() },
        unread: {},
        firstMessageBy: officialId!,
        firstMessageAt: new Date(Date.now() - 30 * DAY_MS),
        bothSpoke: true,
        messageCount: EACH * 2,
        messageCountBy: { [officialId!]: EACH, [a.userId]: EACH },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const refused = await write(a, officialId!)
      expect(refused.statusCode).toBe(409)
      expect(refused.json<{ code: string }>().code).toBe('TESTIMONIAL_LOCKED')
    })

    it('treats a blocked subject as absent, in either direction', async () => {
      const a = await newUser()
      const b = await newUser()
      await talk(a, b)
      await block(b, a.userId)
      expect((await write(a, b.userId)).statusCode).toBe(404)
      expect((await write(b, a.userId)).statusCode).toBe(404)
    })

    it('refuses a body outside the length bounds', async () => {
      const a = await newUser()
      const b = await newUser()
      await talk(a, b)
      expect((await write(a, b.userId, 'too short')).statusCode).toBe(400)
    })
  })

  describe('writing twice', () => {
    it('makes one row out of two submissions at once, and the second is an edit', async () => {
      const a = await newUser()
      const b = await newUser()
      await talk(a, b)

      const [first, second] = await Promise.all([
        write(a, b.userId, `${BODY} First.`),
        write(a, b.userId, `${BODY} Second.`),
      ])
      expect(first.statusCode).toBe(200)
      expect(second.statusCode).toBe(200)
      const created = [first, second].map((r) => r.json<TestimonialWriteResult>().created)
      expect(created.filter(Boolean)).toHaveLength(1)
      const rows = await handle.db
        .collection(COLLECTIONS.testimonials)
        .countDocuments({ authorId: a.userId, subjectId: b.userId })
      expect(rows).toBe(1)
    })

    it('keeps the owner hiding through an edit', async () => {
      const a = await newUser()
      const b = await newUser()
      await talk(a, b)
      const id = (await write(a, b.userId)).json<TestimonialWriteResult>().testimonial._id
      expect((await setHidden(b, id, true)).statusCode).toBe(204)

      const edited = await write(a, b.userId, `${BODY} Edited.`)
      expect(edited.json<TestimonialWriteResult>()).toMatchObject({
        created: false,
        testimonial: { body: `${BODY} Edited.` },
      })
      expect(edited.json<TestimonialWriteResult>().testimonial.editedAt).not.toBeNull()
      const received = await mine(b, 'received')
      expect(received.items.find((row) => row._id === id)?.hidden).toBe(true)
    })

    it('refuses to edit one a moderator removed, and shows it removed to the author', async () => {
      const a = await newUser()
      const b = await newUser()
      await talk(a, b)
      const id = (await write(a, b.userId)).json<TestimonialWriteResult>().testimonial._id
      expect(await setTestimonialModeratorHidden(handle.db, new ObjectId(id), true)).toBe(true)
      expect(await setTestimonialModeratorHidden(handle.db, new ObjectId(id), true)).toBe(false)

      const refused = await write(a, b.userId, `${BODY} Again.`)
      expect(refused.statusCode).toBe(409)
      expect(refused.json<{ code: string }>().code).toBe('TESTIMONIAL_REMOVED')

      const written = await mine(a, 'written')
      expect(written.items.find((row) => row._id === id)?.removed).toBe(true)
      // Invisible to everyone else, the owner included, and not the author's
      // `mine` on the profile either.
      expect((await mine(b, 'received')).items.some((row) => row._id === id)).toBe(false)
      const onProfile = (await profileList(a, b.userId)).json<TestimonialPage>()
      expect(onProfile.items).toHaveLength(0)
      expect(onProfile.mine).toBeNull()
      expect(onProfile.viewer).toBe('written')
      // The owner cannot undo a moderator's removal.
      expect((await setHidden(b, id, false)).statusCode).toBe(404)
    })
  })

  describe('reading', () => {
    it('hides an owner-hidden one from others but not from its author, who is not told', async () => {
      const a = await newUser()
      const b = await newUser()
      const stranger = await newUser()
      await talk(a, b)
      const id = (await write(a, b.userId)).json<TestimonialWriteResult>().testimonial._id
      await setHidden(b, id, true)

      const forStranger = (await profileList(stranger, b.userId)).json<TestimonialPage>()
      expect(forStranger.items).toHaveLength(0)
      expect(forStranger.total).toBe(0)
      expect(forStranger.viewer).toBe('locked')

      const forOwner = (await profileList(b, b.userId)).json<TestimonialPage>()
      expect(forOwner.viewer).toBe('self')
      expect(forOwner.total).toBe(0)

      const forAuthor = (await profileList(a, b.userId)).json<TestimonialPage>()
      expect(forAuthor.total).toBe(1)
      expect(forAuthor.items[0]).toMatchObject({ _id: id, mine: true })
      expect(forAuthor.items[0]).not.toHaveProperty('hidden')
      expect(forAuthor.mine).toMatchObject({ _id: id })
      expect(forAuthor.viewer).toBe('written')

      expect((await setHidden(b, id, false)).statusCode).toBe(204)
      expect((await profileList(stranger, b.userId)).json<TestimonialPage>().total).toBe(1)
    })

    it('filters blocks in both directions and 404s a blocked profile', async () => {
      const subject = await newUser()
      const author = await newUser()
      const viewer = await newUser()
      await talk(author, subject)
      await write(author, subject.userId)
      expect((await profileList(viewer, subject.userId)).json<TestimonialPage>().total).toBe(1)

      // The viewer blocked the author.
      await block(viewer, author.userId)
      const afterViewerBlock = (await profileList(viewer, subject.userId)).json<TestimonialPage>()
      expect(afterViewerBlock.items).toHaveLength(0)
      expect(afterViewerBlock.total).toBe(0)

      // The subject blocked the author: gone for everybody, and not deleted.
      const other = await newUser()
      expect((await profileList(other, subject.userId)).json<TestimonialPage>().total).toBe(1)
      await block(subject, author.userId)
      expect((await profileList(other, subject.userId)).json<TestimonialPage>().total).toBe(0)
      expect(
        await handle.db
          .collection(COLLECTIONS.testimonials)
          .countDocuments({ authorId: author.userId }),
      ).toBe(1)

      await block(other, subject.userId)
      expect((await profileList(other, subject.userId)).statusCode).toBe(404)
    })

    it('leaves out authors pending deletion, and the total agrees', async () => {
      const subject = await newUser()
      const gone = await newUser()
      const staying = await newUser()
      const viewer = await newUser()
      await talk(gone, subject)
      await talk(staying, subject)
      await write(gone, subject.userId)
      await write(staying, subject.userId)
      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne({ _id: gone.userId as never }, { $set: { deletedAt: new Date() } })

      const page = (await profileList(viewer, subject.userId)).json<TestimonialPage>()
      expect(page.items.map((row) => row.author._id)).toEqual([staying.userId])
      expect(page.total).toBe(1)
    })

    it('pages newest first with a total that matches what can be paged', async () => {
      const subject = await newUser()
      const viewer = await newUser()
      const authors = [await newUser(), await newUser(), await newUser()]
      for (const author of authors) {
        await talk(author, subject)
        await write(author, subject.userId)
      }

      const first = (await profileList(viewer, subject.userId, 'limit=2')).json<TestimonialPage>()
      expect(first.total).toBe(3)
      expect(first.items).toHaveLength(2)
      expect(first.items[0]!.author._id).toBe(authors[2]!.userId)
      expect(first.nextCursor).not.toBeNull()
      const second = (
        await profileList(
          viewer,
          subject.userId,
          `limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`,
        )
      ).json<TestimonialPage>()
      expect(second.items).toHaveLength(1)
      expect(second.nextCursor).toBeNull()
    })
  })

  describe('authorization', () => {
    it('404s hiding somebody else’s testimonial or a malformed id', async () => {
      const a = await newUser()
      const b = await newUser()
      const stranger = await newUser()
      await talk(a, b)
      const id = (await write(a, b.userId)).json<TestimonialWriteResult>().testimonial._id

      expect((await setHidden(stranger, id, true)).statusCode).toBe(404)
      // The author is not the owner either.
      expect((await setHidden(a, id, true)).statusCode).toBe(404)
      expect((await setHidden(b, 'not-an-id', true)).statusCode).toBe(404)
      expect((await setHidden(b, new ObjectId().toHexString(), true)).statusCode).toBe(404)
    })

    it('lets only the author delete, idempotently', async () => {
      const a = await newUser()
      const b = await newUser()
      await talk(a, b)
      await write(a, b.userId)

      // The subject "deleting" about a removes only a row b wrote — none.
      const bySubject = await app.inject({
        method: 'DELETE',
        url: `/testimonials/${a.userId}`,
        headers: { cookie: b.cookie },
      })
      expect(bySubject.statusCode).toBe(204)
      expect((await mine(b, 'received')).items).toHaveLength(1)

      for (let i = 0; i < 2; i++) {
        const byAuthor = await app.inject({
          method: 'DELETE',
          url: `/testimonials/${b.userId}`,
          headers: { cookie: a.cookie },
        })
        expect(byAuthor.statusCode).toBe(204)
      }
      expect((await mine(b, 'received')).items).toHaveLength(0)
    })
  })

  describe('the thread', () => {
    it('carries the state on the first page only', async () => {
      const a = await newUser()
      const b = await newUser()
      const conversationId = await talk(a, b)

      const first = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId.toHexString()}/messages`,
        headers: { cookie: a.cookie },
      })
      expect(first.json<{ testimonial?: unknown }>().testimonial).toEqual({
        unlocked: true,
        written: false,
      })

      await write(a, b.userId)
      const again = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId.toHexString()}/messages`,
        headers: { cookie: a.cookie },
      })
      expect(again.json<{ testimonial?: unknown }>().testimonial).toEqual({
        unlocked: true,
        written: true,
      })

      const cursor = encodeDateIdCursor(new Date(), new ObjectId())
      const older = await app.inject({
        method: 'GET',
        url: `/conversations/${conversationId.toHexString()}/messages?cursor=${encodeURIComponent(cursor)}`,
        headers: { cookie: a.cookie },
      })
      expect(older.statusCode).toBe(200)
      expect(older.json<Record<string, unknown>>()).not.toHaveProperty('testimonial')
    })
  })

  describe('purge and export', () => {
    it('exports both directions and purges both', async () => {
      const a = await newUser()
      const b = await newUser()
      await talk(a, b)
      await write(a, b.userId)
      await write(b, a.userId)

      const exported = await testimonialsForExport(handle.db, a.userId)
      expect(exported.written).toHaveLength(1)
      expect(exported.received).toHaveLength(1)
      expect(await purgeTestimonialsOf(handle.db, a.userId)).toBe(2)
      expect((await mine(b, 'written')).items).toHaveLength(0)
    })
  })
})
