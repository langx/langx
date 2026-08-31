import { z } from 'zod'
// The attachment shape lives in `media.ts` now, shared with the feed. Re-exported
// here so `@langx/shared` keeps one import surface and nothing had to be renamed
// to discover that a post and a message carry the same thing.
export {
  AUDIO_CONTENT_TYPES,
  IMAGE_CONTENT_TYPES,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  MAX_IMAGE_BYTES,
  audioContentTypeSchema,
  imageContentTypeSchema,
  isAudioContentType,
  isImageContentType,
  mediaSchema,
  messageMediaSchema,
  type Media,
  type MessageMedia,
} from './media'
import { mediaSchema } from './media'

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
export const MESSAGE_TYPES = ['text', 'correction', 'image', 'audio'] as const
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

export const sendTextMessageSchema = z.object({
  conversationId: z.string().trim().min(1),
  body: messageBodySchema,
  replyToMessageId: z.string().trim().min(1).optional(),
})
export type SendTextMessageInput = z.infer<typeof sendTextMessageSchema>

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
 * The reaction strip.
 *
 * Seven, because the row has to fit beside a `+` on the narrowest phone we
 * support, and because a longer strip stops being a glance and starts being a
 * decision. Plain 🔥 rather than WhatsApp's ❤️‍🔥: the flame is already the
 * streak's symbol in this app and reusing it here keeps one meaning per glyph.
 */
export const MESSAGE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'] as const
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
  kind: z.enum(['image', 'audio']),
  contentType: z.string().trim().min(1),
})
export type MediaUploadUrlInput = z.infer<typeof mediaUploadUrlSchema>

/**
 * Sending an attachment. `body` stays optional and separate: an image with a
 * caption is one message, not two, and a voice note usually has no text at all.
 */
export const sendMediaMessageSchema = z.object({
  conversationId: z.string().trim().min(1),
  kind: z.enum(['image', 'audio']),
  media: mediaSchema,
  body: z.string().trim().max(MAX_MESSAGE_LENGTH).optional(),
  replyToMessageId: z.string().trim().min(1).optional(),
})
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
