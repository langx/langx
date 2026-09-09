import { MAX_IMAGE_BYTES } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { warmUpAuthCollections } from '../auth/warmUp'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import type { StorageProvider, UploadUrl } from '../storage/StorageProvider'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { LoggingPushSender } from '../modules/push/devices'
import { CapturingEmailSender, signUpAndSignIn } from '../testSupport/authFlow'

const PASSWORD = 'correct horse battery staple'
const PUBLIC_BASE = 'https://media.example.test'
const SUPPORT = 'bugs@example.test'

/** Signs nothing; remembers which key it was asked for. */
class KeyRecordingStorage implements StorageProvider {
  readonly keys: string[] = []

  getUploadUrl(key: string, contentType: string): Promise<UploadUrl> {
    this.keys.push(key)
    return Promise.resolve({
      uploadUrl: `${PUBLIC_BASE}/${key}?signed`,
      publicUrl: `${PUBLIC_BASE}/${key}`,
      contentType,
      expiresInSeconds: 300,
    })
  }
}

describe('feedback', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance
  let storage: KeyRecordingStorage
  let emailSender: CapturingEmailSender
  let pushSender: LoggingPushSender
  let cookie: string
  let userId: string

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_feedback_test')
    await ensureIndexes(handle.db)

    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_feedback_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      STORAGE_PUBLIC_BASE_URL: PUBLIC_BASE,
      SUPPORT_EMAIL: SUPPORT,
    })

    emailSender = new CapturingEmailSender()
    pushSender = new LoggingPushSender()
    const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
    storage = new KeyRecordingStorage()
    app = await buildApp({
      env,
      client: handle.client,
      db: handle.db,
      auth,
      storage,
      email: emailSender,
      push: pushSender,
      translation: createTranslationProvider(env),
      revenueCat: createRevenueCatClientFromEnv(env),
    })
    await app.ready()

    /*
     * A fresh database's first write to Better Auth's collections races its own
     * index creation and comes back a 500 — see `warmUpAuthCollections`. Every
     * suite that signs somebody up pays it; paying it here, deliberately, is
     * what stops it landing on the sign-up below.
     */
    await warmUpAuthCollections(auth, handle.db, { warn: () => {} })
    emailSender.messages.length = 0

    const user = await signUpAndSignIn(app, emailSender, {
      email: 'finder@example.com',
      password: PASSWORD,
      name: 'Bug Finder',
    })
    cookie = user.cookie
    userId = user.userId

    const created = await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie },
      payload: {
        handle: 'bugfinder',
        displayName: 'Bug Finder',
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      },
    })
    expect(created.statusCode, created.body).toBe(201)
  }, 120_000)

  afterAll(async () => {
    await app?.close()
    await handle?.client.close()
    await replSet?.stop()
  })

  beforeEach(() => {
    emailSender.messages.length = 0
  })

  function report(payload: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/feedback',
      headers: { cookie },
      payload: { kind: 'bug', ...payload },
    })
  }

  it('mails the report to the support address, replying to the sender', async () => {
    const response = await report({
      body: 'The wallet screen shows a negative balance after a gift is refused.',
    })

    expect(response.statusCode, response.body).toBe(202)
    const mail = emailSender.messages.at(-1)
    expect(mail?.to).toBe(SUPPORT)
    expect(mail?.text).toContain('negative balance')
    expect(mail?.text).toContain('@bugfinder')
    expect(mail?.text).toContain(userId)
    expect(mail?.headers?.['Reply-To']).toBe('finder@example.com')
  })

  it('carries the proof as links', async () => {
    const response = await report({
      body: 'Here is what the wallet screen looks like when it happens.',
      attachments: [
        {
          url: `${PUBLIC_BASE}/feedback/${userId}/proof.jpg`,
          contentType: 'image/jpeg',
          sizeBytes: 1024,
        },
      ],
    })

    expect(response.statusCode, response.body).toBe(202)
    expect(emailSender.messages.at(-1)?.text).toContain(`${PUBLIC_BASE}/feedback/`)
  })

  it('refuses proof that is not in our own bucket', async () => {
    const response = await report({
      body: 'The wallet screen shows a negative balance after a refused gift.',
      attachments: [
        { url: 'https://elsewhere.example/proof.jpg', contentType: 'image/jpeg', sizeBytes: 1024 },
      ],
    })

    expect(response.statusCode).toBe(400)
    expect(emailSender.messages).toHaveLength(0)
  })

  it('refuses proof that is over the ceiling for its kind', async () => {
    const response = await report({
      body: 'The wallet screen shows a negative balance after a refused gift.',
      attachments: [
        {
          url: `${PUBLIC_BASE}/feedback/${userId}/proof.jpg`,
          contentType: 'image/jpeg',
          sizeBytes: MAX_IMAGE_BYTES + 1,
        },
      ],
    })

    expect(response.statusCode).toBe(413)
    expect(emailSender.messages).toHaveLength(0)
  })

  it('mails a feature request as one, with a link that would file it as a feature', async () => {
    const response = await report({
      kind: 'feature',
      body: 'A dark theme for the web app would help at night.',
    })

    expect(response.statusCode, response.body).toBe(202)
    // Nothing of ours to fetch afterwards, so the answer says only that it landed.
    expect(response.json()).toEqual({ ok: true })

    const mail = emailSender.messages.at(-1)
    expect(mail?.subject).toBe('Feature request from @bugfinder')
    expect(mail?.text).toContain('https://github.com/langx/langx/issues/new')
    expect(mail?.text).toContain('labels=feature')
  })

  it('refuses a kind it does not have', async () => {
    const response = await report({
      kind: 'complaint',
      body: 'The wallet screen shows a negative balance after a refused gift.',
    })

    expect(response.statusCode).toBe(400)
    expect(emailSender.messages).toHaveLength(0)
  })

  it('refuses a report too short to act on', async () => {
    const response = await report({ body: 'broken' })

    expect(response.statusCode).toBe(400)
    expect(emailSender.messages).toHaveLength(0)
  })

  it('signs an upload URL into the feedback prefix', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/feedback/upload-url',
      headers: { cookie },
      payload: { kind: 'image', contentType: 'image/jpeg' },
    })

    expect(response.statusCode, response.body).toBe(200)
    expect(storage.keys.at(-1)).toMatch(new RegExp(`^feedback/${userId}/[\\w-]+\\.jpg$`))
  })

  it('will not sign an upload URL for a type it does not serve', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/feedback/upload-url',
      headers: { cookie },
      payload: { kind: 'image', contentType: 'application/zip' },
    })

    expect(response.json()).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' })
  })

  /** The link the report's email carries, as a path this app can be injected with. */
  async function awardPath(body: string): Promise<string> {
    const response = await report({ body })
    expect(response.statusCode, response.body).toBe(202)
    const match = /https?:\/\/\S*\/feedback\/award\?token=\S+/.exec(
      emailSender.messages.at(-1)?.text ?? '',
    )
    if (!match) throw new Error('no award link in the report email')
    return match[0].replace(/^https?:\/\/[^/]+/, '')
  }

  function payWith(path: string, amount: string) {
    return app.inject({
      method: 'POST',
      url: path,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `amount=${encodeURIComponent(amount)}`,
    })
  }

  async function balance(): Promise<number> {
    const rows = await handle.db
      .collection<{ amount: number }>(COLLECTIONS.tokenLedger)
      .find({ userId, kind: 'bounty' })
      .toArray()
    return rows.reduce((total, row) => total + row.amount, 0)
  }

  describe('the award link in the email', () => {
    it('opens a page that names the finder and pays nothing by itself', async () => {
      const path = await awardPath('The wallet screen shows a negative balance again.')
      const before = await balance()

      const page = await app.inject({ method: 'GET', url: path })

      expect(page.statusCode, page.body).toBe(200)
      expect(page.body).toContain('@bugfinder')
      expect(page.body).toContain('name="amount"')
      expect(await balance()).toBe(before)
    })

    it('pays the amount the reader chose, once', async () => {
      const path = await awardPath('Corrections are counted twice on the profile screen.')
      const before = await balance()

      const paid = await payWith(path, '1500')
      expect(paid.statusCode, paid.body).toBe(200)
      expect(paid.body).toContain('1500')
      expect(await balance()).toBe(before + 1500)

      // The same link again — a refresh, or a forwarded mail.
      const again = await payWith(path, '1500')
      expect(again.statusCode).toBe(200)
      expect(again.body).toContain('already been paid')
      expect(await balance()).toBe(before + 1500)
    })

    /**
     * The award used to be silent: a ledger row, and nothing to tell the person
     * who wrote the report. Both channels go out, and neither asks a
     * preference — this is a receipt, not a nudge.
     */
    it('tells the finder, by push and by email, when the reward lands', async () => {
      await handle.db.collection(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: 'ExponentPushToken[test]',
        platform: 'ios',
        locale: 'en',
        createdAt: new Date(),
      })
      const path = await awardPath('The leaderboard shows last week after midnight on Monday.')
      emailSender.messages.length = 0
      pushSender.sent.length = 0

      const paid = await payWith(path, '900')
      expect(paid.statusCode, paid.body).toBe(200)

      const push = pushSender.sent.at(-1)
      expect(pushSender.sent).toHaveLength(1)
      expect(push?.data.kind).toBe('bountyPaid')
      expect(push?.title).toContain('900')
      expect(push?.to).toEqual(['ExponentPushToken[test]'])

      const mail = emailSender.messages.at(-1)
      expect(emailSender.messages).toHaveLength(1)
      expect(mail?.to).toBe('finder@example.com')
      expect(mail?.subject).toContain('900')
      expect(mail?.text).toContain('/wallet')
    })

    it('says nothing a second time, because nothing was paid a second time', async () => {
      const path = await awardPath('Pull to refresh does nothing on the starred screen.')
      await payWith(path, '700')
      emailSender.messages.length = 0
      pushSender.sent.length = 0

      const again = await payWith(path, '700')

      expect(again.body).toContain('already been paid')
      expect(pushSender.sent).toHaveLength(0)
      expect(emailSender.messages).toHaveLength(0)
    })

    it('keeps the award off the week, month and year tables', async () => {
      const path = await awardPath('The streak freeze is spent even when the streak is safe.')
      const week = await handle.db
        .collection<{ tokens: number }>(COLLECTIONS.tokenAggregates)
        .findOne({ userId, periodType: 'week' })
      const before = week?.tokens ?? 0

      expect((await payWith(path, '500')).statusCode).toBe(200)

      const after = await handle.db
        .collection<{ tokens: number }>(COLLECTIONS.tokenAggregates)
        .findOne({ userId, periodType: 'week' })
      expect(after?.tokens ?? 0).toBe(before)
    })

    it('refuses an amount outside the range, and pays nothing', async () => {
      const path = await awardPath('Photos in chat load rotated on Android.')
      const before = await balance()

      for (const amount of ['0', '50', '500000', 'lots']) {
        const response = await payWith(path, amount)
        expect(response.statusCode, amount).toBe(400)
      }
      expect(await balance()).toBe(before)
    })

    it('refuses a token somebody edited', async () => {
      const path = await awardPath('The gift cooldown shows a negative timer.')
      const tampered = path.replace(/token=v1\.[^.]+/, 'token=v1.someone-else')

      expect((await app.inject({ method: 'GET', url: tampered })).statusCode).toBe(400)
      expect((await payWith(tampered, '500')).statusCode).toBe(400)
    })
  })

  it('needs a session', async () => {
    // A complete payload, because validation runs before the preHandler: an
    // incomplete one would be refused as malformed and prove nothing about
    // who is allowed to post.
    const response = await app.inject({
      method: 'POST',
      url: '/feedback',
      payload: {
        kind: 'bug',
        body: 'The wallet screen shows a negative balance after a refused gift.',
      },
    })

    expect(response.statusCode).toBe(401)
    expect(emailSender.messages).toHaveLength(0)
  })
})
