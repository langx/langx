import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { LoggingPushSender } from '../push/devices'
import { notifyFollowed, notifyPostReply, runLikesRoundUpPass } from './social'

const NOW = new Date('2026-09-14T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

describe('the feed reacting to somebody', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let push: LoggingPushSender
  let senders: { push: LoggingPushSender; logger: { error: (obj: object) => void } }
  const errors: object[] = []

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'social_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.devices,
      COLLECTIONS.notificationLedger,
      COLLECTIONS.likes,
      COLLECTIONS.posts,
      COLLECTIONS.postCorrections,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    errors.length = 0
    push = new LoggingPushSender()
    senders = { push, logger: { error: (obj) => errors.push(obj) } }
  })

  async function newProfile(
    opts: { name?: string; notifications?: unknown; device?: boolean } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(-10)}`,
      displayName: opts.name ?? 'Sofia R.',
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
      nativeLanguages: [{ code: 'en' }],
    } as never)
    if (opts.device !== false) {
      await handle.db.collection(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: `ExponentPushToken[${userId.slice(-12)}]`,
        platform: 'ios',
        locale: 'en',
        createdAt: NOW,
        updatedAt: NOW,
      })
    }
    return userId
  }

  describe('a follow', () => {
    it('buzzes once, and never again for the same person', async () => {
      const followee = await newProfile()
      const follower = await newProfile({ name: 'Ada Lovelace' })

      await notifyFollowed(handle.db, senders, { followerId: follower, followeeId: followee })
      expect(push.sent).toHaveLength(1)
      expect(push.sent[0]?.title).toContain('Ada Lovelace')
      expect(push.sent[0]?.data.kind).toBe('social')
      // The tap opens the person who did it.
      expect(push.sent[0]?.data.handle).toBeDefined()

      // Unfollowing and following again is not news.
      await notifyFollowed(handle.db, senders, { followerId: follower, followeeId: followee })
      expect(push.sent).toHaveLength(1)
    })

    it('says nothing about following yourself, or to somebody who switched it off', async () => {
      const alone = await newProfile()
      await notifyFollowed(handle.db, senders, { followerId: alone, followeeId: alone })

      const quiet = await newProfile({ notifications: { social: { push: false } } })
      const follower = await newProfile()
      await notifyFollowed(handle.db, senders, { followerId: follower, followeeId: quiet })
      expect(push.sent).toHaveLength(0)
    })
  })

  describe('a reply to a post', () => {
    it('names who answered and opens the post', async () => {
      const author = await newProfile()
      const responder = await newProfile({ name: 'Kenji' })
      const postId = new ObjectId()

      await notifyPostReply(
        handle.db,
        senders,
        { postId, authorId: author, responderId: responder, kind: 'correction' },
        NOW,
      )
      expect(push.sent[0]?.title).toContain('Kenji')
      expect(push.sent[0]?.data.postId).toBe(postId.toHexString())
    })

    /**
     * Three people correcting the same sentence within a minute is the good
     * case, not the rare one — and three buzzes about it is how the switch
     * gets turned off.
     */
    it('buzzes once an hour per post, however many people answer', async () => {
      const author = await newProfile()
      const postId = new ObjectId()
      for (let index = 0; index < 3; index++) {
        await notifyPostReply(
          handle.db,
          senders,
          { postId, authorId: author, responderId: await newProfile(), kind: 'correction' },
          NOW,
        )
      }
      expect(push.sent).toHaveLength(1)

      // An hour later it is news again.
      await notifyPostReply(
        handle.db,
        senders,
        { postId, authorId: author, responderId: await newProfile(), kind: 'comment' },
        new Date(NOW.getTime() + 60 * 60 * 1000),
      )
      expect(push.sent).toHaveLength(2)
    })

    it('says nothing about answering your own post', async () => {
      const author = await newProfile()
      await notifyPostReply(
        handle.db,
        senders,
        { postId: new ObjectId(), authorId: author, responderId: author, kind: 'answer' },
        NOW,
      )
      expect(push.sent).toHaveLength(0)
    })
  })

  describe('the daily likes round-up', () => {
    async function likePost(postId: ObjectId, times: number, when = NOW) {
      for (let index = 0; index < times; index++) {
        await handle.db.collection(COLLECTIONS.likes).insertOne({
          _id: new ObjectId(),
          userId: new ObjectId().toHexString(),
          targetType: 'post',
          targetId: postId,
          createdAt: when,
        })
      }
    }

    it('counts a day of likes into one buzz', async () => {
      const author = await newProfile()
      const postId = new ObjectId()
      await handle.db
        .collection(COLLECTIONS.posts)
        .insertOne({ _id: postId, authorId: author, body: 'hi', language: 'en' })
      await likePost(postId, 7)
      // Yesterday's likes are not this day's news.
      await likePost(postId, 4, new Date(NOW.getTime() - 2 * DAY))

      expect(await runLikesRoundUpPass(handle.db, push, NOW)).toEqual({ sent: 1 })
      expect(push.sent[0]?.title).toContain('7')
      expect(push.sent[0]?.data.postId).toBe(postId.toHexString())

      // And once a day: the next tick finds the claim.
      expect(await runLikesRoundUpPass(handle.db, push, NOW)).toEqual({ sent: 0 })
    })

    it('sends nothing when nobody liked anything', async () => {
      expect(await runLikesRoundUpPass(handle.db, push, NOW)).toEqual({ sent: 0 })
      expect(push.sent).toHaveLength(0)
    })
  })
})
