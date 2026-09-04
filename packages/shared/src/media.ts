import { z } from 'zod'

/**
 * What an attachment looks like once it is in the bucket — for a chat message
 * and for a feed post alike.
 *
 * One shape and one ceiling table, in one file, because the feed grew
 * attachments after chat already had them and the obvious move was to declare
 * a second `media` shape beside the first. Two definitions of the same thing
 * drift the first time one of these numbers moves, and the one that drifts is
 * whichever the person making the change was not looking at.
 */
export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const AUDIO_CONTENT_TYPES = [
  'audio/m4a',
  'audio/mp4',
  'audio/aac',
  'audio/mpeg',
  'audio/webm',
  'audio/ogg',
] as const

/**
 * Two containers, deliberately.
 *
 * An iPhone's picker hands back `.mov` (`video/quicktime`) and Android's hands
 * back `video/mp4`, so those are what a phone actually produces. `video/webm`
 * is the one people ask for and the one that must not be here: iOS has no VP8
 * or VP9 decoder at any level, so accepting it would store files half the
 * recipients cannot open, with nothing anywhere saying why. `audio/webm` is
 * above only because a browser's recorder has no other output — the video
 * picker has no such excuse, since it hands us whatever the camera wrote.
 */
export const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/quicktime'] as const

export const imageContentTypeSchema = z.enum(IMAGE_CONTENT_TYPES)
export const audioContentTypeSchema = z.enum(AUDIO_CONTENT_TYPES)
export const videoContentTypeSchema = z.enum(VIDEO_CONTENT_TYPES)

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
/**
 * A minute of phone video, and the bytes a minute of it takes.
 *
 * Both halves are needed. Seconds alone would let a 4K minute through at
 * several hundred megabytes; bytes alone would let a long, heavily compressed
 * clip sit in a thread nobody scrolls past. A minute is a sentence being
 * demonstrated, which is what this is for — anything longer is a video call,
 * and that is a different feature.
 */
export const MAX_VIDEO_BYTES = 64 * 1024 * 1024
export const MAX_VIDEO_SECONDS = 60

/**
 * How many files one message or one post may carry.
 *
 * Six, matching `PLAN_LIMITS.maxPhotos` on a profile, so there is one number
 * to remember rather than two that differ for no reason. The count is not a
 * cost control — the per-file ceilings above are — it is what keeps a gallery
 * a gallery instead of an album, and it bounds the number of video players a
 * single row can allocate.
 */
export const MAX_ATTACHMENTS = 6

/**
 * The three kinds an attachment can be, derived from its content type and
 * never stored: the bytes already answer the question, and a second copy of
 * the answer is a field that can disagree with them.
 */
export const MEDIA_KINDS = ['image', 'audio', 'video'] as const
export type MediaKind = (typeof MEDIA_KINDS)[number]
export const mediaKindSchema = z.enum(MEDIA_KINDS)

/**
 * Every per-kind ceiling in one table, so a new kind cannot be added with one
 * of them missing. `assertMediaAllowed` reads it; nothing else should branch
 * on kind to find a number.
 */
export const MEDIA_LIMITS = {
  image: { maxBytes: MAX_IMAGE_BYTES },
  audio: { maxBytes: MAX_AUDIO_BYTES, maxSeconds: MAX_AUDIO_SECONDS },
  video: { maxBytes: MAX_VIDEO_BYTES, maxSeconds: MAX_VIDEO_SECONDS },
} as const satisfies Record<MediaKind, { maxBytes: number; maxSeconds?: number }>

export const mediaSchema = z.object({
  url: z.url(),
  contentType: z.string().trim().min(1),
  /**
   * The outer bound only — the ceiling that applies is the one in
   * `MEDIA_LIMITS` for this attachment's kind, checked in
   * `assertMediaAllowed`. Zod cannot do it here without knowing the kind, and
   * a bound expressed as the largest of the three is what stops a 64MB image
   * from being rejected as malformed rather than as too large.
   */
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(Math.max(MAX_IMAGE_BYTES, MAX_AUDIO_BYTES, MAX_VIDEO_BYTES)),
  /** Audio and video. Per-kind ceiling in `MEDIA_LIMITS`, as with `sizeBytes`. */
  durationSeconds: z
    .number()
    .positive()
    .max(Math.max(MAX_AUDIO_SECONDS, MAX_VIDEO_SECONDS))
    .optional(),
  /** Images and video — lets the client reserve the right space before the bytes land. */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})
export type Media = z.infer<typeof mediaSchema>

/**
 * The chat spelling, kept so nothing has to be renamed at every call site to
 * find out that the shape is shared.
 */
export const messageMediaSchema = mediaSchema
export type MessageMedia = Media

export function isImageContentType(value: string): boolean {
  return (IMAGE_CONTENT_TYPES as readonly string[]).includes(value)
}

export function isAudioContentType(value: string): boolean {
  return (AUDIO_CONTENT_TYPES as readonly string[]).includes(value)
}

export function isVideoContentType(value: string): boolean {
  return (VIDEO_CONTENT_TYPES as readonly string[]).includes(value)
}

/** Which kind a content type is, or `null` for one we do not serve. */
export function mediaKindOfContentType(value: string): MediaKind | null {
  if (isImageContentType(value)) return 'image'
  if (isAudioContentType(value)) return 'audio'
  if (isVideoContentType(value)) return 'video'
  return null
}

/** One message or post may carry up to `MAX_ATTACHMENTS` files. */
export const attachmentsSchema = z.array(mediaSchema).min(1).max(MAX_ATTACHMENTS)

/**
 * Everything attached to a message, a post or a correction, whichever field it
 * arrived in.
 *
 * `attachments` is the field; `media` is what every row written before it
 * existed has, and what an installed build still sends and reads. New writes
 * fill both — see `sendMediaMessage` — so this is the only place that has to
 * know there are two, and reading through it means a v1-imported thread and a
 * message sent this morning look the same to everything downstream.
 */
export function attachmentsOf(source: {
  attachments?: readonly Media[] | null
  media?: Media | null
}): Media[] {
  if (source.attachments?.length) return [...source.attachments]
  return source.media ? [source.media] : []
}

/**
 * A voice note does not travel with pictures.
 *
 * Not a technical limit — the schema would carry it — but a recording is the
 * message, where a photo illustrates one. Mixing them would also make the
 * message's `type`, and so its preview line and its notification, a coin toss
 * between "photo" and "voice message".
 *
 * Two recordings together are fine, and have to be: a pronunciation answer is
 * a take at ordinary speed and a slower second one, which is the one case
 * where two audio files really are a single message.
 */
export function attachmentKindsValid(items: readonly Media[]): 'ok' | 'audio-must-be-alone' {
  const kinds = items.map((item) => mediaKindOfContentType(item.contentType))
  const hasAudio = kinds.includes('audio')
  const hasOther = kinds.some((kind) => kind !== null && kind !== 'audio')
  return hasAudio && hasOther ? 'audio-must-be-alone' : 'ok'
}
