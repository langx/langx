import { DEFAULT_APP_CONFIG, STICKER_GIFT_RULES, aggregateId, findCosmetic } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { ApiError } from '../../lib/ApiError'
import { updateAppConfig } from '../appConfig/appConfig'
import type { Conversation, Message } from '../chat/conversations'
import { reactToMessage } from '../chat/mutations'
import type { Profile } from '../profiles/profiles'
import type { TokenLedgerEntry } from './ledger'
import { getStickerGiftOptions, giveStickerPack, type StickerGift } from './stickerGifts'

const DAY = 24 * 60 * 60 * 1000
const PACK = 'stickers.paper'
const PRICE = findCosmetic(PACK)?.price ?? 0

/** Ids in Better Auth's shape, because the linked-account check reads `session` by ObjectId. */
const id = (): string => new ObjectId().toHexString()

function person(userId: string, fields: Partial<Profile> = {}): Profile {
  const now = Date.now()
  return {
    _id: userId,
    handle: `h${userId.slice(-6)}`,
    displayName: `Person ${userId.slice(-4)}`,
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'en' }],
    learning: [{ code: 'tr', level: 'intermediate', priority: 1 }],
    interests: [],
    settings: { discoverable: true, notifications: true },
    privacy: { incognito: false },
    entitlement: { tier: 'free', updatedAt: new Date(now) },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: new Date(now), messagesSent: 0 },
    createdAt: new Date(now - 60 * DAY),
    updatedAt: new Date(now),
    ...fields,
  }
}

/** `YYYY-MM-DD` for somebody who turned `years` today, minus a year's margin. */
function bornYearsAgo(years: number): string {
  const today = new Date()
  return new Date(Date.UTC(today.getUTCFullYear() - years, 0, 1)).toISOString().slice(0, 10)
}

/** A thread past the gate unless told otherwise. */
function thread(
  a: string,
  b: string,
  fields: { each?: number; days?: number; participants?: string[] } = {},
): Conversation {
  const now = new Date()
  const each = fields.each ?? STICKER_GIFT_RULES.messagesEach
  const participants = fields.participants ?? [a, b]
  return {
    _id: new ObjectId(),
    participants,
    pairKey: [...participants].sort().join(':') + ':' + new ObjectId().toHexString(),
    lastMessage: { body: 'hi', senderId: a, createdAt: now },
    unread: {},
    firstMessageBy: a,
    firstMessageAt: new Date(now.getTime() - (fields.days ?? 10) * DAY),
    bothSpoke: true,
    messageCount: each * 2,
    messageCountBy: { [a]: each, [b]: each },
    createdAt: new Date(now.getTime() - 10 * DAY),
    updatedAt: now,
  } as Conversation
}

