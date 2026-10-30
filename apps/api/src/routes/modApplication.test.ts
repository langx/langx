import { MOD_APPLICATION_MIN_STREAK } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'

const ANSWERS = {
  why: 'I spend every evening here and want the place to stay kind.',
  experience: 'I ran a Discord server for language learners for two years.',
  situation: 'I would read the whole conversation before deciding anything.',
  time: 'About an hour a day, mostly in the evenings, Istanbul time.',
}

describe('POST /mod-application', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let cookie: string
  let userId: string

  const feedback = () => handle.db.collection(COLLECTIONS.feedback)
  const setProfile = (set: Record<string, unknown>) =>
    handle.db.collection(COLLECTIONS.profiles).updateOne({ _id: userId as never }, { $set: set })
  const apply = (payload: object = { answers: ANSWERS }) =>
    app.inject({ method: 'POST', url: '/mod-application', headers: { cookie }, payload })
  const status = async () =>
    (await app.inject({ method: 'GET', url: '/mod-application', headers: { cookie } })).json<{
      open: boolean
    }>()

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_mod_application_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_mod_application_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })
    await ensureIndexes(handle.db)
    const emailSender = new CapturingEmailSender()
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

    const user = await signUpAndSignIn(app, emailSender, {
      email: 'applicant@example.com',
      password: PASSWORD,
      name: 'Applicant',
    })
    cookie = user.cookie
    userId = user.userId
    const profile = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie },
      payload: {
        handle: 'applicant',
        displayName: 'Applicant',
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    if (profile.statusCode !== 201) throw new Error(`onboarding failed: ${profile.body}`)
  }, 120_000)

  afterEach(async () => {
    await feedback().deleteMany({})
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne({ _id: userId as never }, { $unset: { moderator: '' } })
  })

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('is refused below the streak, and writes nothing', async () => {
    await setProfile({ 'streak.current': MOD_APPLICATION_MIN_STREAK - 1 })
    const response = await apply()
    expect(response.statusCode).toBe(403)
    expect(await feedback().countDocuments()).toBe(0)
  })

  it('files a row in the feedback queue, with the streak it was made on', async () => {
    await setProfile({ 'streak.current': MOD_APPLICATION_MIN_STREAK })
    expect(await status()).toEqual({ open: false })

    const response = await apply()
    expect(response.statusCode).toBe(202)

    const rows = await feedback().find({}).toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      userId,
      kind: 'modApplication',
      status: 'open',
      modApplication: { streak: MOD_APPLICATION_MIN_STREAK, answers: ANSWERS },
    })
    expect(rows[0]?.issueUrl).toBeUndefined()
    expect(await status()).toEqual({ open: true })
  })

  it('keeps one open application per person', async () => {
    await setProfile({ 'streak.current': MOD_APPLICATION_MIN_STREAK })
    expect((await apply()).statusCode).toBe(202)
    expect((await apply()).statusCode).toBe(202)
    expect(await feedback().countDocuments()).toBe(1)
  })

  it('refuses a short answer', async () => {
    await setProfile({ 'streak.current': MOD_APPLICATION_MIN_STREAK })
    const response = await apply({ answers: { ...ANSWERS, why: 'fun' } })
    expect(response.statusCode).toBe(400)
    expect(await feedback().countDocuments()).toBe(0)
  })

  it('refuses somebody who already moderates', async () => {
    await setProfile({
      'streak.current': MOD_APPLICATION_MIN_STREAK,
      moderator: { since: new Date(), by: 'operator' },
    })
    expect((await apply()).statusCode).toBe(403)
    expect(await feedback().countDocuments()).toBe(0)
  })
})
