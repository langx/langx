import {
  ERROR_CODES,
  MEDIA_LIMITS,
  attachmentKindsValid,
  mediaKindOfContentType,
  type Media,
  type MediaKind,
} from '@langx/shared'
import { ApiError } from '../../lib/ApiError'

export type { MediaKind }

/** Which kind an attachment is, from its content type alone. */
export function mediaKindOf(media: Media): MediaKind | null {
  return mediaKindOfContentType(media.contentType)
}

/**
 * The four things that must be true of any attachment before it is stored
 * against anything: the content type is one we serve, the bytes are within the
 * ceiling for that kind, the duration is too, and the URL points into our own
 * bucket.
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
      ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      `${media.contentType} is not a supported ${expected ?? 'attachment'} type`,
    )
  }

  const limits = MEDIA_LIMITS[kind]
  if (media.sizeBytes > limits.maxBytes) {
    throw new ApiError(ERROR_CODES.MEDIA_TOO_LARGE, `That ${kind} is too large`)
  }

  if (kind === 'video') {
    // Required for video and not for audio, which is not an inconsistency: a
    // recording is made by us and always carries its length, where a video
    // arrives from a picker. A ceiling that can be bypassed by omitting the
    // field is not a ceiling.
    if (media.durationSeconds === undefined) {
      throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'A video must say how long it is')
    }
  }

  const maxSeconds = 'maxSeconds' in limits ? limits.maxSeconds : undefined
  if (maxSeconds !== undefined && media.durationSeconds !== undefined) {
    if (media.durationSeconds > maxSeconds) {
      throw new ApiError(
        ERROR_CODES.MEDIA_TOO_LONG,
        `That ${kind} is longer than ${maxSeconds} seconds`,
      )
    }
  }

  if (!storagePublicBaseUrl || !media.url.startsWith(storagePublicBaseUrl)) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Attachment must point into our own storage bucket',
    )
  }

  return kind
}

/**
 * Every attachment on one message or one post, and what kind the set is.
 *
 * The kind of the *first* file is the message's type, and so its preview line
 * and its push notification. `attachmentKindsValid` is what keeps that from
 * being a coin toss: a voice note cannot ride along with photos.
 */
export function assertAttachmentsAllowed(
  items: readonly Media[],
  storagePublicBaseUrl: string | undefined,
  expected?: MediaKind,
): MediaKind {
  const first = items[0]
  if (!first) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'An attachment message needs an attachment')
  }

  const kinds = items.map((item) => assertMediaAllowed(item, storagePublicBaseUrl, expected))
  if (attachmentKindsValid(items) !== 'ok') {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'A voice note is sent on its own')
  }

  return kinds[0] as MediaKind
}
