import { z } from 'zod'
import { echoVoiceSchema } from './echoPacks'
import { languageCodeSchema } from './languages'
import { mediaSchema } from './media'
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
 * How many recordings one card may hold.
 *
 * A card used to hold exactly one, and keeping a second answer replaced the
 * first — which threw away the thing that makes asking the feed worth doing:
 * two people saying the same sentence differently is the lesson, not noise.
 * Four, because the point is a couple of voices to compare and a card is
 * reviewed in seconds; a queue of ten recordings is a playlist, not a card.
 */
export const ECHO_AUDIO_MAX = 4

/**
 * How many cards one archive call may carry.
 *
 * A hundred, which is a person clearing out a language's worth of easy cards
 * in one go — the reason the action is plural at all. Anything beyond it is a
 * client sending its whole library, and a ceiling is cheaper to reason about
 * than an unbounded `$in`.
 */
export const ECHO_ARCHIVE_BATCH_MAX = 100

/**
 * How many grades one request may carry.
 *
 * Ten sessions' worth. A session is `SRS_RULES.sessionSize` cards and submits
 * once, so anything near this is a client that has been offline and is
 * catching up — which is allowed — rather than a normal send.
 */
export const ECHO_REVIEW_BATCH_MAX = 10 * SRS_RULES.sessionSize

/** Where a card came from. The string form is `sourceKey`; see below. */
export const ECHO_SOURCE_KINDS = ['chat', 'post', 'phrase', 'pack', 'manual'] as const
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
  /**
   * Written by hand, with nothing behind it.
   *
   * The other four name something that exists; this one carries an id that
   * exists only to be different from the last one. Without it `sourceKey`
   * would be the same string for every hand-written card and
   * `card_source_unique` would allow exactly one of them per person.
   */
  z.object({ kind: z.literal('manual'), id: z.string() }),
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
 *
 * A manual card has nothing to be one *per*, so it brings its own id and the
 * invariant becomes idempotency instead: the same `clientId` sent twice is the
 * same card. See `captureEchoSchema`.
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
    case 'manual':
      return `manual:${source.id}`
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
  /**
   * Where the file came from — and, load-bearing, whether it is ours to
   * delete. Every value but `self` names a *copy* of somebody else's object:
   * the message, post or pack it belongs to still plays it, so removing it
   * from a card must never remove it from storage. `self` is the one the card's
   * owner uploaded for this card and nothing else holds.
   */
  origin: z.enum(['post', 'chat', 'pack', 'self']),
  /** The speaker's display name. Absent means the card does not claim one. */
  speakerName: z.string().optional(),
  /**
   * The pronunciation answer this came from, where it came from one.
   *
   * What makes keeping a recording idempotent — pressing the button twice on
   * one answer must not put the same voice on the card twice — and what lets
   * the post screen say which answers are already on the card instead of
   * offering all of them as if none were.
   */
  answerId: z.string().optional(),
})
export type EchoAudio = z.infer<typeof echoAudioSchema>

/** The picture that came with the sentence. Copied, never generated. */
export const echoImageSchema = z.object({
  url: z.url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** As `echoAudioSchema.origin`: only `self` is the card's own file. */
  origin: z.enum(['chat', 'pack', 'self']),
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
  /**
   * How the front is read, copied from a pack whose script does not say —
   * pinyin, on a Chinese card. Absent everywhere else, and taken off when the
   * front is rewritten: it reads a sentence that is gone.
   */
  reading: z.string().optional(),
  /** What it means, in the reader's language. Empty when nothing could translate it. */
  back: z.string(),
  /** Filled only by a phrase card, whose author typed one. */
  example: z.string().optional(),
  lang: z.string(),
  source: echoSourceSchema,
  /**
   * The first recording, and the only one an older client understands.
   *
   * Kept as a mirror of `audios[0]` rather than removed: a card holds several
   * voices now, but a build frozen in the stores reads this field and nothing
   * else, and so do the offline snapshots already written to people's disks.
   * Read it through `echoAudiosOf`, never directly.
   */
  audio: echoAudioSchema.optional(),
  /** Every recording on the card, in the order they were kept. */
  audios: z.array(echoAudioSchema).max(ECHO_AUDIO_MAX).optional(),
  /**
   * Synthesised readings, copied from the pack like every other part of a card.
   *
   * A second list rather than more entries in `audios`, because the two do not
   * behave alike. `audios` are recordings people made of this card; they
   * accumulate as the feed answers, which is why they are capped. These are
   * the pack's own readings: always the same two, never growing, and belonging
   * to nobody — so a cap on them would mean nothing and putting them in the
   * same list would spend the cap that exists to keep people's voices from
   * becoming a playlist.
   *
   * The session draws them under the human takes, quieter and unattributed.
   */
  voices: z.array(echoVoiceSchema).optional(),
  image: echoImageSchema.optional(),
  /**
   * The pronunciation post this card's owner opened from it, when they asked
   * the feed to say the sentence. What lets the post screen offer the answer
   * back to the card it was asked from, in one tap.
   */
  askedPostId: z.string().optional(),
  /**
   * The correction post this card's owner opened from it — the other half of
   * the same idea, and a second field rather than a second use of the one
   * above.
   *
   * One slot would mean asking for a correction forgets the pronunciation
   * post, and the "keep this on my card" button on that post would vanish
   * from under the recordings somebody is still waiting for. Two names, the
   * way an answer carries `media` and `slowMedia` rather than a list it would
   * then have to interpret.
   */
  askedCorrectionPostId: z.string().optional(),
  /**
   * When the card was put away as learned. Absent for a card still in the
   * rotation, which is almost all of them.
   *
   * "Learned" and "archived" are one state rather than two, because they are
   * one thing a person does: some cards — `good morning` — are known before
   * they are ever reviewed, and the only way to stop being asked used to be
   * removing the card, which says "I never wanted this" rather than "I know
   * this". An archived card keeps its schedule and its recordings; it is
   * simply never due.
   */
  archivedAt: z.string().optional(),
  srs: echoSrsSchema,
  createdAt: z.string(),
})
export type EchoCard = z.infer<typeof echoCardSchema>

