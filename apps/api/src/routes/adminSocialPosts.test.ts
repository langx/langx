import { ERROR_CODES, type AdminSocialPostsDto, type SocialPostDto } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import type { AdminAction } from '../modules/admin/auditLog'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { Profile } from '../modules/profiles/profiles'
import { importSocialSlots, type SocialPost } from '../modules/social/posts'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'
const AT = new Date('2026-11-02T17:30:00.000Z')

/**
 * The operator panel's social calendar. Its own file for the reason
 * `adminLinked.test.ts` is: the setup is `admin.test.ts`'s, unchanged.
 */
describe('the social posts panel', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let seq = 0

  async function newUser(): Promise<SignedUpUser> {
    seq++
    const user = await signUpAndSignIn(app, emailSender, {
      email: `social-${seq}@example.com`,
      password: PASSWORD,
      name: 'Test',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `socialuser${seq}`,
        displayName: `User ${seq}`,
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    if (response.statusCode !== 201) {
      throw new Error(`onboarding failed (${response.statusCode}): ${response.body}`)
    }
    return user
  }

  async function newAdmin(): Promise<SignedUpUser> {
    const admin = await newUser()
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: admin.userId }, { $set: { admin: true } })
    return admin
  }

  const get = (user: SignedUpUser, url: string) =>
    app.inject({ method: 'GET', url, headers: { cookie: user.cookie } })

  const post = (user: SignedUpUser, url: string, payload: Record<string, unknown>) =>
    app.inject({ method: 'POST', url, headers: { cookie: user.cookie }, payload })

  const rows = () => handle.db.collection<SocialPost>(COLLECTIONS.socialPosts)

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_admin_social_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_admin_social_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      // One platform connected, so the panel has both answers to show.
      IG_PAGE_TOKEN: 'test-token',
    })
    await ensureIndexes(handle.db)
    emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      email: emailSender,
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

    await importSocialSlots(
      handle.db,
      (['instagram', 'youtube'] as const).map((platform) => ({
        calendarVersion: 1,
        dayOffset: 0,
        platform,
        videoDay: 1,
        lang: 'en',
        videoUrl: 'https://media.langx.io/venus/v1/en/venus-day001-en.mp4',
        coverUrl: 'https://media.langx.io/venus/v1/en/venus-day001-en.jpg',
        scheduledAt: AT,
        content:
          platform === 'youtube'
            ? { title: 'Day 1', description: 'Meet Venus.', tags: ['Venus'] }
            : { caption: 'Day 1.', hashtags: ['#LangXVenus'] },
        firstComment: null,
        nativeCheck: null,
        alternate: null,
      })),
      AT,
    )
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('is for admins only', async () => {
    const member = await newUser()
    const listed = await get(member, '/admin/social-posts')
    expect(listed.statusCode).toBe(403)
    expect(listed.json<{ code: string }>().code).toBe(ERROR_CODES.ADMIN_REQUIRED)

    const id = (await rows().findOne({ platform: 'instagram' }))?._id.toHexString()
    expect(
      (await post(member, `/admin/social-posts/${id}`, { action: 'approve' })).statusCode,
    ).toBe(403)
    expect((await rows().findOne({ platform: 'instagram' }))?.status).toBe('draft')
  })

  it('lists the calendar with the switch, the connections, and a platform filter', async () => {
    const admin = await newAdmin()
    const all = (await get(admin, '/admin/social-posts')).json<AdminSocialPostsDto>()
    expect(all.enabled).toBe(false)
    expect(all.connected).toEqual({
      instagram: true,
      facebook: false,
      youtube: false,
      tiktok: false,
    })
    expect(all.upcoming.map((row) => row.platform).sort()).toEqual(['instagram', 'youtube'])
    expect(all.upcoming[0]?.scheduledAt).toBe(AT.toISOString())

    const youtube = (
      await get(admin, '/admin/social-posts?platform=youtube')
    ).json<AdminSocialPostsDto>()
    expect(youtube.upcoming).toHaveLength(1)
    expect(youtube.upcoming[0]?.content.title).toBe('Day 1')
    expect((await get(admin, '/admin/social-posts?platform=myspace')).statusCode).toBe(400)
  })

  it('approves, skips and retries one row, and writes each to the audit log', async () => {
    const admin = await newAdmin()
    const row = await rows().findOne({ platform: 'instagram' })
    if (!row) throw new Error('no instagram row')
    const id = row._id.toHexString()

    const approved = await post(admin, `/admin/social-posts/${id}`, { action: 'approve' })
    expect(approved.statusCode).toBe(200)
    expect(approved.json<SocialPostDto>().status).toBe('approved')

    // Nothing has failed, so there is nothing to retry: the button says so.
    const retried = await post(admin, `/admin/social-posts/${id}`, { action: 'retry' })
    expect(retried.statusCode).toBe(404)

    await rows().updateOne({ _id: row._id }, { $set: { status: 'failed', lastError: 'boom' } })
    const again = await post(admin, `/admin/social-posts/${id}`, { action: 'retry' })
    expect(again.json<SocialPostDto>()).toMatchObject({ status: 'approved', lastError: null })

    const skipped = await post(admin, `/admin/social-posts/${id}`, { action: 'skip' })
    expect(skipped.json<SocialPostDto>().status).toBe('skipped')

    expect((await post(admin, `/admin/social-posts/${id}`, { action: 'publish' })).statusCode).toBe(
      400,
    )

    const audit = await handle.db
      .collection<AdminAction>(COLLECTIONS.adminActions)
      .find({ refId: id })
      .sort({ at: 1 })
      .toArray()
    expect(audit.map((entry) => entry.action)).toEqual([
      'socialPost.approve',
      'socialPost.retry',
      'socialPost.skip',
    ])
    expect(audit[0]?.payload).toEqual({ platform: 'instagram', dayOffset: 0, status: 'approved' })
  })
})
