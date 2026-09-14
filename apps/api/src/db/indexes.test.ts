import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAuth } from '../auth'
import { warmUpAuthCollections } from '../auth/warmUp'
import type { EmailSender } from '../email/sender'
import { loadEnv } from '../env'
import { connectToDatabase, type DbHandle } from './client'
import { COLLECTIONS } from './collections'
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

/**
 * The Echo uniques, asserted the way the Better Auth one above is: not that
 * the declaration exists, but that the database refuses the second write.
 *
 * Each one is an invariant the module leans on instead of checking — a
 * duplicate card, a twice-applied review, a seed script run twice — so the
 * thing worth testing is the refusal, and that a *different* person is still
 * allowed the same key.
 */
describe('Echo — the invariants', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_echo_indexes_test')
    await ensureIndexes(handle.db)
  }, 60_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  it('allows one card per source per person, and lets somebody else keep the same one', async () => {
    const cards = handle.db.collection(COLLECTIONS.echoCards)
    expect((await cards.indexes()).map((index) => index.name)).toContain('card_source_unique')

    await cards.insertOne({ userId: 'u1', sourceKey: 'msg:abc', front: 'Bonjour' })
    await expect(
      cards.insertOne({ userId: 'u1', sourceKey: 'msg:abc', front: 'Bonjour' }),
    ).rejects.toThrow(/duplicate key/i)
    // The same message, a different reader: two cards, two schedules.
    await cards.insertOne({ userId: 'u2', sourceKey: 'msg:abc', front: 'Bonjour' })
    expect(await cards.countDocuments({ sourceKey: 'msg:abc' })).toBe(2)
  })

  it('declares the due queue and the language list', async () => {
    const names = (await handle.db.collection(COLLECTIONS.echoCards).indexes()).map(
      (index) => index.name,
    )
    expect(names).toContain('owner_due')
    expect(names).toContain('owner_lang_recent')
  })

  it('applies one review id once, however many times the app retries', async () => {
    const reviews = handle.db.collection(COLLECTIONS.echoReviews)
    expect((await reviews.indexes()).map((index) => index.name)).toContain('user_review_unique')

    await reviews.insertOne({ userId: 'u1', reviewId: 'r-1', cardId: 'c-1', grade: 'good' })
    await expect(
      reviews.insertOne({ userId: 'u1', reviewId: 'r-1', cardId: 'c-1', grade: 'good' }),
    ).rejects.toThrow(/duplicate key/i)
    // Ids are minted per device, so two people can collide without meaning to.
    await reviews.insertOne({ userId: 'u2', reviewId: 'r-1', cardId: 'c-9', grade: 'again' })
    expect(await reviews.countDocuments({ reviewId: 'r-1' })).toBe(2)
  })

  it('makes the pack seed script idempotent before the script exists', async () => {
    const items = handle.db.collection(COLLECTIONS.echoPackItems)
    expect((await items.indexes()).map((index) => index.name)).toContain('pack_index_unique')

    await items.insertOne({ packId: 'fr:absoluteBeginner', index: 0, text: 'bonjour' })
    await expect(
      items.insertOne({ packId: 'fr:absoluteBeginner', index: 0, text: 'salut' }),
    ).rejects.toThrow(/duplicate key/i)
  })
})
