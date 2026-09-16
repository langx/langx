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

/**
 * Whether a URL is an object *this* caller is allowed to record.
 *
 * `isOwnBucketUrl` answers "is this our bucket", which turns out not to be the
 * same question. Every upload key already carries its owner —
 * `avatars/<userId>/`, `posts/<userId>/`, `messages/<conversationId>/` — but
 * nothing checked it, so any URL in the bucket could be written against any
 * account. Avatars and gallery photos are public on the profile they belong
 * to, which makes somebody else's key something you can simply read off their
 * page.
 *
 * That mattered because of what the purge does with it: it deletes every
 * object the departing profile points at. Pointing yours at a stranger's
 * picture and then deleting your account destroyed their file, permanently,
 * for the price of one throwaway account. The purge guards the case it was
 * told about — "a URL outside our bucket is not ours to delete" — and this is
 * the half that was assumed rather than checked.
 *
 * `ObjectPrefix` is `${string}/` rather than `string`, and that is load-bearing
 * twice over. The trailing slash is what makes this an exact match on the
 * owning segment — `avatars/<id>/` cannot pass for `avatars/<id>extra/`. And it
 * is what stopped three call sites compiling when this argument was added:
 * `assertAttachable` already took an optional `MediaKind` last, so a plain
 * `string` let `'audio'` slide silently into the prefix slot and check nothing.
 */
export type ObjectPrefix = `${string}/`

export function isOwnObjectUrl(
  base: string | undefined,
  url: string,
  prefix: ObjectPrefix,
): boolean {
  if (!base) return false
  const root = base.endsWith('/') ? base : `${base}/`
  return url.startsWith(`${root}${prefix}`)
}

/** `isOwnObjectUrl`, as the refusal the routes hand back. */
export function assertOwnObject(
  base: string | undefined,
  url: string,
  prefix: ObjectPrefix,
  what = 'URL',
): void {
  if (!base) throw new ApiError(ERROR_CODES.INTERNAL, 'Storage is not configured')
  if (!isOwnObjectUrl(base, url, prefix)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, `${what} must be a file you uploaded`)
  }
}
