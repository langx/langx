import { z } from 'zod'
// The attachment shape lives in `media.ts` now, shared with the feed. Re-exported
// here so `@langx/shared` keeps one import surface and nothing had to be renamed
// to discover that a post and a message carry the same thing.
export {
  AUDIO_CONTENT_TYPES,
  IMAGE_CONTENT_TYPES,
  MAX_ATTACHMENTS,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  VIDEO_CONTENT_TYPES,
  attachmentsOf,
  attachmentsSchema,
  audioContentTypeSchema,
  imageContentTypeSchema,
  isAudioContentType,
  isImageContentType,
  isVideoContentType,
  mediaKindSchema,
  mediaSchema,
  messageMediaSchema,
  videoContentTypeSchema,
  type Media,
  type MediaKind,
  type MessageMedia,
} from './media'
import { attachmentsSchema, mediaKindSchema } from './media'
import { isTranslatableLanguage, languageCodeSchema } from './languages'

export const MAX_MESSAGE_LENGTH = 2000

export const messageBodySchema = z.string().trim().min(1).max(MAX_MESSAGE_LENGTH)

/**
 * Body of `POST /conversations` — there is no match gate, so "starting a
 * conversation" and "sending its first message" are the same request. A
 * second call for the same pair fails on `conversations.pairKey`'s unique
 * index (surfaced as `CONVERSATION_EXISTS`), not a second write here.
 */
export const startConversationSchema = z.object({
  toUserId: z.string().trim().min(1),
  body: messageBodySchema,
})
export type StartConversationInput = z.infer<typeof startConversationSchema>

export const quotaStatusSchema = z.object({
  /** `null` means unlimited (Pro). */
  limit: z.number().int().nullable(),
  remaining: z.number().int().nullable(),
  /** ISO timestamp the oldest counted initiation rolls out of the 24h window, only set once `remaining` is 0. */
  nextAvailableAt: z.string().nullable(),
})
export type QuotaStatus = z.infer<typeof quotaStatusSchema>

/**
 * `image` and `audio` restore v1 parity. They were deferred while the message
 * schema had no room for them, which also meant the v1 migration would have
 * had to drop 3,604 images and 1,270 voice messages on the floor — importing
 * a conversation with holes in it is worse than not importing it. They come
 * first so the migration can bring the whole thread.
 */
/**
 * How many messages you have to have *received* from the other person before
 * you can send them a photo or a voice note.
 *
 * Received, not exchanged. This counted both people's messages together until
 * 4 September 2026, and that had a hole the size of the rule: send five
 * messages to a stranger yourself and the sixth could be a photograph. The
 * gate never required the other person's participation at all, which is the
 * only thing that can stand in for their consent. Counting what they sent
 * makes it theirs to open. It is asymmetric on purpose — one side can be
 * unlocked while the other is not — because consent is.
 *
 * This is the one rule in the app with no exception anywhere: not for Pro, not
 * for Polyglot, not for somebody you have talked to for a year and then
 * started a new thread with. That is deliberate, and it is the point. A rule
 * with a paid tier attached to it is a rule that says the behaviour is
 * acceptable from customers, and the behaviour this exists to stop — an
 * unsolicited photograph from a stranger — is not acceptable from anybody. It
 * is also the only version that can be said in one sentence and be true.
 *
 * Five, because it is more than a greeting and fewer than a conversation. Two
 * would be cleared by "hi" / "hi". Twenty would break the ordinary case of
 * sending somebody a picture of the menu you are asking about.
 *
 * It does not replace blocking or reporting, and it stops nothing between
 * people who have talked. What it removes is the *first* message being a
 * photograph, which is the one nobody consented to and the one no amount of
 * moderation can un-see.
 */
export const MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES = 5

export const MESSAGE_TYPES = [
  'text',
  'correction',
  'image',
  'audio',
  'video',
  'phrase',
  'meeting',
  'quiz',
  'sticker',
] as const
export type MessageType = (typeof MESSAGE_TYPES)[number]

/**
 * How much of the quoted message a reply carries.
 *
 * The quote is a snapshot taken at send time, not a live read of the target —
 * the same shape `correction.original` uses, and for the same reason: the
 * target can be deleted, and a quote that empties itself rewrites what the
 * conversation looks like it said.
 */
