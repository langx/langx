import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { LoggingPushSender } from '../push/devices'
import { claimNewDevice } from './knownDevices'
import { notifyNewSignIn, notifyPasswordChanged, type SecurityNotifier } from './notify'

describe('telling somebody about their own account', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let email: CapturingEmailSender
  let push: LoggingPushSender
  let senders: SecurityNotifier
  const errors: object[] = []

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'security_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.devices,
      COLLECTIONS.knownDevices,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    errors.length = 0
    email = new CapturingEmailSender()
    push = new LoggingPushSender()
    senders = { email, push, logger: { error: (obj) => errors.push(obj) } }
  })

  async function newAccount(
    opts: { verified?: boolean; notifications?: unknown; device?: boolean; locale?: string } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(0, 8)}`,
      // Everything off, on both channels — the case these notices ignore.
      settings: { discoverable: true, notifications: opts.notifications ?? false },
      nativeLanguages: [{ code: opts.locale ?? 'en' }],
    } as never)
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: `${userId}@example.com`,
      emailVerified: opts.verified ?? true,
    })
    if (opts.device !== false) {
      await handle.db.collection(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: `ExponentPushToken[${userId.slice(0, 10)}]`,
        platform: 'ios',
        locale: opts.locale ?? 'en',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
    return userId
  }

  /**
   * The rule the whole module turns on: a notice about a possible compromise
   * has to arrive even from an account whose owner switched everything off.
   */
  it('sends on both channels to somebody who turned every notification off', async () => {
    const userId = await newAccount({ notifications: false })
    await notifyNewSignIn(handle.db, senders, userId, {
      device: 'Safari on iPhone',
      country: 'TR',
      at: new Date('2026-09-14T09:05:00Z'),
    })

    expect(email.messages).toHaveLength(1)
    expect(push.sent).toHaveLength(1)
    const message = email.messages[0]
    expect(message?.subject).toContain('New sign-in')
    expect(message?.html).toContain('Safari on iPhone')
    // The country code becomes a name, and the time says which clock it is on.
    expect(message?.html).toContain('Türkiye')
    expect(message?.html).toContain('2026-09-14 09:05 UTC')
  })

  /** No switch behind it, so no unsubscribe link and no List-Unsubscribe header. */
  it('offers no way to turn it off, because there is none', async () => {
    const userId = await newAccount()
    await notifyPasswordChanged(handle.db, senders, userId, { device: 'Chrome on Windows' })
    const message = email.messages[0]
    expect(message?.headers).toBeUndefined()
    expect(message?.html).not.toContain('unsubscribe')
    expect(message?.text).not.toContain('unsubscribe')
    // What it offers instead: the one action that helps.
    expect(message?.html).toContain('/settings/password')
  })

  it('never writes to an address nobody proved', async () => {
    const userId = await newAccount({ verified: false })
    await notifyNewSignIn(handle.db, senders, userId, { device: 'Chrome on Windows' })
    expect(email.messages).toHaveLength(0)
    // The phone still hears about it: the device is the account's, whatever
    // the address turns out to be.
    expect(push.sent).toHaveLength(1)
  })

  it('says it in the language the reader speaks', async () => {
    const userId = await newAccount({ locale: 'tr' })
    await notifyPasswordChanged(handle.db, senders, userId, {})
    expect(email.messages[0]?.subject).toContain('şifren')
  })

  /** A mail provider having a bad minute must not break a correct password. */
  it('logs a failure rather than throwing it at the caller', async () => {
    const userId = await newAccount()
    const failing: SecurityNotifier = {
      ...senders,
      email: { deliverable: true, send: () => Promise.reject(new Error('resend down')) },
    }
    await expect(notifyPasswordChanged(handle.db, failing, userId, {})).resolves.toBeUndefined()
    expect(errors).toHaveLength(1)
    // And the push still went.
    expect(push.sent).toHaveLength(1)
  })

  it('says nothing at all about an account with no address and no device', async () => {
    const userId = await newAccount({ verified: false, device: false })
    await notifyNewSignIn(handle.db, senders, userId, {})
    expect(email.messages).toHaveLength(0)
    expect(push.sent).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  describe('which devices count as new', () => {
    it('is new once, and ordinary every time after', async () => {
      const userId = await newAccount()
      expect(await claimNewDevice(handle.db, userId, 'ios-safari')).toBe(true)
      expect(await claimNewDevice(handle.db, userId, 'ios-safari')).toBe(false)
      // A different device on the same account is its own answer.
      expect(await claimNewDevice(handle.db, userId, 'windows-chrome')).toBe(true)
    })

    /** Two sign-ins racing each other are one letter, not two. */
    it('lets exactly one of two simultaneous sign-ins be the first', async () => {
      const userId = await newAccount()
      const [first, second] = await Promise.all([
        claimNewDevice(handle.db, userId, 'ios-safari'),
        claimNewDevice(handle.db, userId, 'ios-safari'),
      ])
      expect([first, second].filter(Boolean)).toHaveLength(1)
    })

    it('keeps the last country it was seen from', async () => {
      const userId = await newAccount()
      await claimNewDevice(handle.db, userId, 'ios-safari', { country: 'TR' })
      await claimNewDevice(handle.db, userId, 'ios-safari', { country: 'CA' })
      const row = await handle.db
        .collection(COLLECTIONS.knownDevices)
        .findOne({ _id: `${userId}:ios-safari` as never })
      expect(row).toMatchObject({ country: 'CA' })
    })
  })
})