/**
 * Every recording on a card, whichever field it arrived in.
 *
 * `attachmentsOf`'s sibling, and for the same reason: a card written this
 * morning and one written before cards could hold more than one recording have
 * to look identical to everything downstream.
 */
export function echoAudiosOf(card: {
  audios?: readonly EchoAudio[] | null | undefined
  audio?: EchoAudio | null | undefined
}): EchoAudio[] {
  if (card.audios?.length) return [...card.audios]
  return card.audio ? [card.audio] : []
}

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
  /** A rolling seven days, as `reviewedToday` is a rolling twenty-four hours. */
  reviewedThisWeek: z.number().int().nonnegative(),
  /**
   * When the soonest card that is not yet due comes back, so a tab with
   * nothing to do can say when there will be something. Null when every card
   * is already due, and when there are no cards at all.
   *
   * Optional rather than merely nullable: an app newer than the API it is
   * talking to has to keep working, and the one screen that reads this says
   * less when the field is absent instead of failing to parse the summary.
   */
  nextDue: z.string().nullable().optional(),
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
    /**
     * A card written by hand. The only member that carries the card itself
     * rather than a reference to something that already holds it.
     *
     * `clientId` is minted by the client and becomes the `sourceKey`, the same
     * device and the same reason as `reviewId` on a review batch: this is the
     * one capture with no natural key, so a double tap or a retry after a
     * dropped response has to be made incapable of writing a second card.
     *
     * `back` is optional, not empty-able. Omitting it asks for the translation
     * every other capture gets; sending an empty string would be asking for a
     * card with no back, which is what the edit screen is for.
     */
    z.object({
      kind: z.literal('manual'),
      clientId: z.string().trim().min(8).max(64),
      front: z.string().trim().min(1).max(ECHO_FRONT_MAX_LENGTH),
      back: z.string().trim().min(1).max(ECHO_BACK_MAX_LENGTH).optional(),
      lang: languageCodeSchema,
    }),
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
 * What a person may change about a card of their own.
 *
 * The two lines they read, the language they are in, and the two files. The
 * source stays as it was: it is what the card was *made* from, and editing it
 * would leave `sourceKey` claiming a card is still the one message it can no
 * longer be.
 *
 * `lang` was held back for the same reason until hand-written cards arrived,
 * and it is offered on every card rather than only those — the call the
 * product made, with its cost stated rather than hidden. On a manual card the
 * language is a choice, and a choice made wrongly must be correctable. On a
 * card that came from a message it is a *fact* about that message, so changing
 * it leaves the card disagreeing with the thread it links to. Nothing breaks:
 * `lang` is read only by the language chips and the summary's grouping, and a
 * card moving between chips is exactly what somebody correcting it wants.
 *
 * `back` may be emptied. A card whose translation came back wrong is better
 * with no back than with a wrong one, and the capture already writes an empty
 * one whenever nothing could translate the sentence.
 */
