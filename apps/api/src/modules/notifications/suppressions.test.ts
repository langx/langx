import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
import {
  isEmailSuppressed,
  isUserSuppressed,
  suppressEmail,
  suppressedAmong,
  type EmailSuppression,
} from './suppressions'

describe('the suppression list', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'suppressions_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [COLLECTIONS.emailSuppressions, COLLECTIONS.user]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  it('answers by address, whatever the case it was written in', async () => {
    await suppressEmail(handle.db, { email: 'Sofia@Example.com', reason: 'bounced' })
    expect(await isEmailSuppressed(handle.db, 'sofia@example.com')).toBe(true)
    expect(await isEmailSuppressed(handle.db, 'SOFIA@EXAMPLE.COM ')).toBe(true)
    expect(await isEmailSuppressed(handle.db, 'other@example.com')).toBe(false)
  })

  /**
   * A complaint after a bounce changes nothing about what may be sent, and
   * an unsubscribe recorded first is the one its owner can point to.
   */
  it('keeps the first reason', async () => {
    await suppressEmail(handle.db, { email: 'a@example.com', reason: 'unsubscribed', userId: 'u1' })
    await suppressEmail(handle.db, { email: 'a@example.com', reason: 'complained' })
    const row = await handle.db
      .collection<EmailSuppression>(COLLECTIONS.emailSuppressions)
      .findOne({ _id: 'a@example.com' })
    expect(row).toMatchObject({ reason: 'unsubscribed', userId: 'u1' })
  })

  it('finds an account through its current address', async () => {
    const userId = new ObjectId().toHexString()
    await handle.db
      .collection(COLLECTIONS.user)
      .insertOne({ _id: authId(userId), email: 'gone@example.com', emailVerified: true })
    expect(await isUserSuppressed(handle.db, userId)).toBe(false)
    await suppressEmail(handle.db, { email: 'gone@example.com', reason: 'bounced' })
    expect(await isUserSuppressed(handle.db, userId)).toBe(true)
    // No address at all is simply not suppressed, rather than an error.
    expect(await isUserSuppressed(handle.db, new ObjectId().toHexString())).toBe(false)
  })

  it('checks a whole audience in one query', async () => {
    await suppressEmail(handle.db, { email: 'b@example.com', reason: 'complained' })
    const hit = await suppressedAmong(handle.db, [
      'A@example.com',
      'B@Example.com',
      'c@example.com',
    ])
    expect([...hit]).toEqual(['b@example.com'])
    expect((await suppressedAmong(handle.db, [])).size).toBe(0)
  })
})