export const REPLY_PREVIEW_MAX_LENGTH = 140

/**
 * A client-minted id for one attempt to send, so a retry cannot double-post.
 *
 * Bounded and opaque: the server only ever compares it against this sender's
 * other ids, never parses it. Optional because an older build sends none — such
 * a message simply gets no protection, which is what it had before.
 */
export const clientMessageIdSchema = z.string().trim().min(1).max(64)

/**
 * A request attached to your own sentence: correct it, or say it out loud.
 *
 * A field on a text message rather than two message types, because that is
 * what they are — the sentence is the message, and the ask is a note on it.
 * Both are already answerable with machinery that exists: `message:correct`
 * writes the correction, and a voice note quoting the message answers the
 * other. Neither carries bytes, so neither spends the media quota or waits on
 * the media gate.
 *
 * The feed's pronunciation posts get their own collection because the answers
 * are listed away from the question. In a conversation the thread *is* that
 * list, so there is nothing to collect.
 */
export const MESSAGE_ASKS = ['correction', 'pronunciation'] as const
export type MessageAsk = (typeof MESSAGE_ASKS)[number]

/**
 * A translation the sender chose to send along with their own words.
 *
 * Both halves travel, and both are kept. The point of the feature is that a
 * beginner can write in the language they think in without the other person
 * having to guess — so the original is the message and this is the help, not
 * the other way round.
 *
 * Produced by `POST /translate`, which is where the quota is spent and the
 * cache is read. It is stored as given: this is the sender's own message, and
 * somebody determined to send different words could simply type them.
 */
export const messageTranslationSchema = z.object({
  text: messageBodySchema,
  /*
   * Built from `languages` rather than reusing `translatableLanguageSchema`,
   * which lives in `translation.ts` — and `translation.ts` already imports
   * `MAX_MESSAGE_LENGTH` from this file. Importing it back would close the
   * cycle, and a cycle here is not a lint warning: the bundle evaluates
   * `MAX_MESSAGE_LENGTH` before it is initialised and the app fails to boot.
   * The rule is the same one, spelled out rather than borrowed.
   */
  lang: languageCodeSchema.refine(isTranslatableLanguage, {
    message: 'This language has no written form to translate to',
  }),
  /** What the provider detected the original to be. Absent if it did not say. */
  sourceLang: z.string().trim().min(1).max(16).optional(),
})
export type MessageTranslation = z.infer<typeof messageTranslationSchema>

export const sendTextMessageSchema = z.object({
  conversationId: z.string().trim().min(1),
  body: messageBodySchema,
  replyToMessageId: z.string().trim().min(1).optional(),
  clientId: clientMessageIdSchema.optional(),
  ask: z.enum(MESSAGE_ASKS).optional(),
  translation: messageTranslationSchema.optional(),
})
export type SendTextMessageInput = z.infer<typeof sendTextMessageSchema>

/**
 * A word or phrase worth keeping, sent as a card.
 *
 * Starring a message already exists and is a different thing: it is a bookmark
 * with no structure, and what makes a phrase useful later is the parts — what
 * it means, and one sentence using it. So this is a message *and* a row in
 * `phraseCards`, which is what the deck screen reads.
 */
export const PHRASE_TERM_MAX_LENGTH = 80
export const PHRASE_MEANING_MAX_LENGTH = 200
export const PHRASE_EXAMPLE_MAX_LENGTH = 200

export const sendPhraseSchema = z.object({
  conversationId: z.string().trim().min(1),
  term: z.string().trim().min(1).max(PHRASE_TERM_MAX_LENGTH),
  meaning: z.string().trim().min(1).max(PHRASE_MEANING_MAX_LENGTH),
  example: z.string().trim().max(PHRASE_EXAMPLE_MAX_LENGTH).optional(),
  /** The language the term is in — usually what one of the two is learning. */
  lang: languageCodeSchema,
  clientId: clientMessageIdSchema.optional(),
})
export type SendPhraseInput = z.infer<typeof sendPhraseSchema>

/**
 * A time the two of them agreed to talk.
 *
 * It arranges; it does not dial. There is no calling in this app, and a card
 * that looked like it could start one would be a promise the app cannot keep.
 *
 * Both people are in different time zones by definition — that is the whole
 * premise of the product — so the card is drawn in each reader's own, from the
 * `timezone` on their profile rather than the device clock, which lies the
 * moment somebody travels.
 */