export const updateEchoCardSchema = z.object({
  front: z.string().trim().min(1).max(ECHO_FRONT_MAX_LENGTH),
  back: z.string().trim().max(ECHO_BACK_MAX_LENGTH),
  lang: languageCodeSchema.optional(),
  /**
   * The picture and the recording, each in three states — and this is the one
   * thing here a reader will get wrong, so it is written out:
   *
   * - **absent** leaves whatever the card has alone;
   * - **`null`** takes it off the card;
   * - **a `Media`** replaces it.
   *
   * A `Media` and not an `EchoImage`/`EchoAudio`: what a client holds is what
   * an upload returned. The server checks it against our own bucket and builds
   * the card's field itself, stamping `origin: 'self'` — so nobody can file
   * their own recording under a partner's name, and nothing can claim to be a
   * copy of a message it never came from.
   */
  image: mediaSchema.nullable().optional(),
  /**
   * A recording of your own. It is **added** to the card's recordings now
   * rather than taking the single slot, because a card holds several; `null`
   * still clears them all, which is what it has always meant.
   */
  audio: mediaSchema.nullable().optional(),
  /**
   * Recordings to take off the card, by URL.
   *
   * Removing the second of three cannot be said with the field above, and the
   * obvious alternative — sending the list that should remain — cannot be
   * said at all: a recording already on the card is an `EchoAudio` and has no
   * `contentType` or `sizeBytes` to send it back as a `Media`, so a client
   * would have to invent them and would be charged media quota for files it
   * is keeping rather than adding.
   */
  removeAudio: z.array(z.url()).max(ECHO_AUDIO_MAX).optional(),
})
export type UpdateEchoCardInput = z.infer<typeof updateEchoCardSchema>

/**
 * Remembering that this card asked the feed how its sentence is said.
 *
 * Its own call rather than a field on `createPostSchema`: the feed module does
 * not know what an Echo card is, and nothing in this design makes it worth
 * teaching it. A link that fails to be written costs the button on the post
 * screen and nothing else.
 */
export const linkEchoAskSchema = z.object({
  postId: z.string().trim().min(1),
})
export type LinkEchoAskInput = z.infer<typeof linkEchoAskSchema>

/**
 * Putting a pronunciation answer's recording on the card that asked for it.
 *
 * An answer id, never a URL. The server reads the answer itself and builds the
 * `EchoAudio` from it, so a caller cannot point a card at a file of their
 * choosing — and `answer.postId === card.askedPostId` is then the whole
 * authorisation story.
 */
export const attachEchoAudioSchema = z.object({
  answerId: z.string().trim().min(1),
})
export type AttachEchoAudioInput = z.infer<typeof attachEchoAudioSchema>

/**
 * Putting a correction's sentence on the card that asked for it.
 *
 * `attachEchoAudioSchema`'s twin, and authorised the same way: a correction
 * id, never the text, so the server reads what somebody actually wrote and
 * `correction.postId === card.askedCorrectionPostId` is the whole story.
 *
 * It replaces the card's **front**. A card whose sentence is wrong is a card
 * that teaches the mistake, and the corrected line is the thing the person
 * asked the feed for.
 */
/**
 * Putting cards away as learned, or taking them back.
 *
 * Plural because the gesture is: the cards somebody wants to stop being asked
 * are usually a handful of easy ones noticed together while scrolling the
 * library. One card is a list of one.
 */
export const archiveEchoCardsSchema = z.object({
  cardIds: z.array(z.string().trim().min(1)).min(1).max(ECHO_ARCHIVE_BATCH_MAX),
  archived: z.boolean(),
})
export type ArchiveEchoCardsInput = z.infer<typeof archiveEchoCardsSchema>

export const archiveEchoCardsResultSchema = z.object({
  /** How many actually changed — the rest were already in that state. */
  changed: z.number().int().nonnegative(),
})
export type ArchiveEchoCardsResult = z.infer<typeof archiveEchoCardsResultSchema>

export const applyEchoCorrectionSchema = z.object({
  correctionId: z.string().trim().min(1),
})
export type ApplyEchoCorrectionInput = z.infer<typeof applyEchoCorrectionSchema>

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
  /**
   * What to look for, in the sentence, the meaning or the example.
   *
   * One character is a floor rather than the two a handle search asks for:
   * in Chinese or Japanese a single character is a whole word, and a box that
   * refuses to search until the second keystroke would be refusing the only
   * keystroke there is. The ceiling is the longest thing it could match.
   */
  q: z.string().trim().min(1).max(ECHO_FRONT_MAX_LENGTH).optional(),
  /**
   * The archive instead of the library. One or the other, never both mixed:
   * a list where a card you have put away sits between two you are still
   * learning would make "archived" mean nothing on the screen that is
   * supposed to show it.
   */
  archived: z.stringbool().default(false),
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
