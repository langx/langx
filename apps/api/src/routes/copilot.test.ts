import {
  COPILOT_REPORT_MAX_ANSWER_CHARS,
  COPILOT_RULES,
  DEFAULT_APP_CONFIG,
  type AppConfigResponse,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { invalidateAppConfigCache, updateAppConfig } from '../modules/appConfig/appConfig'
import { setCopilotAccess } from '../modules/copilot/access'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { StructuredProvider, StructuredRequest } from '../modules/official/assistantProvider'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

const PASSWORD = 'correct horse battery staple'

/** Stands in for the model: a key is "configured", and nothing leaves the process. */
class FakeModel implements StructuredProvider {
  readonly model = 'fake-model'
  readonly asked: StructuredRequest<unknown>[] = []
  ask<T>(request: StructuredRequest<T>): Promise<T | null> {
    this.asked.push(request)
    return Promise.resolve({ corrected: 'I have an apple.', reason: 'An, before a vowel.' } as T)
  }
}

describe('Copilot over HTTP', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let emailSender: CapturingEmailSender
  let model: FakeModel
  let cookie: string
  let userId: string
  let conversationId: string

  async function setFlag(copilotEnabled: boolean) {
    await updateAppConfig(handle.db, { flags: { ...DEFAULT_APP_CONFIG.flags, copilotEnabled } })
    invalidateAppConfigCache()
  }

  function check(headers: Record<string, string> = {}) {
    return app.inject({
      method: 'POST',
      url: '/copilot/check',
      headers: { cookie, ...headers },
      payload: { conversationId, text: 'I have a apple.' },
    })
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_copilot_route_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_copilot_route_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
    })
    await ensureIndexes(handle.db)
    emailSender = new CapturingEmailSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    model = new FakeModel()
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage: createStorageProvider(env),
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
      email: emailSender,
      copilot: model,
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
      email: 'copilot@example.com',
      password: PASSWORD,
      name: 'Copilot',
    })
    cookie = user.cookie
    userId = user.userId
    const profile = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie },
      payload: {
        handle: 'copilotuser',
        displayName: 'Copilot User',
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    if (profile.statusCode !== 201) throw new Error(`onboarding failed: ${profile.body}`)
    const conversation = await handle.db.collection(COLLECTIONS.conversations).insertOne({
      participants: [user.userId, 'somebody-else'],
      pairKey: `somebody-else_${user.userId}`,
      createdAt: new Date(),
    })
    conversationId = conversation.insertedId.toHexString()
    await setCopilotAccess(handle.db, user.userId, true)
  }, 120_000)

  afterEach(async () => {
    await setFlag(false)
  })

  afterAll(async () => {
    await app?.close()
    await handle?.close()
    await replSet?.stop()
  })

  it('is not offered by /app-config while the switch is off, however a key is configured', async () => {
    const off = await app.inject({ method: 'GET', url: '/app-config' })
    expect(off.json<AppConfigResponse>().copilotService).toBe(false)

    await setFlag(true)
    const on = await app.inject({ method: 'GET', url: '/app-config' })
    expect(on.json<AppConfigResponse>().copilotService).toBe(true)
  })

  it('needs a session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/copilot/check',
      payload: { conversationId, text: 'hello' },
    })
    expect(response.statusCode).toBe(401)
  })

  it('says it is off, and breaks nothing, while the switch is off', async () => {
    const status = await app.inject({ method: 'GET', url: '/copilot', headers: { cookie } })
    expect(status.statusCode).toBe(200)
    expect(status.json()).toMatchObject({ available: false, reason: 'off' })

    const response = await check()
    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({ code: 'COPILOT_UNAVAILABLE', reason: 'off' })
    expect(model.asked).toHaveLength(0)
  })

  it('is off for an account not on the allow-list, with the switch on', async () => {
    await setFlag(true)
    await setCopilotAccess(handle.db, userId, false)
    try {
      const status = await app.inject({ method: 'GET', url: '/copilot', headers: { cookie } })
      expect(status.json()).toMatchObject({ available: false, reason: 'off' })
      const response = await check()
      expect(response.statusCode).toBe(503)
      expect(response.json()).toMatchObject({ code: 'COPILOT_UNAVAILABLE', reason: 'off' })
      expect(model.asked).toHaveLength(0)
    } finally {
      await setCopilotAccess(handle.db, userId, true)
    }
  })

  it('validates Say it before anything else', async () => {
    await setFlag(true)
    const sayIt = (payload: Record<string, unknown>) =>
      app.inject({ method: 'POST', url: '/copilot/say-it', headers: { cookie }, payload })
    const long = await sayIt({
      conversationId,
      text: 'a'.repeat(COPILOT_RULES.maxSayItChars + 1),
      targetLanguage: 'en',
    })
    expect(long.statusCode).toBe(400)
    const noLanguage = await sayIt({ conversationId, text: 'merhaba' })
    expect(noLanguage.statusCode).toBe(400)
    expect(model.asked).toHaveLength(0)
  })

  it('asks for consent, records it, answers in the reader language, and stops when it is withdrawn', async () => {
    await setFlag(true)

    const before = await check()
    expect(before.statusCode).toBe(409)
    expect(before.json()).toMatchObject({ code: 'COPILOT_CONSENT_REQUIRED' })
    expect(model.asked).toHaveLength(0)

    const stale = await app.inject({
      method: 'POST',
      url: '/copilot/consent',
      headers: { cookie },
      payload: { version: COPILOT_RULES.consentVersion + 1 },
    })
    expect(stale.statusCode).toBe(400)

    const consent = await app.inject({
      method: 'POST',
      url: '/copilot/consent',
      headers: { cookie },
      payload: { version: COPILOT_RULES.consentVersion },
    })
    expect(consent.statusCode).toBe(204)
    const status = await app.inject({ method: 'GET', url: '/copilot', headers: { cookie } })
    expect(status.json()).toMatchObject({ available: true, reason: null, consented: true })

    const answer = await check({ 'accept-language': 'tr' })
    expect(answer.statusCode).toBe(200)
    expect(answer.json()).toEqual({
      source: 'ai',
      cached: false,
      result: {
        action: 'check',
        corrected: 'I have an apple.',
        changed: true,
        reason: 'An, before a vowel.',
      },
    })
    expect(JSON.parse(model.asked[0]?.prompt ?? '{}')).toMatchObject({ readerLanguage: 'Turkish' })

    const withdraw = await app.inject({
      method: 'DELETE',
      url: '/copilot/consent',
      headers: { cookie },
    })
    expect(withdraw.statusCode).toBe(204)
    expect((await check()).statusCode).toBe(409)
    expect(model.asked).toHaveLength(1)
  })

  describe('reporting an answer', () => {
    function report(
      payload: Record<string, unknown>,
      headers: Record<string, string> = { cookie },
    ) {
      return app.inject({ method: 'POST', url: '/copilot/report', headers, payload })
    }
    const feedback = () => handle.db.collection(COLLECTIONS.feedback)

    afterEach(async () => {
      await feedback().deleteMany({})
      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne({ _id: userId as never }, { $unset: { admin: '' } })
    })

    it('needs a session', async () => {
      const response = await report({ action: 'explain', answer: 'It means hello.' }, {})
      expect(response.statusCode).toBe(401)
      expect(await feedback().countDocuments()).toBe(0)
    })

    it('is refused for an account not on the allow-list', async () => {
      await setCopilotAccess(handle.db, userId, false)
      try {
        const response = await report({ action: 'explain', answer: 'It means hello.' })
        expect(response.statusCode).toBe(403)
        expect(await feedback().countDocuments()).toBe(0)
      } finally {
        await setCopilotAccess(handle.db, userId, true)
      }
    })

    it('validates the report', async () => {
      const refused = [
        // The question of an Explain or Reply ideas is the other person's message.
        { action: 'explain', answer: 'It means hello.', question: 'merhaba' },
        { action: 'replyIdeas', answer: 'Sure!', question: 'what they said' },
        { action: 'check', answer: '   ' },
        { action: 'check', answer: 'a'.repeat(COPILOT_REPORT_MAX_ANSWER_CHARS + 1) },
        { action: 'check', answer: 'ok', question: 'a'.repeat(COPILOT_RULES.maxCheckChars + 1) },
        { action: 'translate', answer: 'ok' },
        { answer: 'ok' },
      ]
      for (const payload of refused) {
        expect((await report(payload)).statusCode, JSON.stringify(payload)).toBe(400)
      }
      expect(await feedback().countDocuments()).toBe(0)
    })

    it('puts the answer, and the draft only when sent, in the operators’ feedback queue', async () => {
      const mailsBefore = emailSender.messages.length
      const withDraft = await report({
        action: 'check',
        answer: 'I have an apple.\nAn, before a vowel.',
        question: 'I have a apple.',
      })
      expect(withDraft.statusCode).toBe(202)
      const withoutDraft = await report({ action: 'explain', answer: 'It means hello.' })
      expect(withoutDraft.statusCode).toBe(202)

      // The row is the whole record: no mail with the draft in it.
      expect(emailSender.messages).toHaveLength(mailsBefore)

      const member = await app.inject({
        method: 'GET',
        url: '/admin/feedback',
        headers: { cookie },
      })
      expect(member.statusCode).toBe(403)

      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne({ _id: userId as never }, { $set: { admin: true } })
      const list = await app.inject({ method: 'GET', url: '/admin/feedback', headers: { cookie } })
      expect(list.statusCode).toBe(200)
      const items = list.json<{ items: Record<string, unknown>[] }>().items
      expect(items).toHaveLength(2)
      expect(items[0]).toMatchObject({
        kind: 'copilot',
        status: 'open',
        body: 'I have an apple.\nAn, before a vowel.',
        attachmentUrls: [],
        copilot: { action: 'check', question: 'I have a apple.' },
        sender: { userId, handle: 'copilotuser' },
      })
      expect(items[0]).not.toHaveProperty('issueUrl')
      // In the sender's language, as every reply draft is.
      expect(items[0]?.replyDraft).toContain('Copilot')
      expect(items[0]?.replyDraft).toContain('teşekkürler')
      expect(items[1]).toMatchObject({ kind: 'copilot', copilot: { action: 'explain' } })
      expect((items[1]?.copilot as Record<string, unknown>).question).toBeUndefined()
    })
  })
})
