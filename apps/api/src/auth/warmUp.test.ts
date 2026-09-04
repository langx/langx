import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAuth } from '../auth'
import { connectToDatabase, type DbHandle } from '../db/client'
import type { EmailSender } from '../email/sender'
import { loadEnv } from '../env'
import { warmUpAuthCollections } from './warmUp'

describe('Faz 1 — auth collection warm-up', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_warmup_test')
  }, 60_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  it('absorbs the first-write race and leaves no trace behind', async () => {
    const env = loadEnv({
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: 'langx_warmup_test',
      BETTER_AUTH_SECRET: 'a'.repeat(32),
    })
    const noopEmailSender: EmailSender = { deliverable: true, send: () => Promise.resolve() }
    const auth = await createAuth({
      env,
      db: handle.db,
      client: handle.client,
      emailSender: noopEmailSender,
    })
    const warnings: unknown[] = []
    const logger = { warn: (obj: unknown) => warnings.push(obj) }

    // This is the exact scenario that fails without a warm-up: a database
    // that has never had anything written to `user`/`account` before.
    await warmUpAuthCollections(auth, handle.db, logger)

    expect(warnings).toEqual([])
    await expect(handle.db.collection('user').countDocuments()).resolves.toBe(0)
    await expect(handle.db.collection('account').countDocuments()).resolves.toBe(0)

    // And the real first sign-up a user makes now succeeds on the first try.
    const signUp = await auth.api.signUpEmail({
      body: {
        email: 'first-real-user@example.com',
        password: 'correct horse battery staple',
        name: 'Real',
      },
    })
    expect(signUp.user.email).toBe('first-real-user@example.com')
  }, 30_000)
})