export const MEETING_NOTE_MAX_LENGTH = 200
export const MEETING_DURATIONS = [15, 30, 45, 60] as const
export const MEETING_STATUSES = ['proposed', 'accepted', 'declined', 'cancelled'] as const
export type MeetingStatus = (typeof MEETING_STATUSES)[number]

export const sendMeetingSchema = z.object({
  conversationId: z.string().trim().min(1),
  /** ISO 8601, and in the future — a meeting already past is not a proposal. */
  startsAt: z.iso.datetime(),
  durationMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
  note: z.string().trim().max(MEETING_NOTE_MAX_LENGTH).optional(),
  clientId: clientMessageIdSchema.optional(),
})
export type SendMeetingInput = z.infer<typeof sendMeetingSchema>

export const respondToMeetingSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  /**
   * `cancelled` is the proposer's; the other two are the invitee's. Enforced
   * on the server, not here — a schema cannot see who is asking.
   */
  status: z.enum(['accepted', 'declined', 'cancelled']),
})
export type RespondToMeetingInput = z.infer<typeof respondToMeetingSchema>

/**
 * A question with one right answer.
 *
 * A quiz, not a poll. A conversation has two people in it, so a tally is
 * never interesting — what is interesting is whether the other person got it
 * right, which means the asker marks the answer and the reveal happens on the
 * tap. That also makes it the one thing here that is *about* the language
 * rather than a message that happens to be in a language.
 *
 * Deliberately unpaid. Two accounts writing and answering each other's
 * questions would be the easiest token farm in the app, and `TOKEN_RULES`
 * already pays 2 for the send — see `awards.ts`, which needs no branch for it.
 */
export const QUIZ_QUESTION_MAX_LENGTH = 200
export const QUIZ_OPTION_MAX_LENGTH = 80
export const QUIZ_MIN_OPTIONS = 2
export const QUIZ_MAX_OPTIONS = 4

export const sendQuizSchema = z
  .object({
    conversationId: z.string().trim().min(1),
    question: z.string().trim().min(1).max(QUIZ_QUESTION_MAX_LENGTH),
    options: z
      .array(z.string().trim().min(1).max(QUIZ_OPTION_MAX_LENGTH))
      .min(QUIZ_MIN_OPTIONS)
      .max(QUIZ_MAX_OPTIONS),
    correctIndex: z
      .number()
      .int()
      .min(0)
      .max(QUIZ_MAX_OPTIONS - 1),
    clientId: clientMessageIdSchema.optional(),
  })
  // Checked against the list rather than a constant: three options and a
  // `correctIndex` of 3 passes both bounds above and points at nothing.
  .refine((input) => input.correctIndex < input.options.length, {
    message: 'The correct answer has to be one of the options',
    path: ['correctIndex'],
  })
export type SendQuizInput = z.infer<typeof sendQuizSchema>

export const answerQuizSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  index: z
    .number()
    .int()
    .min(0)
    .max(QUIZ_MAX_OPTIONS - 1),
})
export type AnswerQuizInput = z.infer<typeof answerQuizSchema>

/**
 * One sticker from a pack the sender owns.
 *
 * Only the id travels; the picture is in the bundle. That is also why a
 * sticker is not media: nothing is uploaded, nothing is stored, and the media
 * gate — which exists to stop a first message being a photograph nobody
 * consented to — has nothing to protect anyone from here. They are still
 * reportable, because a curated picture can still be used unkindly.
 */
export const stickerIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9.-]+$/, 'Not a sticker id')

export const sendStickerSchema = z.object({
  conversationId: z.string().trim().min(1),
  packId: stickerIdSchema,
  stickerId: stickerIdSchema,
  clientId: clientMessageIdSchema.optional(),
})
export type SendStickerInput = z.infer<typeof sendStickerSchema>

export const CORRECTION_NOTE_MAX_LENGTH = 500

/**
 * Corrections are unlimited on both tiers (`PLAN_LIMITS.correctionsPer24h`)
 * — see limits.ts's doc comment on why capping them would shrink the value a
 * free user provides a Pro one. No quota check anywhere near this schema.
 */
