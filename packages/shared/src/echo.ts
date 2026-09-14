import { z } from 'zod'
import { languageCodeSchema } from './languages'
import { ECHO_GRADES, SRS_RULES } from './srs'
import { TOKEN_RULES } from './token'

/**
 * Echo: the cards a person keeps out of their own conversations.
 *
 * Written as zod schemas rather than as the hand-written interfaces chat uses
 * for its view models, and the reason is `srs`. The client recomputes
 * `schedule()` on a card it received over the wire, to draw the interval on
 * each grade button before the server has been asked. One schema is how both
 * sides stay agreed on the shape it recomputes from; two declarations of it
 * is how they stop being agreed without anything failing.
 */

/**
 * The front is capped, not the message.
 *
 * 200, the same as a phrase card's meaning. A longer message is still offered
 * the action and its first 200 characters become the card — refusing would
 * make the gesture fail on exactly the long sentences somebody most wants to
 * keep, and the phrase-card form is there for a specific clause.
 */
export const ECHO_FRONT_MAX_LENGTH = 200
export const ECHO_BACK_MAX_LENGTH = 200

/**
 * How many grades one request may carry.
 *
 * Ten sessions' worth. A session is `SRS_RULES.sessionSize` cards and submits
 * once, so anything near this is a client that has been offline and is
 * catching up — which is allowed — rather than a normal send.
 */
export const ECHO_REVIEW_BATCH_MAX = 10 * SRS_RULES.sessionSize

/** Where a card came from. The string form is `sourceKey`; see below. */
export const ECHO_SOURCE_KINDS = ['chat', 'post', 'phrase', 'pack'] as const
export type EchoSourceKind = (typeof ECHO_SOURCE_KINDS)[number]

export const echoSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('chat'),
    conversationId: z.string(),
    messageId: z.string(),
    /** Who said it, so the session can name them and the row can show a face. */
    partnerId: z.string(),
  }),
  z.object({ kind: z.literal('post'), postId: z.string(), authorId: z.string() }),
  z.object({ kind: z.literal('phrase'), phraseCardId: z.string(), conversationId: z.string() }),
  z.object({ kind: z.literal('pack'), packId: z.string(), itemId: z.string() }),
])
export type EchoSource = z.infer<typeof echoSourceSchema>

/**
 * The source flattened to one string, and the second half of the unique index
 * `{ userId, sourceKey }`.
 *
 * It exists for that index and nothing else. A compound uniqueness across a
 * tagged union cannot be expressed in a Mongo index, and "one card per
 * message, per post, per phrase card, per pack item" has to be an invariant
 * rather than something a handler remembers to check.
 */
export function sourceKeyOf(source: EchoSource): string {
  switch (source.kind) {
    case 'chat':
      return `msg:${source.messageId}`
    case 'post':
      return `post:${source.postId}`
    case 'phrase':
      return `phrase:${source.phraseCardId}`
    case 'pack':
      return `pack:${source.itemId}`
  }
}

/**
 * Where a card's recording came from, so the session can say who is speaking.
 *
 * A URL rather than a storage key, like every other piece of media in this
 * codebase: `Media` carries `url`, `keyFromPublicUrl` returns null for every
 * attachment imported from v1, and neither the app nor the API has anything
 * that turns a key back into something playable.
 */
export const echoAudioSchema = z.object({
  url: z.url(),
  /** A deliberate slower take, when the person who recorded it made one. */
  slowUrl: z.url().optional(),
  origin: z.enum(['post', 'chat', 'pack']),
  /** The speaker's display name. Absent means the card does not claim one. */
  speakerName: z.string().optional(),
})
export type EchoAudio = z.infer<typeof echoAudioSchema>

/** The picture that came with the sentence. Copied, never generated. */
export const echoImageSchema = z.object({
  url: z.url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  origin: z.enum(['chat', 'pack']),
})
export type EchoImage = z.infer<typeof echoImageSchema>

/**
 * The schedule as it travels. `due` and `lastReviewedAt` are ISO strings here
 * and `Date`s in `srs.ts`; the client parses before it calls `schedule()`.
 */
