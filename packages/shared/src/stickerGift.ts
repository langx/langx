import { z } from 'zod'
import { clientMessageIdSchema, stickerIdSchema } from './chat'
import type { Cosmetic } from './cosmetics'
import { isIncludedCosmetic, walletSchema } from './cosmetics'

/**
 * Giving a sticker pack to a chat partner, behind `flags.stickerGifts`.
 *
 * The giver buys a **new copy** for the recipient with their own tokens. It
 * is not a transfer of something the giver owns: a transfer would let the
 * items a subscription hands out (`PRO_WELCOME_PACKS`) move to somebody who
 * never paid, and money would be buying things for other people. The
 * recipient's balance never changes, and neither does anybody's place on a
 * leaderboard — spending is not ranked.
 *
 * Sticker packs only, and only as a first step: they are content rather than
 * rank (`isLadderKind`), they are priced 1,000–1,500, and a pack somebody is
 * given is mostly used in the thread it came from. See `docs/decisions.md` →
 * _A sticker pack can be given to a chat partner, behind a switch_.
 */
export const STICKER_GIFT_RULES = {
  /**
   * Gifts one account may send in an ISO week (UTC). The cap, together with
   * the price, is what bounds how much value a ring of throwaway accounts can
   * move to one main account — not the conversation threshold, which two
   * accounts held by one person can clear by talking to themselves.
   */
  sendsPerWeek: 1,
  /** Gifts one account may receive in a calendar month (UTC), from anybody. */
  receivesPerMonth: 2,
  /**
   * Messages **each** person must have sent in the thread. The testimonial
   * gate's number (`TESTIMONIAL_UNLOCK_MESSAGES_EACH`), chosen as the stricter
   * of the two the research weighed; each rather than together for the reason
   * the media gate learned on 4 September 2026.
   */
  messagesEach: 50,
  /** Days since the thread's first message. Time cannot be farmed in an hour. */
  minThreadDays: 3,
  /**
   * Days since the giver's profile was made. Turns a throwaway account's cost
   * from minutes into weeks, and costs a real user nothing they would notice.
   */
  minGiverAccountDays: 14,
} as const

/**
 * Whether an item can be given at all.
 *
 * A sticker pack with no condition beyond its price. A frame or a title is a
 * rank and is not given in this step; anything with `requires` describes an
 * achievement of the person who holds it, and nobody else's tokens can buy
 * that for them. An included pack (`isIncludedCosmetic`) is not given
 * either: the other person already has it, and a gift of nothing would still
 * use up a week's send and a month's receive.
 */
export function isGiftableCosmetic(cosmetic: Cosmetic): boolean {
  return cosmetic.kind === 'stickers' && !cosmetic.requires && !isIncludedCosmetic(cosmetic)
}

const DAY_MS = 24 * 60 * 60 * 1000

export interface StickerGiftThreadInput {
  participants: readonly string[]
  /** `conversations.messageCountBy`. Absent reads as locked — the gate fails closed. */
  messageCountBy: Readonly<Record<string, number>> | undefined
  firstMessageAt: Date
  now: Date
}

/**
 * Whether these two have talked enough for a gift between them. Pure, and the
 * shape `testimonialUnlocked` has, so the server's gate and its tests read one
 * function. The client is never told the numbers: the picker says "keep
 * talking", not "38 more messages".
 */
export function stickerGiftThreadOpen(input: StickerGiftThreadInput): boolean {
  const { participants, messageCountBy, firstMessageAt, now } = input
  if (!messageCountBy || participants.length !== 2) return false
  const eachSpoke = participants.every(
    (id) => (messageCountBy[id] ?? 0) >= STICKER_GIFT_RULES.messagesEach,
  )
  if (!eachSpoke) return false
  return now.getTime() - firstMessageAt.getTime() >= STICKER_GIFT_RULES.minThreadDays * DAY_MS
}

/**
 * Why a gift was refused — the `reason` on a `STICKER_GIFT_REFUSED` error,
 * and the state of a row in the partner picker.
 *
 * - `disabled` — `flags.stickerGifts` is off.
 * - `notGiftable` — not a sticker pack, or one with a condition.
 * - `notEligible` — the giver: a minor, an account too new, or one whose
 *   token earning is frozen for review.
 * - `keepTalking` — the thread has not reached the threshold yet.
 * - `recipientOwns` — they already have it. Refused before anything is charged.
 * - `weeklyLimit` — the giver has given this week's gift.
 * - `notEnoughTokens` — the giver cannot afford it.
 * - `unavailable` — everything about the other person that is theirs, not the
 *   giver's, to have told: a minor, a suspended or deleted account, one
 *   that has had this month's gifts, a report between the two, or two
 *   accounts that look like one person's. One word on purpose — the giver is
 *   owed a no, not the reason, and the last two must never be explained.
 */
export const STICKER_GIFT_REFUSALS = [
  'disabled',
  'notGiftable',
  'notEligible',
  'keepTalking',
  'recipientOwns',
  'weeklyLimit',
  'notEnoughTokens',
  'unavailable',
] as const
export type StickerGiftRefusal = (typeof STICKER_GIFT_REFUSALS)[number]

/** `POST /me/wallet/sticker-gifts` */
export const giveStickerPackSchema = z.object({
  /** The thread the gift goes into; the recipient is its other participant. */
  conversationId: z.string().trim().min(1),
  packId: stickerIdSchema,
  /**
   * One id per tap on Give, minted by the client. A retry with the same id
   * returns the first attempt's gift and charges nothing.
   */
  clientId: clientMessageIdSchema,
})
export type GiveStickerPackInput = z.infer<typeof giveStickerPackSchema>

/** What a gift message carries. Written by the server only, like a call's row. */
export const messageGiftSchema = z.object({
  giftId: z.string(),
  packId: z.string(),
})
export type MessageGift = z.infer<typeof messageGiftSchema>

export const stickerGiftResultSchema = z.object({
  giftId: z.string(),
  packId: z.string(),
  price: z.number().int(),
  conversationId: z.string(),
  messageId: z.string(),
  wallet: walletSchema,
})
export type StickerGiftResult = z.infer<typeof stickerGiftResultSchema>

/** `GET /me/wallet/sticker-gifts/options?packId=` */
export const stickerGiftOptionsQuerySchema = z.object({ packId: stickerIdSchema })

export const STICKER_GIFT_PARTNER_STATES = [
  'ready',
  'keepTalking',
  'recipientOwns',
  'unavailable',
] as const
export type StickerGiftPartnerState = (typeof STICKER_GIFT_PARTNER_STATES)[number]

/** How many threads the picker lists, newest first. */
export const STICKER_GIFT_PARTNERS_MAX = 30

export const stickerGiftOptionsSchema = z.object({
  /**
   * `null` when the giver may give now; otherwise why not, from
   * `STICKER_GIFT_REFUSALS`. The pack page hides its button for `disabled`,
   * `notGiftable` and `notEligible`.
   */
  refusal: z.enum(STICKER_GIFT_REFUSALS).nullable(),
  sendsLeftThisWeek: z.number().int().nonnegative(),
  partners: z.array(
    z.object({
      userId: z.string(),
      conversationId: z.string(),
      displayName: z.string(),
      handle: z.string(),
      avatarUrl: z.string().nullable(),
      state: z.enum(STICKER_GIFT_PARTNER_STATES),
    }),
  ),
})
export type StickerGiftOptions = z.infer<typeof stickerGiftOptionsSchema>