export const sendCorrectionSchema = z.object({
  conversationId: z.string().trim().min(1),
  targetMessageId: z.string().trim().min(1),
  corrected: messageBodySchema,
  note: z.string().trim().max(CORRECTION_NOTE_MAX_LENGTH).optional(),
})
export type SendCorrectionInput = z.infer<typeof sendCorrectionSchema>

/**
 * How long to wait for a socket ack before treating a send as failed.
 *
 * Without one, socket.io registers the ack with **no timer at all** and only
 * invokes it on close if it was created with a timeout — so a connection that
 * dies after the frame goes out but before the ack returns leaves the promise
 * unsettled forever. In the app that meant `finally { setSending(false) }` never
 * ran and the send button stayed disabled until the screen was left.
 *
 * Comfortably longer than a round trip on a bad connection and comfortably
 * shorter than the ~45s it takes the server's default ping timeout to notice a
 * dead socket, which is the window this is closing.
 */
export const SOCKET_ACK_TIMEOUT_MS = 12_000

/**
 * The reaction strip.
 *
 * Eight, which is what fills the pill edge to edge on a 390pt screen — the
 * menu sizes the strip to this list, so any shorter one leaves empty pill
 * after the last emoji. It is still short enough to be a glance rather than a
 * decision, and on a narrower phone the strip scrolls rather than shrinking
 * cells that are already only just tappable.
 *
 * Plain 🔥 rather than WhatsApp's ❤️‍🔥: the flame is already the streak's
 * symbol in this app and reusing it here keeps one meaning per glyph. 👏 is
 * the eighth because half of what is worth reacting to here is somebody
 * getting a sentence right.
 */
export const MESSAGE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'] as const
export type MessageReaction = (typeof MESSAGE_REACTIONS)[number]

/**
 * How long a sender can withdraw a message from the other person's device.
 *
 * Two days, the same window WhatsApp settled on. Past it, "delete for me"
 * stays available forever — what expires is the ability to reach into someone
 * else's copy, not the ability to tidy your own.
 */
export const MESSAGE_DELETE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000

/**
 * How long a text message stays editable.
 *
 * The same two days as withdrawing it, and deliberately so: both are the
 * sender reaching back into something already read, and one window is easier
 * to explain than two. It is also why the correction lock below matters — two
 * days is long enough for the other person to have taught something about the
 * sentence in the meantime.
 */
export const MESSAGE_EDIT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000

/**
 * One pin per conversation for now. A second would need an order, a way to see
 * the list and a way to say which one the banner shows; a single pin needs
 * none of that and covers the case people actually have.
 */
export const MAX_PINNED_PER_CONVERSATION = 1

export const editMessageSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  body: messageBodySchema,
})
export type EditMessageInput = z.infer<typeof editMessageSchema>

export const starMessageSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  starred: z.boolean(),
})
export type StarMessageInput = z.infer<typeof starMessageSchema>

export const pinMessageSchema = z.object({
  conversationId: z.string().trim().min(1),
  /** Null clears whatever is pinned. */
  messageId: z.string().trim().min(1).nullable(),
})
export type PinMessageInput = z.infer<typeof pinMessageSchema>

/**
 * Whether a message can still be edited.
 *
 * The `corrected` clause is the interesting one. Once someone has written a
 * correction of a sentence, that correction carries a snapshot of the original
 * — so editing the original afterwards leaves the correction quoting a
 * sentence that no longer exists anywhere, and the teaching record becomes a
 * lie about what was said. The lock is not politeness; it is what keeps
 * `correction.original` true.
 */
export function canEditMessage(
  message: {
    senderId: string
    type: string
    createdAt: string | Date
    deletedAt?: string | Date | null
    corrected?: boolean
  },
  userId: string,
  now: Date,
): boolean {
  if (message.senderId !== userId) return false
  // Only text: there is nothing to edit in an image, and a correction is
  // itself a record of what someone else said.
  if (message.type !== 'text') return false
  if (message.deletedAt) return false
  if (message.corrected) return false
  const sent = new Date(message.createdAt).getTime()
  if (Number.isNaN(sent)) return false
  return now.getTime() - sent <= MESSAGE_EDIT_WINDOW_MS
}

