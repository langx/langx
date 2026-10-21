import {
  ERROR_CODES,
  STICKER_GIFT_PARTNERS_MAX,
  STICKER_GIFT_RULES,
  findCosmetic,
  isAdult,
  isGiftableCosmetic,
  monthKey,
  periodKeys,
  previewFor,
  stickerGiftThreadOpen,
  utcDayKey,
  weekKey,
  type Cosmetic,
  type GiveStickerPackInput,
  type StickerGiftOptions,
  type StickerGiftPartnerState,
  type StickerGiftRefusal,
  type StickerGiftResult,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { getAppConfig } from '../appConfig/appConfig'
import { assertConversationAccess } from '../chat/access'
import type { Conversation, Message } from '../chat/conversations'
import { blockedUserIds, type Report } from '../moderation/blocks'
import { isSuspended } from '../moderation/suspension'
import { isOfficialId } from '../official/accounts'
import type { Profile } from '../profiles/profiles'
import { sharedOrigin } from '../referrals/settle'
import { readAggregates, type TokenLedgerEntry } from './ledger'
import { walletOf } from './wallet'

/** One gift, and the claim on the caps it took. See `COLLECTIONS.stickerGifts`. */
export interface StickerGift {
  _id: ObjectId
  giverId: string
  recipientId: string
  packId: string
  price: number
  conversationId: ObjectId
  messageId: ObjectId
  clientId: string
  week: string
  month: string
  /** `<giverId>:<week>:<n>` — unique, so the weekly cap is a fact about the key space. */
  sendSlot: string
  /** `<recipientId>:<month>:<n>` — unique, for the monthly one. */
  receiveSlot: string
  createdAt: Date
}

export interface GiveStickerPackResult {
  result: StickerGiftResult
  message: Message
  conversation: Conversation
  /**
   * False for a retry answered from its client id. The caller fans out only
   * what it created, or the recipient would be told about one gift twice.
   */
  created: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

function refuse(reason: StickerGiftRefusal, message: string): never {
  throw new ApiError(ERROR_CODES.STICKER_GIFT_REFUSED, message, { reason })
}

/** The fields every check below reads, and nothing else. */
const PERSON_PROJECTION = {
  handle: 1,
  displayName: 1,
  avatarUrl: 1,
  birthDate: 1,
  createdAt: 1,
  guest: 1,
  official: 1,
  deletedAt: 1,
  suspension: 1,
  tokenFrozenAt: 1,
  tokenSpent: 1,
  cosmetics: 1,
} as const

/**
 * Why the giver may not give at all, or `null`.
 *
 * Adults only, by the exact birthday — the newcomer hello's rule, and for a
 * stronger reason here: a gift is a known way for an adult to start a
 * relationship with a 16- or 17-year-old. A frozen account is under review
 * for farming, and a gift is the one place farmed tokens could leave it.
 */
function giverRefusal(profile: Profile | null, now: Date): StickerGiftRefusal | null {
  if (!profile || profile.guest || profile.deletedAt || profile.official) return 'notEligible'
  if (isSuspended(profile, now) || profile.tokenFrozenAt) return 'notEligible'
  if (!isAdult(profile.birthDate, now)) return 'notEligible'
  if (now.getTime() - profile.createdAt.getTime() < STICKER_GIFT_RULES.minGiverAccountDays * DAY_MS)
    return 'notEligible'
  return null
}

/**
 * Whether the other person is somebody nothing can be given to. All of it
 * reads as `unavailable`: these are facts about them, and the giver is owed a
 * no rather than which one.
 */
function recipientClosed(profile: Profile | null, now: Date): boolean {
  if (!profile || profile.guest || profile.deletedAt || profile.official) return true
  if (isOfficialId(profile._id)) return true
  if (isSuspended(profile, now) || profile.tokenFrozenAt) return true
  return !isAdult(profile.birthDate, now)
}

/**
 * Report ids between the giver and any of `others`, in either direction.
 * Any report at all, whatever its status: somebody who reported a person has
 * said something about them that a gift should not be able to answer.
 */
async function reportedAmong(db: Db, giverId: string, others: string[]): Promise<Set<string>> {
  if (others.length === 0) return new Set()
  const rows = await db
    .collection<Report>(COLLECTIONS.reports)
    .find(
      {
        $or: [
          { reporterId: giverId, reportedId: { $in: others } },
          { reporterId: { $in: others }, reportedId: giverId },
        ],
      },
      { projection: { reporterId: 1, reportedId: 1 } },
    )
    .toArray()
  return new Set(rows.map((row) => (row.reporterId === giverId ? row.reportedId : row.reporterId)))
}

async function sentInWeek(db: Db, giverId: string, week: string): Promise<number> {
  return db.collection<StickerGift>(COLLECTIONS.stickerGifts).countDocuments({ giverId, week })
}

async function receivedInMonth(
  db: Db,
  recipientIds: string[],
  month: string,
): Promise<Map<string, number>> {
  if (recipientIds.length === 0) return new Map()
  const rows = await db
    .collection<StickerGift>(COLLECTIONS.stickerGifts)
    .aggregate<{ _id: string; count: number }>([
      { $match: { recipientId: { $in: recipientIds }, month } },
      { $group: { _id: '$recipientId', count: { $sum: 1 } } },
    ])
    .toArray()
  return new Map(rows.map((row) => [row._id, row.count]))
}

function giftablePack(packId: string): Cosmetic {
  const pack = findCosmetic(packId)
  if (!pack || !isGiftableCosmetic(pack)) refuse('notGiftable', `${packId} cannot be given`)
  return pack
}

async function flagOn(db: Db): Promise<boolean> {
  return (await getAppConfig(db)).flags.stickerGifts
}

/** The first attempt's answer, for a retry that carries its client id. */
async function replay(
  db: Db,
  gift: StickerGift,
  giverId: string,
): Promise<GiveStickerPackResult | null> {
  const [message, conversation, giver, earned] = await Promise.all([
    db.collection<Message>(COLLECTIONS.messages).findOne({ _id: gift.messageId }),
    db.collection<Conversation>(COLLECTIONS.conversations).findOne({ _id: gift.conversationId }),
    db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: giverId }),
    readAggregates(db, giverId),
  ])
  if (!message || !conversation || !giver) return null
  return {
    result: {
      giftId: gift._id.toHexString(),
      packId: gift.packId,
      price: gift.price,
      conversationId: gift.conversationId.toHexString(),
      messageId: gift.messageId.toHexString(),
      wallet: walletOf(giver, earned.all),
    },
    message,
    conversation,
    created: false,
  }
}

