import { ERROR_CODES } from '@langx/shared'
import { ApiError } from './ApiError'

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
  if (!url.startsWith(base)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'URL must point into our own storage bucket')
  }
}