export const echoSrsSchema = z.object({
  state: z.enum(['learning', 'review']),
  step: z.number().int().nonnegative(),
  due: z.string(),
  interval: z.number().int().nonnegative(),
  ease: z.number(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  lastReviewedAt: z.string().nullable(),
})
export type EchoSrsDto = z.infer<typeof echoSrsSchema>

export const echoCardSchema = z.object({
  _id: z.string(),
  /** The sentence, as it was written. Never translated interface copy. */
  front: z.string(),
  /** What it means, in the reader's language. Empty when nothing could translate it. */
  back: z.string(),
  /** Filled only by a phrase card, whose author typed one. */
  example: z.string().optional(),
  lang: z.string(),
  source: echoSourceSchema,
  audio: echoAudioSchema.optional(),
  image: echoImageSchema.optional(),
  srs: echoSrsSchema,
  createdAt: z.string(),
})
export type EchoCard = z.infer<typeof echoCardSchema>

export const echoCardPageSchema = z.object({
  items: z.array(echoCardSchema),
  nextCursor: z.string().nullable(),
})
export type EchoCardPage = z.infer<typeof echoCardPageSchema>

export const echoQueueSchema = z.object({
  /** At most `SRS_RULES.sessionSize`, oldest due first. */
  cards: z.array(echoCardSchema),
  /** Everything due, not just what fits in this session. */
  dueCount: z.number().int().nonnegative(),
  sessionSize: z.number().int().positive(),
})
export type EchoQueue = z.infer<typeof echoQueueSchema>

export const echoLanguageSummarySchema = z.object({
  lang: z.string(),
  total: z.number().int().nonnegative(),
  due: z.number().int().nonnegative(),
})

export const echoSummarySchema = z.object({
  due: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** Every language the person has a card in, most cards first. */
  languages: z.array(echoLanguageSummarySchema),
  reviewedToday: z.number().int().nonnegative(),
})
export type EchoSummary = z.infer<typeof echoSummarySchema>

/**
 * What a client may ask to capture.
 *
 * Only the two kinds a person can point at. `phrase` is minted by the server
 * when a phrase card is saved and `pack` by the seed script; accepting either
 * here would let a client claim a card against somebody else's id.
 */
export const captureEchoSchema = z.object({
  source: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('chat'),
      conversationId: z.string().trim().min(1),
      messageId: z.string().trim().min(1),
      /**
       * The translation the reader already has on screen, which lives only in
       * the chat screen's own state. Sending it is what stops the server
       * paying for a second translation of a sentence already translated.
       */
      translation: z.string().trim().min(1).max(ECHO_BACK_MAX_LENGTH).optional(),
      /**
       * What language that translation is in, if one was sent.
       *
       * A loose string rather than a checked language code: the server only
       * ever compares it with the reader's own target, and a value it does
       * not recognise simply means the offer is ignored and the translation
       * is fetched. Nothing is routed on it, so there is nothing to protect.
       */
      translationLang: z.string().trim().min(1).max(16).optional(),
    }),
    z.object({ kind: z.literal('post'), postId: z.string().trim().min(1) }),
  ]),
})
export type CaptureEchoInput = z.infer<typeof captureEchoSchema>

export const captureEchoResultSchema = z.object({
  card: echoCardSchema,
  /**
   * False when the card was already there. The unique index makes a second
   * capture a no-op rather than an error, and the toast should say which
   * happened instead of claiming a new card.
   */
  created: z.boolean(),
})
export type CaptureEchoResult = z.infer<typeof captureEchoResultSchema>

/**
 * Minted by the client, one per graded card, before the batch is sent.
 *
 * Minted at grade time and not at submit time: the unique `{ userId, reviewId }`
 * is what makes a session submitted twice physically incapable of advancing a
 * card twice, and an id generated inside the retry would be fresh every time.
 */
export const echoReviewIdSchema = z.string().trim().min(8).max(64)

export const submitEchoReviewsSchema = z.object({
  reviews: z
    .array(
      z.object({
        reviewId: echoReviewIdSchema,
        cardId: z.string().trim().min(1),
        grade: z.enum(ECHO_GRADES),
        /** How long the card was on screen. Recorded, not yet used. */
        durationMs: z
          .number()
          .int()
          .nonnegative()
          .max(10 * 60 * 1000),
      }),
    )
    .min(1)
    .max(ECHO_REVIEW_BATCH_MAX),
})
export type SubmitEchoReviewsInput = z.infer<typeof submitEchoReviewsSchema>

/**
 * What happened to each grade.
 *
 * `duplicate` is a success, not a failure: it means the unique index has
 * already applied this exact review, which is the whole point of the client
 * minting the id. `srs` comes back on it too, so a retrying client converges
 * on the server's answer rather than keeping its optimistic guess.
 */
export const ECHO_REVIEW_STATUSES = ['applied', 'duplicate', 'missing'] as const
export type EchoReviewStatus = (typeof ECHO_REVIEW_STATUSES)[number]

export const echoReviewResultSchema = z.object({
  reviewId: z.string(),
  cardId: z.string(),
  status: z.enum(ECHO_REVIEW_STATUSES),
  /** Null only when the card is gone. */
  srs: echoSrsSchema.nullable(),
})

export const submitEchoReviewsResultSchema = z.object({
  results: z.array(echoReviewResultSchema),
})
export type SubmitEchoReviewsResult = z.infer<typeof submitEchoReviewsResultSchema>

export const listEchoCardsQuerySchema = z.object({
  lang: languageCodeSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export type ListEchoCardsQuery = z.infer<typeof listEchoCardsQuerySchema>

export const echoQueueQuerySchema = z.object({
  lang: languageCodeSchema.optional(),
})
export type EchoQueueQuery = z.infer<typeof echoQueueQuerySchema>

/**
 * The ledger key for the nth completed session of one local day.
 *
 * A session is counted rather than recorded: there is no session row, only
 * graded cards, so "the third session of the 14th" is the honest identity for
 * a payment. `user_kind_ref_unique` then makes paying it twice impossible,
 * which is what lets `submitReviews` recompute from scratch on every batch
 * without remembering what it already paid.
 */
export function echoSessionRefId(localDay: string, sessionNumber: number): string {
  return `echo:${localDay}:${sessionNumber}`
}

/**
 * How many sessions a day's reviews have completed, and so how many are
 * payable — capped at `TOKEN_RULES.caps.echoSessionsPerDay`.
 *
 * Floor, not round: eight cards is not a session. The cap is applied here so
 * that the number of payments and the number the app could draw are the same
 * number, computed by one function.
 */
export function completedEchoSessions(reviewedToday: number): number {
  return Math.min(
    Math.floor(reviewedToday / SRS_RULES.sessionSize),
    TOKEN_RULES.caps.echoSessionsPerDay,
  )
}
