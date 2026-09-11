import { ERROR_CODES } from '@langx/shared'
import { ApiError } from './ApiError'

/**
 * Whether a URL lives inside our own bucket.
 *
 * **The separator is the whole check.** `url.startsWith(base)` on its own
 * accepts every *sibling* of the bucket as well as the bucket itself: with
 * `https://f003.backblazeb2.com/file/langx-media` configured — the form
 * `.env.example` documents, and the one B2 and path-style S3 both hand out —
 * `https://f003.backblazeb2.com/file/langx-media-anything/x.jpg` passes, and a
 * bucket name on any of those providers is registerable by anybody who wants
 * one. Comparing against the base *and its slash* is what makes the answer
 * mean "under this bucket" rather than "starts with its name".
 *
 * `s3StorageProvider.keyFromPublicUrl` already reads URLs back this way; this
 * is the same rule applied on the way in. Every stored URL is
 * `${base}/${key}`, so nothing legitimate is lost by requiring the slash.
 */
export function isOwnBucketUrl(base: string | undefined, url: string): boolean {
  if (!base) return false
  const prefix = base.endsWith('/') ? base : `${base}/`
  return url.startsWith(prefix)
}

/**
 * Refuses a media URL that does not live in our own bucket.
 *
 * A URL pointing anywhere else would break the account-deletion purge and any
 * future moderation or rehosting of profile images — and would let anyone
 * point their profile at an arbitrary host, which is a way to serve whatever
 * they like from inside our UI.
 *
 * Shared rather than private to the media routes because onboarding writes an
 * `avatarUrl` too, on a path that never calls `confirm`. Skipping the check
 * there would quietly reopen the hole `confirm` exists to close.
 */
export function assertOwnBucket(base: string | undefined, url: string): void {
  if (!base) throw new ApiError(ERROR_CODES.INTERNAL, 'Storage is not configured')
  if (!isOwnBucketUrl(base, url)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'URL must point into our own storage bucket')
  }
}
