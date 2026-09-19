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
import { claimComment } from '../modules/growth/repo'
import { createStorageProvider } from '../storage/createStorageProvider'
import { CapturingEmailSender } from '../testSupport/authFlow'
import { createTranslationProvider } from '../translation/createTranslationProvider'
import { parse } from './instagramWebhook'

const APP_SECRET = 'ig-app-secret'
const VERIFY_TOKEN = 'verify-me'

/** Signs the way Meta does: HMAC-SHA256 over the raw body, hex, `sha256=` first. */
function signed(body: unknown) {
  const payload = JSON.stringify(body)
  return {
    payload,
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${createHmac('sha256', APP_SECRET).update(payload).digest('hex')}`,
    },
  }
}

function commentEvent(text: string, id = 'comment-1') {
  return {
    object: 'instagram',
    entry: [
      {
        id: 'account-1',
        time: 1_770_000_000,
        changes: [
          {
            field: 'comments',
            value: {
              id,
              text,
              timestamp: 1_770_000_000,
              from: { id: 'visitor-1', username: 'someone' },
            },
          },
        ],
      },
    ],
  }
}

describe('parse', () => {
  it('reads a comment out of a webhook body', () => {
    expect(parse(JSON.stringify(commentEvent('LANGX')))).toEqual([
      {
        kind: 'comment',
        commentId: 'comment-1',
        text: 'LANGX',
        fromId: 'visitor-1',
        postedAt: new Date(1_770_000_000 * 1000),
      },
    ])
  })

  it('reads a message, and drops the echo of our own', () => {
    const body = {
      entry: [
        {
          messaging: [
            { sender: { id: 'them' }, message: { text: 'READY' }, timestamp: 1_770_000_001_000 },
            { sender: { id: 'us' }, message: { text: 'here it is', is_echo: true } },
          ],
        },
      ],
    }
    expect(parse(JSON.stringify(body))).toEqual([
      {
        kind: 'message',
        senderId: 'them',
        text: 'READY',
        at: new Date(1_770_000_001_000),
      },
    ])
  })

  it('reads a tapped button as the message it stands in for', () => {
    // A quick reply arrives as `postback`, not `message`. It has to count:
    // tapping is the action that opens the 24-hour window and makes the
    // follow check readable, exactly as typing would have.
    const body = {
      entry: [
        {
          messaging: [
            {
              sender: { id: 'them' },
              postback: { mid: 'm1', title: 'Send the link', payload: 'LANGX_SEND_LINK' },
              timestamp: 1_770_000_002_000,
            },
          ],
        },
      ],
    }
    expect(parse(JSON.stringify(body))).toEqual([
      {
        kind: 'message',
        senderId: 'them',
        text: 'LANGX_SEND_LINK',
        at: new Date(1_770_000_002_000),
      },
    ])
  })

  it('drops a sender id that is not a string', () => {
    // It would go straight into a Mongo `_id`, where `{ $ne: null }` matches
    // every lead there is. Only Meta can get a body past the signature check,
    // which is the argument that stops being true the day something else can.
    const body = {
      entry: [{ messaging: [{ sender: { id: { $ne: null } }, message: { text: 'READY' } }] }],
    }
    expect(parse(JSON.stringify(body))).toEqual([])
  })

  it('returns nothing rather than throwing on a shape it does not know', () => {
    // Meta adds fields to these payloads without warning; a strict parse would
    // turn the next addition into a dropped lead.
    expect(parse('not json')).toEqual([])
    expect(parse(JSON.stringify({ entry: [{ changes: [{ field: 'mentions' }] }] }))).toEqual([])
  })
})

describe('/webhooks/instagram', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let app: FastifyInstance

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_instagram_webhook_test')
    const env = loadEnv({
      NODE_ENV: 'test',
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_instagram_webhook_test',
      LOG_LEVEL: 'silent',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:4000',
      IG_APP_SECRET: APP_SECRET,
      IG_VERIFY_TOKEN: VERIFY_TOKEN,
      // Deliberately no page token: nothing in this file should reach Meta,
      // and without one the route decides and then declines to send.
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
    await handle.db.collection(COLLECTIONS.instagramComments).deleteMany({})
    await handle.db.collection(COLLECTIONS.instagramLeads).deleteMany({})
  })

  it('echoes the challenge back as plain text', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1234`,
    })
    expect(response.statusCode).toBe(200)
    // Meta refuses the subscription if the challenge comes back wrapped in
    // anything, JSON included.
    expect(response.body).toBe('1234')
  })

  it('refuses the handshake with the wrong verify token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/webhooks/instagram?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1234',
    })
    expect(response.statusCode).toBe(401)
  })

  it('refuses a body whose signature does not match', async () => {
    const { payload } = signed(commentEvent('LANGX'))
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/instagram',
      headers: { 'content-type': 'application/json', 'x-hub-signature-256': 'sha256=deadbeef' },
      payload,
    })
    expect(response.statusCode).toBe(401)
  })

  it('refuses a body with no signature at all', async () => {
    const { payload } = signed(commentEvent('LANGX'))
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/instagram',
      headers: { 'content-type': 'application/json' },
      payload,
    })
    expect(response.statusCode).toBe(401)
  })

  it('acknowledges a signed delivery immediately', async () => {
    // The work is deliberately slow — it sleeps for up to ninety seconds
    // before answering a comment — so the 200 cannot wait for it, or Meta
    // retries and the retry spends a private reply that only exists once.
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/instagram',
      ...signed(commentEvent('LANGX')),
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ received: true })
  })

  it('claims a comment exactly once', async () => {
    // What makes a retried webhook harmless: the claim is the insert, so the
    // second caller loses on the unique `_id` rather than on a read it raced.
    expect(await claimComment(handle.db, 'comment-9')).toBe(true)
    expect(await claimComment(handle.db, 'comment-9')).toBe(false)
  })
})
