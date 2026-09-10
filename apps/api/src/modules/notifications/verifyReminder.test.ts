import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { alreadyClaimed } from './ledger'
import { runVerifyReminderPass } from './verifyReminder'

const HOUR = 60 * 60 * 1000
const NOW = new Date('2026-09-14T12:00:00Z')

describe('the second attempt at the verification link', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'verify_reminder_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [COLLECTIONS.user, COLLECTIONS.notificationLedger]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  async function newUser(
    opts: {
      hoursOld?: number
      verified?: boolean
      anonymous?: boolean
      fromV1?: boolean
      email?: string | null
    } = {},
  ): Promise<string> {
    const _id = new ObjectId()
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id,
      ...(opts.email === null ? {} : { email: opts.email ?? `${_id.toHexString()}@example.com` }),
      emailVerified: opts.verified ?? false,
      ...(opts.anonymous ? { isAnonymous: true } : {}),
      ...(opts.fromV1 ? { precreatedFromV1: { at: NOW, legacyUserId: 'v1' } } : {}),
      createdAt: new Date(NOW.getTime() - (opts.hoursOld ?? 30) * HOUR),
    })
    return _id.toHexString()
  }

  it('writes once to an address nobody confirmed, and never again', async () => {
    const userId = await newUser()
    const resend = vi.fn().mockResolvedValue(undefined)

    expect(await runVerifyReminderPass(handle.db, resend, NOW)).toEqual({ sent: 1 })
    expect(resend).toHaveBeenCalledWith(`${userId}@example.com`)
    // The claim is what says "already asked", and it is what `auth.ts` reads
    // to word the second letter as a reminder.
    expect(await alreadyClaimed(handle.db, 'verifyReminder', userId, 'once')).toBe(true)

    expect(await runVerifyReminderPass(handle.db, resend, NOW)).toEqual({ sent: 0 })
    expect(resend).toHaveBeenCalledTimes(1)
  })

  it('waits a day, and gives up after a week', async () => {
    await newUser({ hoursOld: 2 })
    await newUser({ hoursOld: 24 * 9 })
    const resend = vi.fn().mockResolvedValue(undefined)
    expect(await runVerifyReminderPass(handle.db, resend, NOW)).toEqual({ sent: 0 })
  })

  it('leaves alone the accounts this was never about', async () => {
    await newUser({ verified: true })
    await newUser({ anonymous: true })
    // The v1 rows are verified by the script, and their owners have their own
    // letter waiting.
    await newUser({ fromV1: true })
    await newUser({ email: null })

    const resend = vi.fn().mockResolvedValue(undefined)
    expect(await runVerifyReminderPass(handle.db, resend, NOW)).toEqual({ sent: 0 })
    expect(resend).not.toHaveBeenCalled()
  })

  /** A link that failed to send is not worth trying again tomorrow. */
  it('keeps the claim when the send fails, and says so', async () => {
    const userId = await newUser()
    const resend = vi.fn().mockRejectedValue(new Error('resend down'))
    expect(await runVerifyReminderPass(handle.db, resend, NOW)).toEqual({ sent: 0, failed: 1 })
    expect(await alreadyClaimed(handle.db, 'verifyReminder', userId, 'once')).toBe(true)
    expect(await runVerifyReminderPass(handle.db, resend, NOW)).toEqual({ sent: 0 })
  })
})
