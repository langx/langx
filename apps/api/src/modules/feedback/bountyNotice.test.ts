import type { Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import type { Conversation, Message } from '../chat/conversations'
import { ensureOfficialAccounts, officialIds } from '../official/accounts'
import type { Profile } from '../profiles/profiles'
import { LoggingPushSender } from '../push/devices'
import { notifyBountyPaid } from './bountyNotice'

describe('telling somebody their report was paid for', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let db: Db
  let email: CapturingEmailSender
  let push: LoggingPushSender
  const warnings: string[] = []
  const warn = (_error: unknown, message: string) => warnings.push(message)

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_bounty_notice_test')
    db = handle.db
    await ensureIndexes(db)
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.devices,
      COLLECTIONS.messages,
      COLLECTIONS.conversations,
    ]) {
      await db.collection(name).deleteMany({})
    }
    // The official accounts live in `profiles` too, so they go with it.
    await ensureOfficialAccounts(db, 'http://localhost:4000')
    warnings.length = 0
    email = new CapturingEmailSender()
    push = new LoggingPushSender()
  })

  /** A Turkish speaker reading the app on an English phone. */
  async function finder(opts: { verified?: boolean } = {}): Promise<string> {
    const userId = '6a99d375c220ad84a6bbdfcc'
    await db.collection<Profile>(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: 'bugfinder',
      displayName: 'Bug Finder',
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      settings: { discoverable: true },
    } as unknown as Profile)
    await db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: 'finder@example.com',
      emailVerified: opts.verified ?? true,
    })
    await db.collection(COLLECTIONS.devices).insertOne({
      userId,
      pushToken: 'ExponentPushToken[finder]',
      platform: 'ios',
      locale: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return userId
  }

  const senders = () => ({ email, push })
  const messages = () => db.collection<Message>(COLLECTIONS.messages)
  const conversations = () => db.collection<Conversation>(COLLECTIONS.conversations)

  it('writes the receipt into the @langx thread, and still pushes and mails', async () => {
    const userId = await finder()
    await notifyBountyPaid(db, senders(), { userId, amount: 500, refId: 'report-1' }, warn)

    const message = await messages().findOne({ clientId: 'bounty:report-1' })
    expect(message).not.toBeNull()
    expect(message?.senderId).toBe(officialIds().get('langx'))
    // The reader's own language, not the phone's: the push is worded per
    // device, the message and the mail in the language they already have.
    expect(message?.body).toContain('500 jeton')
    expect(push.sent).toHaveLength(1)
    expect(push.sent[0]?.title).toContain('500')
    expect(email.messages).toHaveLength(1)
    expect(email.messages[0]?.text).toContain('500')
    expect(warnings).toEqual([])

    // In the thread the welcome landed in, waiting with a dot on it.
    const conversation = await conversations().findOne({ _id: message!.conversationId })
    expect(conversation?.participants).toEqual(
      expect.arrayContaining([officialIds().get('langx'), userId]),
    )
    expect(conversation?.unread[userId]).toBe(1)
  })

  it('writes one message per report, however many times a report is paid', async () => {
    const userId = await finder()
    await notifyBountyPaid(db, senders(), { userId, amount: 500, refId: 'report-1' }, warn)
    await notifyBountyPaid(db, senders(), { userId, amount: 500, refId: 'report-1' }, warn)
    await notifyBountyPaid(db, senders(), { userId, amount: 900, refId: 'report-2' }, warn)

    expect(await messages().countDocuments({})).toBe(2)
    expect(await conversations().countDocuments({})).toBe(1)
    expect(warnings).toEqual([])
  })

  it('never writes to an address nobody proved, and still tells the phone and the thread', async () => {
    const userId = await finder({ verified: false })
    await notifyBountyPaid(db, senders(), { userId, amount: 500, refId: 'report-1' }, warn)

    expect(email.messages).toHaveLength(0)
    expect(push.sent).toHaveLength(1)
    expect(await messages().countDocuments({})).toBe(1)
  })
})