export const reactToMessageSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  /** Null clears whatever this user had on the message. */
  emoji: z.enum(MESSAGE_REACTIONS).nullable(),
})
export type ReactToMessageInput = z.infer<typeof reactToMessageSchema>

export const deleteMessageSchema = z.object({
  conversationId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  scope: z.enum(['me', 'everyone']),
})
export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>

/**
 * Whether a message can still be withdrawn from the other person.
 *
 * Shared so the menu and the mutation cannot disagree: a client that offers
 * the row when the server would refuse it produces an error the user cannot
 * act on, and one that hides it early takes away something they still have.
 */
export function canDeleteForEveryone(
  message: { senderId: string; createdAt: string | Date; deletedAt?: string | Date | null },
  userId: string,
  now: Date,
): boolean {
  if (message.senderId !== userId) return false
  if (message.deletedAt) return false
  const sent = new Date(message.createdAt).getTime()
  if (Number.isNaN(sent)) return false
  return now.getTime() - sent <= MESSAGE_DELETE_WINDOW_MS
}

export const STARRED_PAGE_SIZE_MAX = 100

/** `GET /me/starred` — a flat list, newest first, across every conversation. */
/**
 * Paged, unlike the starred list beside it. A bookmark list is tens of items
 * and capped; a correction history is the number on somebody's profile, and it
 * is meant to grow.
 */
export const CORRECTIONS_PAGE_SIZE_MAX = 50

export const listCorrectionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(CORRECTIONS_PAGE_SIZE_MAX).default(20),
  cursor: z.string().trim().min(1).optional(),
})
export type ListCorrectionsQuery = z.infer<typeof listCorrectionsQuerySchema>

export const listStarredQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(STARRED_PAGE_SIZE_MAX).default(50),
})

export const MESSAGE_PAGE_SIZE_DEFAULT = 30
export const MESSAGE_PAGE_SIZE_MAX = 100

/**
 * `GET /conversations/:id/messages`.
 *
 * Three ways in, and they are mutually exclusive — enforced in the module
 * rather than with `.refine()`, because a `ZodEffects` wrapper is not a plain
 * object schema and `fastify-type-provider-zod` will not take one for a
 * querystring.
 *
 * - neither: the newest page
 * - `cursor`: the page *before* it, walking backwards into history
 * - `after`: the page after it, walking forwards toward the newest
 * - `around`: a window centred on one message, with a cursor out of both ends
 */
export const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  after: z.string().optional(),
  around: z.string().trim().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MESSAGE_PAGE_SIZE_MAX)
    .default(MESSAGE_PAGE_SIZE_DEFAULT),
})
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>

/**
 * One tab, not one kind.
 *
 * `MEDIA_KINDS` cannot say this: the grid shows photos and videos together
 * because they are looked at the same way, and a voice note is not looked at
 * at all — it is a different screen's worth of behaviour in the same list.
 */
export const MEDIA_TABS = ['visual', 'audio'] as const
export type MediaTab = (typeof MEDIA_TABS)[number]

/**
 * `GET /conversations/:id/media`.
 *
 * A page counts *messages*, and one message carries up to `MAX_ATTACHMENTS`
 * files, so thirty messages is thirty to a hundred and eighty tiles. The
 * ceiling belongs on the side that bounds the query; the grid flattens what
 * arrives and does not care which.
 *
 * `cursor` is `.trim().min(1)`, following the corrections list rather than the
 * message window above: the window's bare `z.string().optional()` accepts
 * `?cursor=` and hands `''` to `decodeDateIdCursor`, which then reports a
 * malformed cursor where none was sent.
 */
export const CONVERSATION_MEDIA_PAGE_SIZE_DEFAULT = 30
export const CONVERSATION_MEDIA_PAGE_SIZE_MAX = 60

export const listConversationMediaQuerySchema = z.object({
  tab: z.enum(MEDIA_TABS).default('visual'),
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(CONVERSATION_MEDIA_PAGE_SIZE_MAX)
    .default(CONVERSATION_MEDIA_PAGE_SIZE_DEFAULT),
})
export type ListConversationMediaQuery = z.infer<typeof listConversationMediaQuerySchema>

export const CONVERSATION_PAGE_SIZE_DEFAULT = 20
export const CONVERSATION_PAGE_SIZE_MAX = 50