/**
 * Buys a sticker pack for the other person in a conversation.
 *
 * **Every refusal comes before the charge**, and the charge, the grant, the
 * gift's row, its message, the ledger line and the thread's last line are one
 * transaction. Unlike a purchase, two documents change — the giver's
 * `tokenSpent` and the recipient's `cosmetics` — so the single atomic update
 * `purchase` leans on is not available, and a compensating write (the shape
 * `repairDay` uses) would leave a moment where somebody had paid for a pack
 * nobody received. The replica set the app already needs for Better Auth is
 * what makes the transaction possible.
 *
 * The checks that matter under concurrency are repeated inside it, where
 * they cannot race: the unique indexes on the row hold the caps and the
 * idempotency, the charge's filter holds the balance, and the grant's filter
 * holds "they do not own it yet".
 *
 * Deliberately not `recordMessage`, for `recordCallLog`'s reasons: a gift's
 * row must not count towards `messageCount`/`messageCountBy` — those are what
 * this gate, the media gate and the testimonial gate read — it claims no
 * reciprocity, and it pays the giver nothing.
 */
export async function giveStickerPack(
  db: Db,
  giverId: string,
  input: GiveStickerPackInput,
  now: Date = new Date(),
): Promise<GiveStickerPackResult> {
  const gifts = db.collection<StickerGift>(COLLECTIONS.stickerGifts)

  // The switch first: off means off, retries included.
  if (!(await flagOn(db))) refuse('disabled', 'Gifting is not available')

  // A retry of a gift that was given is answered with that gift whatever has
  // changed since, and charges nothing.
  const already = await gifts.findOne({ giverId, clientId: input.clientId })
  if (already) {
    const answer = await replay(db, already, giverId)
    if (answer) return answer
  }

  const pack = giftablePack(input.packId)

  // Participancy and blocks, both directions, live — the gate every
  // conversation-scoped operation goes through, REST and socket alike.
  const conversation = await assertConversationAccess(db, input.conversationId, giverId)
  const recipientId = conversation.participants.find((id) => id !== giverId)
  if (!recipientId) refuse('unavailable', 'There is nobody else in this conversation')

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const [giver, recipient] = await Promise.all([
    profiles.findOne({ _id: giverId }, { projection: PERSON_PROJECTION }),
    profiles.findOne({ _id: recipientId }, { projection: PERSON_PROJECTION }),
  ])

  const giverNo = giverRefusal(giver, now)
  if (giverNo || !giver) refuse(giverNo ?? 'notEligible', 'This account cannot give gifts')

  /*
   * Before anything about the other person. A thread that has not opened yet
   * says "keep talking" whoever is at the other end — answering `unavailable`
   * here would tell a near-stranger that this person is a minor, suspended
   * or reported, which is exactly what that word exists to hide.
   */
  if (
    !stickerGiftThreadOpen({
      participants: conversation.participants,
      messageCountBy: conversation.messageCountBy,
      firstMessageAt: conversation.firstMessageAt,
      now,
    })
  ) {
    refuse('keepTalking', 'Talk a little longer before giving a gift')
  }

  if (recipientClosed(recipient, now) || !recipient) {
    refuse('unavailable', 'A gift cannot be given to this person')
  }
  if ((await reportedAmong(db, giverId, [recipientId])).size > 0) {
    refuse('unavailable', 'A gift cannot be given to this person')
  }

  const week = weekKey(now)
  const month = monthKey(now)
  const received = (await receivedInMonth(db, [recipientId], month)).get(recipientId) ?? 0
  if (received >= STICKER_GIFT_RULES.receivesPerMonth) {
    refuse('unavailable', 'A gift cannot be given to this person')
  }

  // Before anything is charged, and again in the grant's filter below.
  if ((recipient.cosmetics ?? []).includes(pack.id)) {
    refuse('recipientOwns', `They already have ${pack.id}`)
  }

  const sent = await sentInWeek(db, giverId, week)
  if (sent >= STICKER_GIFT_RULES.sendsPerWeek) {
    refuse('weeklyLimit', 'You have given this week’s gift')
  }

  /*
   * Two accounts that share a network or an installation are, more often
   * than not, one person — and a gift is the first way a second account's
   * tokens could reach the first. Refused as `unavailable`, never explained:
   * the reason is a fact about how we look, and saying it teaches the way
   * round it. The same check the referral settles with.
   */
  if (await sharedOrigin(db, giverId, recipientId)) {
    refuse('unavailable', 'A gift cannot be given to this person')
  }

  const earned = (await readAggregates(db, giverId)).all
  if (earned - (giver.tokenSpent ?? 0) < pack.price) {
    refuse('notEnoughTokens', `${pack.id} costs ${pack.price}`)
  }

  const giftId = new ObjectId()
  const messageId = new ObjectId()
  const gift: StickerGift = {
    _id: giftId,
    giverId,
    recipientId,
    packId: pack.id,
    price: pack.price,
    conversationId: conversation._id,
    messageId,
    clientId: input.clientId,
    week,
    month,
    sendSlot: `${giverId}:${week}:${sent}`,
    receiveSlot: `${recipientId}:${month}:${received}`,
    createdAt: now,
  }
  const message: Message = {
    _id: messageId,
    conversationId: conversation._id,
    senderId: giverId,
    type: 'gift',
    body: '',
    gift: { giftId: giftId.toHexString(), packId: pack.id },
    createdAt: now,
  }
  const keys = periodKeys(now)

  let chargedGiver: Profile | null = null
  let updatedConversation: Conversation | null = null
  const session = db.client.startSession()
  try {
    await session.withTransaction(async () => {
      // The claim: idempotency, both caps and "once per recipient and pack",
      // all on this one insert's unique indexes.
      await gifts.insertOne(gift, { session })

      chargedGiver = await profiles.findOneAndUpdate(
        {
          _id: giverId,
          $expr: { $lte: [{ $add: [{ $ifNull: ['$tokenSpent', 0] }, pack.price] }, earned] },
        },
        { $inc: { tokenSpent: pack.price } },
        { session, returnDocument: 'after' },
      )
      if (!chargedGiver) refuse('notEnoughTokens', `${pack.id} costs ${pack.price}`)

      // `$ne` in the filter: a purchase of the same pack by the recipient a
      // moment ago must turn this into a refusal, not a second copy paid for.
      const granted = await profiles.updateOne(
        { _id: recipientId, cosmetics: { $ne: pack.id } },
        { $addToSet: { cosmetics: pack.id } },
        { session },
      )
      if (granted.modifiedCount !== 1) refuse('recipientOwns', `They already have ${pack.id}`)

      await db.collection<Message>(COLLECTIONS.messages).insertOne(message, { session })

      /*
       * Audit, as `recordSpend` writes it — a negative `spend` that never
       * touches `tokenAggregates`, so giving moves nobody on a leaderboard.
       * Keyed by the gift, so the ledger's unique index says "one charge per
       * gift" as well.
       */
      await db.collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger).insertOne(
        {
          _id: new ObjectId(),
          userId: giverId,
          kind: 'spend',
          amount: -pack.price,
          refId: `stickerGift:${giftId.toHexString()}`,
          day: utcDayKey(now),
          week: keys.week,
          month: keys.month,
          year: keys.year,
          createdAt: now,
        },
        { session },
      )

      // The list's line and the recipient's unread, as a call's row writes
      // them — and nothing that counts as somebody having said something.
      updatedConversation = await db
        .collection<Conversation>(COLLECTIONS.conversations)
        .findOneAndUpdate(
          { _id: conversation._id },
          {
            $set: {
              lastMessage: { body: previewFor('gift'), senderId: giverId, createdAt: now },
              updatedAt: now,
            },
            $inc: { [`unread.${recipientId}`]: 1 },
            $unset: Object.fromEntries(
              conversation.participants.map((id) => [`deletedBy.${id}`, '']),
            ),
          },
          { session, returnDocument: 'after' },
        )
      // The thread went between the access check and here. Refused inside the
      // callback so the charge, the grant and the message roll back with it.
      if (!updatedConversation) {
        throw new ApiError(ERROR_CODES.NOT_FOUND, 'Conversation not found')
      }
    })
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      /*
       * Whichever index said no, ask first whether this tap already won. Two
       * copies of the same tap share the client id *and* the week's slot, and
       * the loser's error can name either — reporting `weeklyLimit` for a gift
       * that was given would be a lie about the person's own tap.
       */
      const first = await gifts.findOne({ giverId, clientId: input.clientId })
      const answer = first ? await replay(db, first, giverId) : null
      if (answer) return answer
      const index = JSON.stringify(error.keyPattern ?? {})
      if (index.includes('sendSlot')) refuse('weeklyLimit', 'You have given this week’s gift')
      if (index.includes('recipientId')) refuse('recipientOwns', `They already have ${pack.id}`)
      refuse('unavailable', 'A gift cannot be given to this person')
    }
    throw error
  } finally {
    await session.endSession()
  }

  const charged = chargedGiver as Profile | null
  const thread = updatedConversation as Conversation | null
  if (!charged || !thread) throw new ApiError(ERROR_CODES.INTERNAL, 'The gift did not complete')

  return {
    result: {
      giftId: giftId.toHexString(),
      packId: pack.id,
      price: pack.price,
      conversationId: conversation._id.toHexString(),
      messageId: messageId.toHexString(),
      wallet: walletOf(charged, earned),
    },
    message,
    conversation: thread,
    created: true,
  }
}

