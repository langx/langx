import { DEFAULT_APP_CONFIG, type ProWeekRecapResponse } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { updateAppConfig } from '../modules/appConfig/appConfig'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { ProGift } from '../modules/billing/proGifts'
import type { Profile } from '../modules/profiles/profiles'
import { createStorageProvider } from '../storage/createStorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { CapturingEmailSender, signUpAndSignIn, type SignedUpUser } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'

/**
 * The Pro Week's three gates at the door it is given through, `POST
 * /profiles`: the switch, the app's declaration, and the account. With the
 * switch off — the default — nothing about onboarding may change.
 */
describe('POST /profiles and the Pro Week', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let seq = 0

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_pro_week_routes')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_pro_week_routes',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      REVENUECAT_FAKE_STORE: 'true',
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
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    await setFlag(false)
  })

  async function setFlag(on: boolean) {
    await updateAppConfig(handle.db, { flags: { ...DEFAULT_APP_CONFIG.flags, proWeek: on } })
  }

  async function onboard(body: Record<string, unknown> = {}): Promise<SignedUpUser> {
    seq++
    const user = await signUpAndSignIn(app, emailSender, {
      email: `pro-week-${seq}@example.com`,
      password: PASSWORD,
      name: 'Sofia',
    })
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `sofia${seq}`,
        displayName: 'Sofia',
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
        ...body,
      },
    })
    expect(response.statusCode, response.body).toBe(201)
    return user
  }

  const stored = (user: SignedUpUser) =>
    handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: user.userId })
  const weeks = (user: SignedUpUser) =>
    handle.db.collection<ProGift>(COLLECTIONS.proGifts).countDocuments({ userId: user.userId })

  it('changes nothing with the switch off, whatever the app declares', async () => {
    const user = await onboard({ supportsProWeek: true })
    const profile = await stored(user)
    expect(profile?.entitlement.tier).toBe('free')
    expect(profile?.proWeek).toBeUndefined()
    expect(await weeks(user)).toBe(0)
  })

  it('gives no week to an app that does not declare it', async () => {
    await setFlag(true)
    const user = await onboard()
    expect((await stored(user))?.entitlement.tier).toBe('free')
    expect(await weeks(user)).toBe(0)
  })

  it('gives no week to a 16- or 17-year-old', async () => {
    await setFlag(true)
    const year = new Date().getUTCFullYear() - 17
    const user = await onboard({ supportsProWeek: true, birthDate: `${year}-12-31` })
    expect((await stored(user))?.entitlement.tier).toBe('free')
    expect(await weeks(user)).toBe(0)
  })

  it('starts the week for an adult on an app that declares it, and answers with it', async () => {
    await setFlag(true)
    seq++
    const user = await signUpAndSignIn(app, emailSender, {
      email: `pro-week-${seq}@example.com`,
      password: PASSWORD,
      name: 'Sofia',
    })
    emailSender.messages.length = 0
    const response = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: `sofia${seq}`,
        displayName: 'Sofia',
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
        supportsProWeek: true,
      },
    })
    expect(response.statusCode, response.body).toBe(201)
    const body = response.json<{
      entitlement: { tier: string; store: string }
      proWeek?: { startedAt?: unknown; endsAt?: unknown }
    }>()
    expect(body.entitlement).toMatchObject({ store: 'gift' })
    expect(typeof body.proWeek?.startedAt).toBe('string')
    expect(typeof body.proWeek?.endsAt).toBe('string')
    expect(await weeks(user)).toBe(1)
    // The welcome mail goes as for anybody; nothing about Pro does.
    expect(emailSender.messages.map((m) => m.subject).join(' ')).not.toMatch(/Pro/)

    const recap = await app.inject({
      method: 'GET',
      url: '/me/pro-week',
      headers: { cookie: user.cookie },
    })
    // Day one: nothing to recap yet.
    expect(recap.json<ProWeekRecapResponse>()).toEqual({ recap: null })
  })
})