/** `GET /conversations` — the chat list, sorted by most recent activity. */
/**
 * Which slice of the list to return.
 *
 * `unreplied` is "they spoke last", read off `lastMessage.senderId` rather
 * than off the unread count. The two disagree, and the disagreement matters:
 * opening a thread clears the unread and does not answer it, so a list keyed
 * on unread would quietly drop everything somebody had read and meant to come
 * back to — which is exactly the list this tab is for.
 */
/**
 * How many threads one person may pin.
 *
 * A cap, because pinned threads are fetched whole rather than paginated — the
 * cursor cannot express a compound sort, and the simple answer is only simple
 * while the set stays small.
 */
export const MAX_PINNED_CONVERSATIONS = 20

export const CONVERSATION_FILTERS = ['all', 'unreplied', 'archived'] as const
export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number]

export const listConversationsQuerySchema = z.object({
  filter: z.enum(CONVERSATION_FILTERS).default('all'),
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(CONVERSATION_PAGE_SIZE_MAX)
    .default(CONVERSATION_PAGE_SIZE_DEFAULT),
})
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>

/**
 * At least one flag has to be named — `{}` is a request that means nothing,
 * and answering 200 to it would hide a client bug rather than surface one.
 */
export const conversationFlagsSchema = z
  .object({ pinned: z.boolean(), archived: z.boolean() })
  .partial()
  .refine((body) => body.pinned !== undefined || body.archived !== undefined, {
    message: 'Name pinned, archived, or both',
  })
export type ConversationFlagsInput = z.infer<typeof conversationFlagsSchema>

export const mediaUploadUrlSchema = z.object({
  conversationId: z.string().trim().min(1),
  kind: mediaKindSchema,
  contentType: z.string().trim().min(1),
})
export type MediaUploadUrlInput = z.infer<typeof mediaUploadUrlSchema>

/**
 * Sending attachments. `body` stays optional and separate: photos with a
 * caption are one message, not two, and a voice note usually has no text at
 * all.
 *
 * The `preprocess` is what keeps an installed build working. Every binary in
 * the wild emits `{ kind, media }` — one file, with its kind spelled out —
 * and it cannot be updated in step with the server, so that shape is rewritten
 * here into the one the rest of the code now reads. `kind` is dropped rather
 * than trusted: the content type answers the same question and cannot
 * disagree with the bytes.
 */
export const sendMediaMessageSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'object' || value === null) return value
    const body = value as { attachments?: unknown; media?: unknown; kind?: unknown }
    if (body.attachments !== undefined || body.media === undefined) return value
    const { media, kind: _kind, ...rest } = body
    return { ...rest, attachments: [media] }
  },
  z.object({
    conversationId: z.string().trim().min(1),
    attachments: attachmentsSchema,
    body: z.string().trim().max(MAX_MESSAGE_LENGTH).optional(),
    replyToMessageId: z.string().trim().min(1).optional(),
  }),
)
export type SendMediaMessageInput = z.infer<typeof sendMediaMessageSchema>

/**
 * What the ticks under your own message mean, in the order they happen:
 *
 * - `sent` — one tick. The server has it. Nothing more is claimed: the other
 *   person may be asleep with their phone off.
 * - `delivered` — two ticks. It reached their device, which for us means it
 *   went out over a socket they had open (or they connected and we handed it
 *   over then). Still unread.
 * - `read` — two ticks, tinted. They opened the thread.
 *
 * The same three states WhatsApp and Telegram use, and people read them
 * without being taught. A message never moves backwards through this.
 */
export const DELIVERY_STATES = ['sent', 'delivered', 'read'] as const
export type DeliveryState = (typeof DELIVERY_STATES)[number]

/**
 * `readAt` wins over `deliveredAt` rather than requiring both, so that history
 * predating `deliveredAt` — every v1 message imported as seen, and everything
 * sent before this shipped — reads as `read` instead of falling back to one
 * tick. Being read is proof of delivery; there is nothing to backfill.
 */
export function deliveryStateOf(message: {
  deliveredAt?: string | Date | null
  readAt?: string | Date | null
}): DeliveryState {
  if (message.readAt) return 'read'
  if (message.deliveredAt) return 'delivered'
  return 'sent'
}
