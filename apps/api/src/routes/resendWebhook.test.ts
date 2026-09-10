import { createHmac } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { ensureIndexes } from '../db/indexes'
import { loadEnv } from '../env'
import { createRevenueCatClientFromEnv } from '../modules/billing/createRevenueCatClient'
import { isEmailSuppressed, type EmailSuppression } from '../modules/notifications/suppressions'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'

/** A Standard Webhooks secret: `whsec_` + base64 of the raw key. */
const RAW_KEY = Buffer.from('a'.repeat(32))
const SECRET = `whsec_${RAW_KEY.toString('base64')}`

/** Signs the way Resend (Svix) does: HMAC-SHA256 over `id.timestamp.body`. */
function signed(body: unknown, overrides: { secret?: Buffer; timestamp?: number } = {}) {
  const payload = JSON.stringify(body)
  const id = `msg_${Math.random().toString(36).slice(2, 10)}`
  const timestamp = String(overrides.timestamp ?? Math.floor(Date.now() / 1000))
  const signature = createHmac('sha256', overrides.secret ?? RAW_KEY)
    .update(`${id}.${timestamp}.${payload}`)
    .digest('base64')
  return {
    payload,
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    },
  }
}

function bounce(to: string, type: string) {
  return {
    type: 'email.bounced',
    created_at: new Date().toISOString(),
    data: {
      email_id: 'e1',
      message_id: 'm1',
      created_at: new Date().toISOString(),
      from: 'LangX <hi@langx.io>',
      to: [to],
      subject: 'hello',
      bounce: { message: 'mailbox does not exist', subType: 'General', type },
    },
  }
}

describe('POST /webhooks/resend', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_resend_webhook_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_resend_webhook_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      RESEND_WEBHOOK_SECRET: SECRET,
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
  }, 120_000)

  afterAll(async () => {
    await app.close()
    await handle.close()
    await replSet.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.emailSuppressions).deleteMany({})
  })

  async function post(request: ReturnType<typeof signed>) {
    return app.inject({ method: 'POST', url: '/webhooks/resend', ...request })
  }

  it('suppresses the address on a permanent bounce', async () => {
    const response = await post(signed(bounce('Dead@Example.com', 'Permanent')))
    expect(response.statusCode, response.body).toBe(200)
    expect(response.json()).toEqual({ received: true, suppressed: 1 })
    const row = await handle.db
      .collection<EmailSuppression>(COLLECTIONS.emailSuppressions)
      .findOne({ _id: 'dead@example.com' })
    expect(row?.reason).toBe('bounced')
  })

  /** A full mailbox is a bad day, not a dead address. */
  it('lets a transient bounce through untouched', async () => {
    const response = await post(signed(bounce('busy@example.com', 'Transient')))
    expect(response.statusCode).toBe(200)
    expect(await isEmailSuppressed(handle.db, 'busy@example.com')).toBe(false)
  })

  it('suppresses on a complaint, and on a Resend-side unsubscribe', async () => {
    await post(
      signed({
        type: 'email.complained',
        created_at: new Date().toISOString(),
        data: {
          to: ['angry@example.com'],
          from: 'x',
          subject: 's',
          email_id: 'e',
          message_id: 'm',
          created_at: 'c',
        },
      }),
    )
    await post(
      signed({
        type: 'contact.updated',
        created_at: new Date().toISOString(),
        data: {
          id: 'c1',
          audience_id: 'a',
          segment_ids: [],
          created_at: 'c',
          updated_at: 'u',
          email: 'left@example.com',
          unsubscribed: true,
        },
      }),
    )
    await post(
      signed({
        type: 'contact.updated',
        created_at: new Date().toISOString(),
        data: {
          id: 'c2',
          audience_id: 'a',
          segment_ids: [],
          created_at: 'c',
          updated_at: 'u',
          email: 'stays@example.com',
          unsubscribed: false,
        },
      }),
    )
    expect(await isEmailSuppressed(handle.db, 'angry@example.com')).toBe(true)
    expect(await isEmailSuppressed(handle.db, 'left@example.com')).toBe(true)
    expect(await isEmailSuppressed(handle.db, 'stays@example.com')).toBe(false)
  })

  it('acknowledges the events it has no use for', async () => {
    const response = await post(
      signed({
        type: 'email.delivered',
        created_at: new Date().toISOString(),
        data: {
          to: ['fine@example.com'],
          from: 'x',
          subject: 's',
          email_id: 'e',
          message_id: 'm',
          created_at: 'c',
        },
      }),
    )
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ received: true, suppressed: 0 })
  })

  it('refuses a bad signature, a stale timestamp and a missing one', async () => {
    const wrongKey = await post(
      signed(bounce('x@example.com', 'Permanent'), { secret: Buffer.from('b'.repeat(32)) }),
    )
    expect(wrongKey.statusCode).toBe(401)

    const stale = await post(
      signed(bounce('x@example.com', 'Permanent'), {
        timestamp: Math.floor(Date.now() / 1000) - 3600,
      }),
    )
    expect(stale.statusCode).toBe(401)

    const bare = await app.inject({
      method: 'POST',
      url: '/webhooks/resend',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(bounce('x@example.com', 'Permanent')),
    })
    expect(bare.statusCode).toBe(401)
    expect(await isEmailSuppressed(handle.db, 'x@example.com')).toBe(false)
  })
})
