import { z } from 'zod'

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
export const listConversationsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(CONVERSATION_PAGE_SIZE_MAX)
    .default(CONVERSATION_PAGE_SIZE_DEFAULT),
})
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>

/** What a message's attachment looks like once it is in the bucket. */
export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const AUDIO_CONTENT_TYPES = [
  'audio/m4a',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
  'audio/webm',
  'audio/ogg',
] as const

export const imageContentTypeSchema = z.enum(IMAGE_CONTENT_TYPES)
export const audioContentTypeSchema = z.enum(AUDIO_CONTENT_TYPES)

/**
 * Size ceilings, enforced when the upload URL is signed rather than after the
 * bytes have already been paid for.
 *
 * These are the real cost control, not a per-day count: storage is billed by
 * the byte, and a cap on how *many* messages someone can send says nothing
 * about how large they are.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_AUDIO_BYTES = 16 * 1024 * 1024
/** Two minutes. Long enough for a real explanation, short enough not to be a podcast. */
export const MAX_AUDIO_SECONDS = 120

export const messageMediaSchema = z.object({
  url: z.url(),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive().max(Math.max(MAX_IMAGE_BYTES, MAX_AUDIO_BYTES)),
  /** Audio only. */
  durationSeconds: z.number().positive().max(MAX_AUDIO_SECONDS).optional(),
  /** Images only — lets the client reserve the right space before the bytes land. */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})
export type MessageMedia = z.infer<typeof messageMediaSchema>

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
  media: messageMediaSchema,
  body: z.string().trim().max(MAX_MESSAGE_LENGTH).optional(),
  replyToMessageId: z.string().trim().min(1).optional(),
})
export type SendMediaMessageInput = z.infer<typeof sendMediaMessageSchema>

export function isImageContentType(value: string): boolean {
  return (IMAGE_CONTENT_TYPES as readonly string[]).includes(value)
}

export function isAudioContentType(value: string): boolean {
  return (AUDIO_CONTENT_TYPES as readonly string[]).includes(value)
}

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
