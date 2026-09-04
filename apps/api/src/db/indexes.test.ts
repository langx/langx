import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAuth } from '../auth'
import { warmUpAuthCollections } from '../auth/warmUp'
import type { EmailSender } from '../email/sender'
import { loadEnv } from '../env'
import { connectToDatabase, type DbHandle } from './client'
import { ensureIndexes } from './indexes'

const DB_NAME = 'langx_indexes_test'

describe('Faz 1 — indexes on the Better Auth collections', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), DB_NAME)
    await ensureIndexes(handle.db)
  }, 60_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  it('makes a duplicate email impossible rather than merely unlikely', async () => {
    const users = handle.db.collection('user')
    const names = (await users.indexes()).map((index) => index.name)
    expect(names).toContain('user_email_uidx')

    await users.insertOne({ email: 'dup@example.com', name: 'First' })
    await expect(users.insertOne({ email: 'dup@example.com', name: 'Second' })).rejects.toThrow(
      /duplicate key/i,
    )
    await users.deleteMany({ email: 'dup@example.com' })
  })

  it('is idempotent — a second boot creates nothing and throws nothing', async () => {
    const before = (await handle.db.collection('session').indexes()).length
    await ensureIndexes(handle.db)
    expect((await handle.db.collection('session').indexes()).length).toBe(before)
  })

  it("leaves Better Auth's own index creation a no-op instead of a conflict", async () => {
    // The reason every name here mirrors `getDatabaseIndexName()`: the adapter
    // calls `createIndex` on its own declared indexes at the first write, and
    // a same-key-different-name index would fail that write with code 85.
    const env = loadEnv({
      MONGODB_URI: replSet.getUri(),
      MONGODB_DB: DB_NAME,
      BETTER_AUTH_SECRET: 'a'.repeat(32),
    })
    const noopEmailSender: EmailSender = { deliverable: true, send: () => Promise.resolve() }
    const auth = await createAuth({
      env,
      db: handle.db,
      client: handle.client,
      emailSender: noopEmailSender,
    })

    // Same order as boot: indexes, then the warm-up that absorbs the adapter's
    // first-write-vs-own-createIndex race, then real traffic.
    await warmUpAuthCollections(auth, handle.db, { warn: () => {} })

    const { user } = await auth.api.signUpEmail({
      body: { email: 'first-signup@example.com', password: 'not-a-real-password', name: 'First' },
    })
    expect(user.email).toBe('first-signup@example.com')

    const accountIndexes = (await handle.db.collection('account').indexes()).map((i) => i.name)
    expect(accountIndexes).toContain('account_issuer_accountId_uidx')
    expect(accountIndexes).toContain('account_userId_idx')
  })
})
