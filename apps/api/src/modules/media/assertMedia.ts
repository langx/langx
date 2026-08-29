import {
  ERROR_CODES,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  isAudioContentType,
  isImageContentType,
  type Media,
} from '@langx/shared'
import { ApiError } from '../../lib/ApiError'

export type MediaKind = 'image' | 'audio'

/** Which kind an attachment is, from its content type alone. */
export function mediaKindOf(media: Media): MediaKind | null {
  if (isImageContentType(media.contentType)) return 'image'
  if (isAudioContentType(media.contentType)) return 'audio'
  return null
}

/**
 * The three things that must be true of any attachment before it is stored
 * against anything: the content type is one we serve, the bytes are within the
 * ceiling for that kind, and the URL points into our own bucket.
 *
 * Extracted from `sendMediaMessage` rather than copied into the feed. The
 * ceilings are the real cost control — storage is billed by the byte — and two
 * copies of them diverge the first time one moves, silently, in whichever
 * direction the person making the change was not looking.
 *
 * The bucket check is the one that matters most: a URL outside our own storage
 * would let a post embed an arbitrary host, and would survive the account purge
 * because we could never delete it.
 */
export function assertMediaAllowed(
  media: Media,
  storagePublicBaseUrl: string | undefined,
  /** Pass when the caller already knows what it asked for; derived otherwise. */
  expected?: MediaKind,
): MediaKind {
  const kind = mediaKindOf(media)
  if (!kind || (expected && kind !== expected)) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `${media.contentType} is not a supported ${expected ?? 'attachment'} type`,
    )
  }

  const maxBytes = kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES
  if (media.sizeBytes > maxBytes) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, `That ${kind} is too large`)
  }

  if (!storagePublicBaseUrl || !media.url.startsWith(storagePublicBaseUrl)) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Attachment must point into our own storage bucket',
    )
  }

  return kind
}