/**
 * What the pack page's Give sheet draws: whether this person may give at
 * all, how many gifts are left this week, and their recent chat partners
 * with what giving each of them this pack would meet.
 *
 * The same rules `giveStickerPack` enforces, minus the linked-account check —
 * a session read per partner is too heavy for a list, and that refusal is the
 * one the giver is never told the reason for anyway. Blocked partners are
 * left out rather than drawn: the thread is closed to both of them.
 */
export async function getStickerGiftOptions(
  db: Db,
  giverId: string,
  packId: string,
  now: Date = new Date(),
): Promise<StickerGiftOptions> {
  const none = (refusal: StickerGiftRefusal, sendsLeftThisWeek = 0): StickerGiftOptions => ({
    refusal,
    sendsLeftThisWeek,
    partners: [],
  })

  if (!(await flagOn(db))) return none('disabled')
  const pack = findCosmetic(packId)
  if (!pack || !isGiftableCosmetic(pack)) return none('notGiftable')

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const giver = await profiles.findOne({ _id: giverId }, { projection: PERSON_PROJECTION })
  const giverNo = giverRefusal(giver, now)
  if (giverNo) return none(giverNo)

  const sendsLeftThisWeek = Math.max(
    0,
    STICKER_GIFT_RULES.sendsPerWeek - (await sentInWeek(db, giverId, weekKey(now))),
  )
  if (sendsLeftThisWeek === 0) return none('weeklyLimit')

  const conversations = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .find({ participants: giverId, [`deletedBy.${giverId}`]: { $exists: false } })
    .sort({ 'lastMessage.createdAt': -1 })
    .limit(STICKER_GIFT_PARTNERS_MAX)
    .toArray()

  const blocked = new Set(await blockedUserIds(db, giverId))
  const threads = conversations.flatMap((conversation) => {
    const other = conversation.participants.find((id) => id !== giverId)
    return other && !blocked.has(other) && !isOfficialId(other) ? [{ conversation, other }] : []
  })
  const others = threads.map((thread) => thread.other)

  const [people, reported, received] = await Promise.all([
    profiles.find({ _id: { $in: others } }, { projection: PERSON_PROJECTION }).toArray(),
    reportedAmong(db, giverId, others),
    receivedInMonth(db, others, monthKey(now)),
  ])
  const byId = new Map(people.map((person) => [person._id, person]))

  const partners: StickerGiftOptions['partners'] = []
  for (const { conversation, other } of threads) {
    const person = byId.get(other) ?? null
    // Gone or never onboarded: nothing to draw a row from.
    if (!person || person.deletedAt) continue
    // `keepTalking` first, for `giveStickerPack`'s reason: an unopened
    // thread must not reveal anything about the person at the other end.
    let state: StickerGiftPartnerState = 'ready'
    if (
      !stickerGiftThreadOpen({
        participants: conversation.participants,
        messageCountBy: conversation.messageCountBy,
        firstMessageAt: conversation.firstMessageAt,
        now,
      })
    ) {
      state = 'keepTalking'
    } else if (
      recipientClosed(person, now) ||
      reported.has(other) ||
      (received.get(other) ?? 0) >= STICKER_GIFT_RULES.receivesPerMonth
    ) {
      state = 'unavailable'
    } else if ((person.cosmetics ?? []).includes(pack.id)) {
      state = 'recipientOwns'
    }
    partners.push({
      userId: other,
      conversationId: conversation._id.toHexString(),
      displayName: person.displayName ?? person.handle,
      handle: person.handle,
      avatarUrl: person.avatarUrl ?? null,
      state,
    })
  }

  return { refusal: null, sendsLeftThisWeek, partners }
}
