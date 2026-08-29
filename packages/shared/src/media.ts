import { z } from 'zod'

/**
 * What an attachment looks like once it is in the bucket — for a chat message
 * and for a feed post alike.
 *
 * One shape and one set of ceilings, in one file, because the feed grew
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

export const mediaSchema = z.object({
  url: z.url(),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().positive().max(Math.max(MAX_IMAGE_BYTES, MAX_AUDIO_BYTES)),
  /** Audio only. */
  durationSeconds: z.number().positive().max(MAX_AUDIO_SECONDS).optional(),
  /** Images only — lets the client reserve the right space before the bytes land. */
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
