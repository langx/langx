import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../db/client'
import { COLLECTIONS } from '../db/collections'
import { authId } from '../lib/authId'
import type { Device } from '../modules/push/devices'
import { CapturingEmailSender } from '../testSupport/authFlow'
import { sendNotificationEmail, type NotificationEmailContext } from './notify'
import { verifyUnsubscribeToken } from './unsubscribeToken'

const SECRET = 'an-unsubscribe-secret-of-adequate-length'

describe('sendNotificationEmail', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let sender: CapturingEmailSender
  let ctx: NotificationEmailContext
  /** A real ObjectId hex: `authId` parses ids to cross into Better Auth's world. */
  let u1: string

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'notify_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [COLLECTIONS.profiles, COLLECTIONS.user, COLLECTIONS.devices]) {
      await handle.db.collection(name).deleteMany({})
    }
    u1 = new ObjectId().toHexString()
    sender = new CapturingEmailSender()
    ctx = { sender, unsubscribeSecret: SECRET, apiBaseUrl: 'https://api.langx.io' }
  })

  async function seed(
    userId: string,
    opts: {
      notifications?: unknown
      email?: string | null
      verified?: boolean
      deleted?: boolean
      deviceLocale?: string
    } = {},
  ): Promise<void> {
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
      ...(opts.deleted ? { deletedAt: new Date() } : {}),
    } as never)
    if (opts.email !== null) {
      await handle.db.collection(COLLECTIONS.user).insertOne({
        _id: authId(userId),
        email: opts.email ?? `${userId}@example.com`,
        emailVerified: opts.verified ?? true,
      })
    }
    if (opts.deviceLocale) {
      await handle.db.collection<Device>(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: `token-${userId}`,
        platform: 'ios',
        locale: opts.deviceLocale as never,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
    }
  }

  const build = (locale: string, unsubscribe: string) => ({
    subject: `subject in ${locale}`,
    html: `<p>hello</p><a href="${unsubscribe}">out</a>`,
    text: `hello\nout: ${unsubscribe}`,
  })

  it('sends to a verified address that has not opted out', async () => {
    await seed(u1)
    const outcome = await sendNotificationEmail(handle.db, ctx, {
      userId: u1,
      type: 'messages',
      build,
    })
    expect(outcome).toBe('sent')
    expect(sender.messages).toHaveLength(1)
    expect(sender.messages[0]?.to).toBe(`${u1}@example.com`)
  })

  /**
   * The header pair is what a mailbox provider reads; without it the same mail
   * is judged as bulk sending that made leaving hard, however good the footer.
   */
  it('carries a one-click unsubscribe header signed for that person and kind', async () => {
    await seed(u1)
    await sendNotificationEmail(handle.db, ctx, { userId: u1, type: 'streak', build })

    const headers = sender.messages[0]?.headers ?? {}
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    const url = headers['List-Unsubscribe']?.slice(1, -1) ?? ''
    const token = new URL(url).searchParams.get('token')
    expect(verifyUnsubscribeToken(SECRET, token ?? undefined)).toEqual({
      userId: u1,
      scope: 'streak',
    })
  })

  /** The same URL has to reach the body too, for a client that strips headers. */
  it('hands the same url to the template', async () => {
    await seed(u1)
    await sendNotificationEmail(handle.db, ctx, { userId: u1, type: 'messages', build })
    const message = sender.messages[0]
    const header = message?.headers?.['List-Unsubscribe']?.slice(1, -1)
    expect(message?.text).toContain(header)
    expect(message?.html).toContain(header)
  })

  it('words it in the language of the newest device', async () => {
    await seed(u1, { deviceLocale: 'tr' })
    await sendNotificationEmail(handle.db, ctx, { userId: u1, type: 'messages', build })
    expect(sender.messages[0]?.subject).toBe('subject in tr')
  })

  it('falls back to English when there is no phone signed in', async () => {
    await seed(u1)
    await sendNotificationEmail(handle.db, ctx, { userId: u1, type: 'messages', build })
    expect(sender.messages[0]?.subject).toBe('subject in en')
  })

  it('respects an opt-out on that kind alone', async () => {
    await seed(u1, { notifications: { messages: { email: false } } })
    expect(
      await sendNotificationEmail(handle.db, ctx, { userId: u1, type: 'messages', build }),
    ).toBe('opted-out')
    expect(await sendNotificationEmail(handle.db, ctx, { userId: u1, type: 'streak', build })).toBe(
      'sent',
    )
  })

  /** Never inferred: nobody is marketed at without having said yes. */
  it('never sends promotions to somebody who did not ask', async () => {
    await seed(u1)
    expect(
      await sendNotificationEmail(handle.db, ctx, { userId: u1, type: 'promotions', build }),
    ).toBe('opted-out')
    await handle.db
      .collection(COLLECTIONS.profiles)
      .updateOne(
        { _id: u1 as never },
        { $set: { 'settings.notifications.promotions': { push: false, email: true } } },
      )
    expect(
      await sendNotificationEmail(handle.db, ctx, { userId: u1, type: 'promotions', build }),
    ).toBe('sent')
  })

  it('refuses an address nobody has proved', async () => {
    await seed(u1, { verified: false })
    expect(
      await sendNotificationEmail(handle.db, ctx, { userId: u1, type: 'messages', build }),
    ).toBe('unverified')
    expect(sender.messages).toHaveLength(0)
  })

  it('has nothing to write to when there is no account row', async () => {
    await seed(u1, { email: null })
    expect(
      await sendNotificationEmail(handle.db, ctx, { userId: u1, type: 'messages', build }),
    ).toBe('no-email')
  })

  it('says nothing to somebody on their way out', async () => {
    await seed(u1, { deleted: true })
    expect(
      await sendNotificationEmail(handle.db, ctx, { userId: u1, type: 'messages', build }),
    ).toBe('deleted')
    expect(sender.messages).toHaveLength(0)
  })

  it('reports a user with no profile rather than throwing', async () => {
    expect(
      await sendNotificationEmail(handle.db, ctx, {
        userId: new ObjectId().toHexString(),
        type: 'messages',
        build,
      }),
    ).toBe('no-profile')
  })
})
