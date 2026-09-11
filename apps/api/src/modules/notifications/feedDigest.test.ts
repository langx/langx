import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DAILY_DIGEST_LOCAL_HOUR } from '@langx/shared'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { NotificationEmailContext } from '../../email/notify'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { runDailyDigestPass } from './digest'

const SECRET = 'f'.repeat(40)
const HOUR = 60 * 60 * 1000
/** 19:00 UTC — the digest hour for a reader on UTC. */
const EVENING = new Date(`2026-09-14T${String(DAILY_DIGEST_LOCAL_HOUR).padStart(2, '0')}:00:00Z`)

describe("the day's replies to somebody's posts", () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let sender: CapturingEmailSender
  let ctx: NotificationEmailContext

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'feed_digest_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.notificationLedger,
      COLLECTIONS.posts,
      COLLECTIONS.postCorrections,
      COLLECTIONS.postComments,
      COLLECTIONS.pronunciationAnswers,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    sender = new CapturingEmailSender()
    ctx = { sender, unsubscribeSecret: SECRET, apiBaseUrl: 'https://api.langx.io' }
  })

  async function newProfile(
    opts: { timezone?: string; notifications?: unknown } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(-10)}`,
      displayName: 'Sofia R.',
      timezone: opts.timezone ?? 'UTC',
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
      nativeLanguages: [{ code: 'en' }],
    } as never)
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: `${userId}@example.com`,
      emailVerified: true,
    })
    return userId
  }

  async function newPost(authorId: string, body: string): Promise<ObjectId> {
    const _id = new ObjectId()
    await handle.db
      .collection(COLLECTIONS.posts)
      .insertOne({ _id, authorId, body, language: 'en', createdAt: EVENING })
    return _id
  }

  async function reply(
    collection: string,
    postId: ObjectId,
    when: Date = new Date(EVENING.getTime() - HOUR),
  ) {
    await handle.db.collection(collection).insertOne({
      _id: new ObjectId(),
      postId,
      authorId: new ObjectId().toHexString(),
      corrected: 'fixed',
      createdAt: when,
    })
  }

  it('counts the day into one letter and names the sentence', async () => {
    const author = await newProfile()
    const postId = await newPost(author, 'I go to the school yesterday')
    await reply(COLLECTIONS.postCorrections, postId)
    await reply(COLLECTIONS.postCorrections, postId)
    await reply(COLLECTIONS.postComments, postId)
    // Yesterday's replies belong to yesterday's digest.
    await reply(COLLECTIONS.postCorrections, postId, new Date(EVENING.getTime() - 30 * HOUR))

    expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 1 })
    const mail = sender.messages[0]
    expect(mail?.subject).toContain('3')
    expect(mail?.html).toContain('I go to the school yesterday')
    expect(mail?.html).toContain('2 corrections')
    expect(mail?.html).toContain('1 comment')
  })

  /** The correction is the reason to open the app, not something to paste. */
  it('carries no correction text, only the reader’s own sentence', async () => {
    const author = await newProfile()
    const postId = await newPost(author, 'my own words')
    await handle.db.collection(COLLECTIONS.postCorrections).insertOne({
      _id: new ObjectId(),
      postId,
      authorId: new ObjectId().toHexString(),
      corrected: 'THE CORRECTED SENTENCE',
      createdAt: new Date(EVENING.getTime() - HOUR),
    })

    await runDailyDigestPass(handle.db, ctx, EVENING)
    expect(sender.messages[0]?.html).toContain('my own words')
    expect(sender.messages[0]?.html).not.toContain('THE CORRECTED SENTENCE')
    expect(sender.messages[0]?.text).not.toContain('THE CORRECTED SENTENCE')
  })

  it('goes once a day, and waits for the evening where the reader is', async () => {
    const author = await newProfile()
    await reply(COLLECTIONS.postCorrections, await newPost(author, 'hello'))

    // Noon is not the evening.
    expect(
      await runDailyDigestPass(handle.db, ctx, new Date('2026-09-14T12:00:00Z')),
    ).toMatchObject({
      sent: 0,
    })
    expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 1 })
    // A reply landing after the letter waits for tomorrow's.
    await reply(COLLECTIONS.postComments, await newPost(author, 'again'))
    expect(
      await runDailyDigestPass(handle.db, ctx, new Date(EVENING.getTime() + HOUR)),
    ).toMatchObject({
      sent: 0,
    })
  })

  it('says nothing to somebody who turned the email half off', async () => {
    const author = await newProfile({ notifications: { social: { push: true, email: false } } })
    await reply(COLLECTIONS.postCorrections, await newPost(author, 'hello'))
    expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 0 })
  })

  it('sends nothing on a day nobody answered anybody', async () => {
    await newProfile()
    expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 0 })
    expect(sender.messages).toHaveLength(0)
  })

  it('names the busiest posts and counts the rest', async () => {
    const author = await newProfile()
    for (let index = 0; index < 5; index++) {
      await reply(COLLECTIONS.postCorrections, await newPost(author, `sentence ${index}`))
    }
    expect(await runDailyDigestPass(handle.db, ctx, EVENING)).toMatchObject({ sent: 1 })
    expect(sender.messages[0]?.html).toContain('2 more posts')
  })
})