describe('giving a sticker pack', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_sticker_gifts_test')
    await ensureIndexes(handle.db)
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.conversations,
      COLLECTIONS.messages,
      COLLECTIONS.blocks,
      COLLECTIONS.reports,
      COLLECTIONS.devices,
      COLLECTIONS.session,
      COLLECTIONS.tokenLedger,
      COLLECTIONS.tokenAggregates,
      COLLECTIONS.stickerGifts,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    await setFlag(true)
  })

  async function setFlag(on: boolean) {
    await updateAppConfig(handle.db, { flags: { ...DEFAULT_APP_CONFIG.flags, stickerGifts: on } })
  }

  async function earn(userId: string, tokens: number) {
    await handle.db.collection(COLLECTIONS.tokenAggregates).insertOne({
      _id: aggregateId(userId, 'all', 'all') as unknown as ObjectId,
      userId,
      periodType: 'all',
      periodKey: 'all',
      tokens,
      updatedAt: new Date(),
    })
  }

  /** A giver with plenty of tokens, a recipient, and a thread past the gate between them. */
  async function pair(
    giverFields: Partial<Profile> = {},
    recipientFields: Partial<Profile> = {},
    threadFields: Parameters<typeof thread>[2] = {},
  ) {
    const giver = id()
    const recipient = id()
    await profiles().insertMany([person(giver, giverFields), person(recipient, recipientFields)])
    await earn(giver, 10_000)
    const conversation = thread(giver, recipient, threadFields)
    await conversations().insertOne(conversation)
    return { giver, recipient, conversation }
  }

  const profiles = () => handle.db.collection<Profile>(COLLECTIONS.profiles)
  const conversations = () => handle.db.collection<Conversation>(COLLECTIONS.conversations)
  const gifts = () => handle.db.collection<StickerGift>(COLLECTIONS.stickerGifts)

  function give(giver: string, conversation: Conversation, clientId = id(), packId = PACK) {
    return giveStickerPack(handle.db, giver, {
      conversationId: conversation._id.toHexString(),
      packId,
      clientId,
    })
  }

  /** The refusal's `reason`, or the error code for a refusal that is not a gift's own. */
  async function refusal(promise: Promise<unknown>): Promise<string> {
    try {
      await promise
    } catch (error) {
      if (error instanceof ApiError) return error.reason ?? error.code
      throw error
    }
    throw new Error('expected a refusal')
  }

  /** Nothing was charged, nothing was granted, nothing was written. */
  async function nothingHappened(giver: string, recipient: string) {
    expect((await profiles().findOne({ _id: giver }))?.tokenSpent ?? 0).toBe(0)
    expect((await profiles().findOne({ _id: recipient }))?.cosmetics ?? []).not.toContain(PACK)
    expect(await gifts().countDocuments({})).toBe(0)
    expect(await handle.db.collection(COLLECTIONS.messages).countDocuments({ type: 'gift' })).toBe(
      0,
    )
  }

  it('charges the giver, gives the pack and leaves a gift row in the thread', async () => {
    const { giver, recipient, conversation } = await pair()

    const given = await give(giver, conversation)

    expect(given.created).toBe(true)
    expect(given.result.price).toBe(PRICE)
    expect(given.result.wallet.balance).toBe(10_000 - PRICE)
    expect((await profiles().findOne({ _id: giver }))?.tokenSpent).toBe(PRICE)
    const after = await profiles().findOne({ _id: recipient })
    expect(after?.cosmetics).toContain(PACK)
    // The recipient's own balance is untouched: nothing is credited to them.
    expect(after?.tokenSpent ?? 0).toBe(0)

    const message = await handle.db
      .collection<Message>(COLLECTIONS.messages)
      .findOne({ _id: given.message._id })
    expect(message?.type).toBe('gift')
    expect(message?.gift).toEqual({ giftId: given.result.giftId, packId: PACK })

    const thread = await conversations().findOne({ _id: conversation._id })
    expect(thread?.unread[recipient]).toBe(1)
    expect(thread?.lastMessage.body).toBe('🎁 Sticker pack gift')
    // Not a message anybody wrote: the gates' counters do not move.
    expect(thread?.messageCountBy).toEqual(conversation.messageCountBy)
    expect(thread?.messageCount).toBe(conversation.messageCount)

    const ledger = await handle.db
      .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
      .find({ userId: giver })
      .toArray()
    expect(ledger).toHaveLength(1)
    expect(ledger[0]).toMatchObject({ kind: 'spend', amount: -PRICE })
    // A spend never reaches the aggregates the leaderboards rank.
    const aggregate = await handle.db
      .collection(COLLECTIONS.tokenAggregates)
      .findOne({ _id: aggregateId(giver, 'all', 'all') as unknown as ObjectId })
    expect(aggregate?.tokens).toBe(10_000)
  })

  it('answers a retry with the first gift and charges once', async () => {
    const { giver, conversation } = await pair()
    const clientId = id()

    const first = await give(giver, conversation, clientId)
    const second = await give(giver, conversation, clientId)

    expect(second.created).toBe(false)
    expect(second.result.giftId).toBe(first.result.giftId)
    expect((await profiles().findOne({ _id: giver }))?.tokenSpent).toBe(PRICE)
    expect(await gifts().countDocuments({})).toBe(1)
  })

  it('charges once when the same tap arrives twice at the same moment', async () => {
    const { giver, conversation } = await pair()
    const clientId = id()

    const results = await Promise.allSettled([
      give(giver, conversation, clientId),
      give(giver, conversation, clientId),
    ])

    // Both copies are the same tap, so both report the same success — never
    // the loser reading its own gift as `weeklyLimit`.
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
    const ids = results.map((r) => (r.status === 'fulfilled' ? r.value.result.giftId : null))
    expect(ids[0]).toBe(ids[1])
    expect((await profiles().findOne({ _id: giver }))?.tokenSpent).toBe(PRICE)
    expect(await gifts().countDocuments({})).toBe(1)
  })

  it('answers the second copy with the gift when the first lands during its checks', async () => {
    const { giver, conversation } = await pair()
    const clientId = id()

    /*
     * The interleaving the race above only hits now and then, pinned: the
     * second copy looks for its client id before the first has committed,
     * and the first commits before the second reaches the checks that its
     * own gift now fails — the pack is owned and the week's gift is given.
     */
    let first: Awaited<ReturnType<typeof give>> | null = null
    let looked = false
    const lateLookup = new Proxy(handle.db, {
      get(target, prop) {
        if (prop === 'collection') {
          return (name: string) => {
            const collection = target.collection(name)
            if (name !== COLLECTIONS.stickerGifts) return collection
            return new Proxy(collection, {
              get(inner, key) {
                if (key === 'findOne' && !looked) {
                  looked = true
                  return async () => {
                    first = await give(giver, conversation, clientId)
                    return null
                  }
                }
                const value: unknown = Reflect.get(inner, key, inner)
                if (typeof value !== 'function') return value
                return (value as (...args: unknown[]) => unknown).bind(inner)
              },
            })
          }
        }
        const value: unknown = Reflect.get(target, prop, target)
        if (typeof value !== 'function') return value
        return (value as (...args: unknown[]) => unknown).bind(target)
      },
    })

    const second = await giveStickerPack(lateLookup, giver, {
      conversationId: conversation._id.toHexString(),
      packId: PACK,
      clientId,
    })

    expect(first).not.toBeNull()
    expect(second.created).toBe(false)
    expect(second.result.giftId).toBe(first!.result.giftId)
    expect((await profiles().findOne({ _id: giver }))?.tokenSpent).toBe(PRICE)
    expect(await gifts().countDocuments({})).toBe(1)
  })

  it('rolls everything back when the thread goes in the middle of the gift', async () => {
    const { giver, recipient, conversation } = await pair()
    // `conversations.findOneAndUpdate` matching nothing: the thread purged
    // between the access check and the transaction's last write.
    const vanishing = new Proxy(handle.db, {
      get(target, prop) {
        if (prop === 'collection') {
          return (name: string) => {
            const collection = target.collection(name)
            if (name !== COLLECTIONS.conversations) return collection
            return new Proxy(collection, {
              get(inner, key) {
                if (key === 'findOneAndUpdate') return () => Promise.resolve(null)
                const value: unknown = Reflect.get(inner, key, inner)
                if (typeof value !== 'function') return value
                return (value as (...args: unknown[]) => unknown).bind(inner)
              },
            })
          }
        }
        const value: unknown = Reflect.get(target, prop, target)
        if (typeof value !== 'function') return value
        return (value as (...args: unknown[]) => unknown).bind(target)
      },
    })
    const attempt = giveStickerPack(vanishing, giver, {
      conversationId: conversation._id.toHexString(),
      packId: PACK,
      clientId: id(),
    })
    expect(await refusal(attempt)).toBe('NOT_FOUND')
    await nothingHappened(giver, recipient)
    expect(
      await handle.db.collection(COLLECTIONS.tokenLedger).countDocuments({ userId: giver }),
    ).toBe(0)
  })

  it('refuses a retry once the switch is off', async () => {
    const { giver, conversation } = await pair()
    const clientId = id()
    await give(giver, conversation, clientId)
    await setFlag(false)
    expect(await refusal(give(giver, conversation, clientId))).toBe('disabled')
  })

  it('says keep talking, not unavailable, while the thread is unopened', async () => {
    for (const fields of [
      { birthDate: bornYearsAgo(17) },
      { suspension: { until: new Date(Date.now() + DAY) } } as Partial<Profile>,
      { tokenFrozenAt: new Date() },
    ]) {
      const { giver, recipient, conversation } = await pair({}, fields, { each: 3 })
      expect(await refusal(give(giver, conversation))).toBe('keepTalking')
      await nothingHappened(giver, recipient)
      const options = await getStickerGiftOptions(handle.db, giver, PACK)
      expect(options.partners.find((p) => p.userId === recipient)?.state).toBe('keepTalking')
      await conversations().deleteMany({})
    }
  })

  it('refuses everything while the switch is off', async () => {
    await setFlag(false)
    const { giver, recipient, conversation } = await pair()
    expect(await refusal(give(giver, conversation))).toBe('disabled')
    await nothingHappened(giver, recipient)
    expect((await getStickerGiftOptions(handle.db, giver, PACK)).refusal).toBe('disabled')
  })

  it('refuses anything that is not a sticker pack', async () => {
    const { giver, recipient, conversation } = await pair()
    expect(await refusal(give(giver, conversation, id(), 'frame.slate'))).toBe('notGiftable')
    expect(await refusal(give(giver, conversation, id(), 'stickers.nope'))).toBe('notGiftable')
    await nothingHappened(giver, recipient)
  })

  it('refuses a recipient who blocked the giver, and one the giver blocked', async () => {
    for (const direction of ['theyBlocked', 'iBlocked'] as const) {
      const { giver, recipient, conversation } = await pair()
      await handle.db.collection(COLLECTIONS.blocks).insertOne({
        _id: new ObjectId(),
        blockerId: direction === 'theyBlocked' ? recipient : giver,
        blockedId: direction === 'theyBlocked' ? giver : recipient,
        createdAt: new Date(),
      })
      expect(await refusal(give(giver, conversation))).toBe('BLOCKED')
      await nothingHappened(giver, recipient)
      const options = await getStickerGiftOptions(handle.db, giver, PACK)
      expect(options.partners.map((p) => p.userId)).not.toContain(recipient)
    }
  })

  it('refuses a conversation the giver is not in', async () => {
    const { recipient, conversation } = await pair()
    const stranger = id()
    await profiles().insertOne(person(stranger))
    await earn(stranger, 10_000)
    expect(await refusal(give(stranger, conversation))).toBe('NOT_FOUND')
    await nothingHappened(stranger, recipient)
  })

  it('refuses a gift to yourself', async () => {
    const giver = id()
    await profiles().insertOne(person(giver))
    await earn(giver, 10_000)
    const alone = thread(giver, giver, { participants: [giver, giver] })
    await conversations().insertOne(alone)
    expect(await refusal(give(giver, alone))).toBe('unavailable')
    expect((await profiles().findOne({ _id: giver }))?.tokenSpent ?? 0).toBe(0)
    expect((await profiles().findOne({ _id: giver }))?.cosmetics ?? []).not.toContain(PACK)
  })

  it('refuses before charging when the recipient already owns the pack', async () => {
    const { giver, recipient, conversation } = await pair({}, { cosmetics: [PACK] })
    expect(await refusal(give(giver, conversation))).toBe('recipientOwns')
    expect((await profiles().findOne({ _id: giver }))?.tokenSpent ?? 0).toBe(0)
    expect(await gifts().countDocuments({})).toBe(0)
    void recipient
  })

  it('refuses a thread that has not talked enough, or not for long enough', async () => {
    const few = await pair({}, {}, { each: STICKER_GIFT_RULES.messagesEach - 1 })
    expect(await refusal(give(few.giver, few.conversation))).toBe('keepTalking')
    await nothingHappened(few.giver, few.recipient)

    const young = await pair({}, {}, { days: STICKER_GIFT_RULES.minThreadDays - 1 })
    expect(await refusal(give(young.giver, young.conversation))).toBe('keepTalking')
    await nothingHappened(young.giver, young.recipient)
  })

  it('refuses a minor at either end', async () => {
    const minorRecipient = await pair({}, { birthDate: bornYearsAgo(17) })
    expect(await refusal(give(minorRecipient.giver, minorRecipient.conversation))).toBe(
      'unavailable',
    )
    await nothingHappened(minorRecipient.giver, minorRecipient.recipient)

    const minorGiver = await pair({ birthDate: bornYearsAgo(17) })
    expect(await refusal(give(minorGiver.giver, minorGiver.conversation))).toBe('notEligible')
    await nothingHappened(minorGiver.giver, minorGiver.recipient)
  })

  it('refuses a suspended, deleted or frozen recipient', async () => {
    for (const fields of [
      { suspension: { until: new Date(Date.now() + DAY) } } as Partial<Profile>,
      { deletedAt: new Date() },
      { tokenFrozenAt: new Date() },
    ]) {
      const { giver, recipient, conversation } = await pair({}, fields)
      expect(await refusal(give(giver, conversation))).toBe('unavailable')
      await nothingHappened(giver, recipient)
    }
  })

  it('refuses a frozen giver, and one whose account is too new', async () => {
    const frozen = await pair({ tokenFrozenAt: new Date() })
    expect(await refusal(give(frozen.giver, frozen.conversation))).toBe('notEligible')
    await nothingHappened(frozen.giver, frozen.recipient)

    const fresh = await pair({
      createdAt: new Date(Date.now() - (STICKER_GIFT_RULES.minGiverAccountDays - 1) * DAY),
    })
    expect(await refusal(give(fresh.giver, fresh.conversation))).toBe('notEligible')
    await nothingHappened(fresh.giver, fresh.recipient)
  })

  it('refuses between two people with a report between them, either way', async () => {
    for (const direction of ['theyReported', 'iReported'] as const) {
      const { giver, recipient, conversation } = await pair()
      await handle.db.collection(COLLECTIONS.reports).insertOne({
        _id: new ObjectId(),
        reporterId: direction === 'theyReported' ? recipient : giver,
        reportedId: direction === 'theyReported' ? giver : recipient,
        reason: 'spam',
        status: 'dismissed',
        createdAt: new Date(),
      })
      expect(await refusal(give(giver, conversation))).toBe('unavailable')
      await nothingHappened(giver, recipient)
    }
  })

  it('refuses two accounts that share an installation, without saying so', async () => {
    const { giver, recipient, conversation } = await pair()
    await handle.db.collection(COLLECTIONS.devices).insertMany([
      { _id: new ObjectId(), userId: giver, pushToken: 't1', platform: 'ios', deviceId: 'same' },
      {
        _id: new ObjectId(),
        userId: recipient,
        pushToken: 't2',
        platform: 'ios',
        deviceId: 'same',
      },
    ])
    expect(await refusal(give(giver, conversation))).toBe('unavailable')
    await nothingHappened(giver, recipient)
  })

  it('refuses a giver who cannot afford it', async () => {
    const giver = id()
    const recipient = id()
    await profiles().insertMany([person(giver), person(recipient)])
    await earn(giver, PRICE - 1)
    const conversation = thread(giver, recipient)
    await conversations().insertOne(conversation)
    expect(await refusal(give(giver, conversation))).toBe('notEnoughTokens')
    await nothingHappened(giver, recipient)
  })

  it('allows one gift a week, even when two are sent at once', async () => {
    const giver = id()
    const [a, b, c] = [id(), id(), id()]
    await profiles().insertMany([person(giver), person(a), person(b), person(c)])
    await earn(giver, 10_000)
    const [ta, tb, tc] = [thread(giver, a), thread(giver, b), thread(giver, c)]
    await conversations().insertMany([ta, tb, tc])

    const raced = await Promise.allSettled([give(giver, ta), give(giver, tb)])
    expect(raced.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await profiles().findOne({ _id: giver }))?.tokenSpent).toBe(PRICE)

    expect(await refusal(give(giver, tc))).toBe('weeklyLimit')
    expect((await profiles().findOne({ _id: giver }))?.tokenSpent).toBe(PRICE)
    expect(await gifts().countDocuments({})).toBe(1)
    expect((await getStickerGiftOptions(handle.db, giver, PACK)).refusal).toBe('weeklyLimit')
  })

  it(`stops a recipient at ${STICKER_GIFT_RULES.receivesPerMonth} gifts a month`, async () => {
    const recipient = id()
    await profiles().insertOne(person(recipient))
    const packs = ['stickers.paper', 'stickers.starter', 'stickers.practice']
    const givers = [id(), id(), id()]
    for (const [index, giver] of givers.entries()) {
      await profiles().insertOne(person(giver))
      await earn(giver, 10_000)
      const conversation = thread(giver, recipient)
      await conversations().insertOne(conversation)
      const attempt = give(giver, conversation, id(), packs[index])
      if (index < STICKER_GIFT_RULES.receivesPerMonth) {
        await attempt
      } else {
        expect(await refusal(attempt)).toBe('unavailable')
        expect((await profiles().findOne({ _id: giver }))?.tokenSpent ?? 0).toBe(0)
      }
    }
    expect(await gifts().countDocuments({ recipientId: recipient })).toBe(
      STICKER_GIFT_RULES.receivesPerMonth,
    )
  })

  it('leaves the gift row out of reach of reactions', async () => {
    const { giver, recipient, conversation } = await pair()
    const given = await give(giver, conversation)
    await expect(
      reactToMessage(handle.db, recipient, {
        conversationId: conversation._id.toHexString(),
        messageId: given.message._id.toHexString(),
        emoji: '❤️',
      }),
    ).rejects.toThrow(ApiError)
  })

  it('lists partners with what a gift to each would meet', async () => {
    const giver = id()
    const [ready, owns, quiet, minor] = [id(), id(), id(), id()]
    await profiles().insertMany([
      person(giver),
      person(ready),
      person(owns, { cosmetics: [PACK] }),
      person(quiet),
      person(minor, { birthDate: bornYearsAgo(17) }),
    ])
    await earn(giver, 10_000)
    await conversations().insertMany([
      thread(giver, ready),
      thread(giver, owns),
      thread(giver, quiet, { each: 3 }),
      thread(giver, minor),
    ])

    const options = await getStickerGiftOptions(handle.db, giver, PACK)
    expect(options.refusal).toBeNull()
    expect(options.sendsLeftThisWeek).toBe(STICKER_GIFT_RULES.sendsPerWeek)
    const state = Object.fromEntries(options.partners.map((p) => [p.userId, p.state]))
    expect(state).toEqual({
      [ready]: 'ready',
      [owns]: 'recipientOwns',
      [quiet]: 'keepTalking',
      [minor]: 'unavailable',
    })
  })
})
