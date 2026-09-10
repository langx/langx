import { TOKEN_RULES } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { LoggingPushSender } from '../push/devices'
import { runGiftReadyPass, runPoolPayoutPass, WALLET_LOCAL_HOUR } from './wallet'

/** 09:00 UTC — the hour the pool is worth mentioning, for a UTC reader. */
const MORNING = new Date('2026-09-14T09:00:00Z')
const DAY = 24 * 60 * 60 * 1000

describe('tokens arriving', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let push: LoggingPushSender

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'wallet_push_test')
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
      COLLECTIONS.tokenLedger,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    push = new LoggingPushSender()
  })

  async function newProfile(
    opts: { timezone?: string; notifications?: unknown; lastGiftAt?: Date | null } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(-10)}`,
      displayName: 'Sofia R.',
      timezone: opts.timezone ?? 'UTC',
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
      nativeLanguages: [{ code: 'en' }],
      ...(opts.lastGiftAt === undefined ? {} : { lastGiftAt: opts.lastGiftAt }),
    } as never)
    await handle.db.collection(COLLECTIONS.devices).insertOne({
      userId,
      pushToken: `ExponentPushToken[${userId.slice(-12)}]`,
      platform: 'ios',
      locale: 'en',
      createdAt: MORNING,
      updatedAt: MORNING,
    })
    return userId
  }

  async function paidYesterday(userId: string, amount: number) {
    await handle.db.collection(COLLECTIONS.tokenLedger).insertOne({
      _id: new ObjectId(),
      userId,
      kind: 'dailyPool',
      amount,
      refId: '2026-09-13',
      day: '2026-09-13',
      week: '2026-W37',
      month: '2026-09',
      createdAt: new Date(MORNING.getTime() - 5 * 60 * 60 * 1000),
    })
  }

  describe("yesterday's pool", () => {
    it('says what somebody was paid, once', async () => {
      const userId = await newProfile()
      await paidYesterday(userId, 43)

      expect(await runPoolPayoutPass(handle.db, push, MORNING)).toEqual({ sent: 1 })
      expect(push.sent[0]?.title).toContain('43')
      expect(push.sent[0]?.data.kind).toBe('wallet')
      expect(await runPoolPayoutPass(handle.db, push, MORNING)).toEqual({ sent: 0 })
    })

    /**
     * The pool pays at a fixed UTC hour. Being buzzed about tokens at four in
     * the morning is worse than not being told, so the pass waits for morning
     * where the reader is.
     */
    it('waits for the morning on the reader’s own clock', async () => {
      const userId = await newProfile({ timezone: 'Asia/Tokyo' })
      await paidYesterday(userId, 10)
      // 09:00 UTC is 18:00 in Tokyo — not their morning.
      expect(await runPoolPayoutPass(handle.db, push, MORNING)).toEqual({ sent: 0 })
      // Midnight UTC is 09:00 there.
      expect(await runPoolPayoutPass(handle.db, push, new Date('2026-09-15T00:00:00Z'))).toEqual({
        sent: 0,
      })
    })

    it('says nothing to somebody who switched token news off', async () => {
      const userId = await newProfile({ notifications: { wallet: { push: false } } })
      await paidYesterday(userId, 12)
      expect(await runPoolPayoutPass(handle.db, push, MORNING)).toEqual({ sent: 0 })
    })

    it('sends nothing on a day the pool paid nobody', async () => {
      await newProfile()
      expect(await runPoolPayoutPass(handle.db, push, MORNING)).toEqual({ sent: 0 })
    })
  })

  describe('the hourly gift', () => {
    const ready = new Date(MORNING.getTime() - TOKEN_RULES.gift.cooldownMs - 60_000)

    it('tells somebody whose gift is waiting, once a day', async () => {
      await newProfile({ lastGiftAt: ready })
      expect(await runGiftReadyPass(handle.db, push, MORNING)).toEqual({ sent: 1 })
      expect(push.sent[0]?.data.kind).toBe('wallet')
      expect(await runGiftReadyPass(handle.db, push, MORNING)).toEqual({ sent: 0 })
      // Tomorrow it is news again.
      expect(await runGiftReadyPass(handle.db, push, new Date(MORNING.getTime() + DAY))).toEqual({
        sent: 1,
      })
    })

    /** `lastGiftAt` is the proof somebody knows what the gift is. */
    it('says nothing to somebody who has never taken one', async () => {
      await newProfile({ lastGiftAt: null })
      await newProfile()
      expect(await runGiftReadyPass(handle.db, push, MORNING)).toEqual({ sent: 0 })
    })

    it('says nothing while the cooldown is still running', async () => {
      await newProfile({ lastGiftAt: new Date(MORNING.getTime() - 60_000) })
      expect(await runGiftReadyPass(handle.db, push, MORNING)).toEqual({ sent: 0 })
    })

    it('waits for waking hours', async () => {
      await newProfile({ lastGiftAt: ready })
      const night = new Date(`2026-09-14T0${WALLET_LOCAL_HOUR - 5}:00:00Z`)
      expect(await runGiftReadyPass(handle.db, push, night)).toEqual({ sent: 0 })
    })
  })
})
