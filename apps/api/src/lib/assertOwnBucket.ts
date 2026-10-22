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
  return objectKeyOf(base, url) !== null
}

/**
 * Characters a browser or the CDN may resolve into another path than the one
 * written, beyond the `.` and `..` segments `objectKeyOf` splits out: a dot
 * or slash percent-encoded, a backslash (which the URL standard reads as a
 * slash) and its encoded form, and the tabs and newlines the parser silently
 * deletes — `.<tab>.` is `..` by the time anything fetches it. No key this
 * app writes contains any of them, spaces and control characters included.
 */
function resolvesElsewhere(url: string): boolean {
  if (/\\|%2e|%2f|%5c/i.test(url)) return true
  for (let i = 0; i < url.length; i++) {
    const code = url.charCodeAt(i)
    if (code <= 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * The object key a URL names in our bucket, or `null` if it is not one.
 *
 * **The key must be exactly what is fetched.** A raw `startsWith` compares
 * the string as written, but the browser, the CDN and every WHATWG parser
 * resolve the path first, so `avatars/<me>/../<victim>/x.jpg` is read as
 * `avatars/<me>/…` here and served as the victim's file — the owner check in
 * `isOwnObjectUrl` passed, and the purge would later have deleted it. So
 * anything that can resolve elsewhere is refused before any prefix is
 * compared, rather than normalised: no key this app writes contains one,
 * and a URL that needs normalising was not produced by us.
 *
 * A query or a fragment is refused for the same reason. Every stored URL is
 * `${base}/${key}` — `publicUrl`, `putObject` and the v1 copies under
 * `legacy/` alike — so neither is ever legitimate, and both would make two
 * different strings name one object.
 *
 * Empty segments (`//`) too: a key with one is a different key, but the CDN
 * may well collapse it, and none of ours has one.
 */
export function objectKeyOf(base: string | undefined, url: string): string | null {
  if (!base) return null
  const root = base.endsWith('/') ? base : `${base}/`
  if (!url.startsWith(root)) return null
  if (!URL.canParse(url) || resolvesElsewhere(url)) return null
  if (url.includes('?') || url.includes('#')) return null

  const key = url.slice(root.length)
  const segments = key.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return null
  }
  return key
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
  return objectKeyOf(base, url)?.startsWith(prefix) ?? false
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
