import { ERROR_CODES, type Media } from '@langx/shared'
import type { Db } from 'mongodb'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota } from '../../lib/quota'
import { assertAttachmentsAllowed, type MediaKind } from '../media/assertMedia'
import { supportsPut, type StorageProvider } from '../../storage/StorageProvider'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'

/**
 * The attachments are allowed, and the daily media budget can pay for them.
 *
 * The same `media` bucket chat uses, deliberately. It is the same abuse
 * surface — bytes stored and served forever — and `PLAN_LIMITS.mediaPer24h` is
 * documented as a ceiling on abuse rather than a paywall. A second bucket would
 * mean a second limit key, a second quota kind, and a free tier that is really
 * a hundred a day through two doors.
 *
 * The user-visible consequence is real and worth saying out loud: a heavy day
 * in chat leaves fewer attachments for the feed.
 *
 * **A list, and one unit however long the list is.** A pronunciation answer can
 * carry two takes, and charging two would make the optional slow take feel
 * expensive and be skipped — which is the one behaviour the second take exists
 * to encourage. The byte ceiling is still per file, and that is the control
 * that actually bounds storage.
 *
 * Every file is checked *before* anything is consumed, so a rejected second
 * take does not burn a unit the caller never got to use.
 *
 * Called only when there *is* an attachment, so a plain sentence still costs
 * nothing.
 */
export async function assertAttachable(
  db: Db,
  userId: string,
  profile: Profile,
  media: readonly Media[],
  storagePublicBaseUrl: string | undefined,
  expected?: MediaKind,
): Promise<void> {
  if (media.length === 0) return
  assertAttachmentsAllowed(media, storagePublicBaseUrl, expected)

  const quota = await consumeQuota(db, userId, effectiveTier(profile), 'media')
  if (!quota.consumed) {
    throw new ApiError(
      ERROR_CODES.QUOTA_EXCEEDED,
      'Daily attachment limit reached',
      quota.nextAvailableAt ? { retryAt: quota.nextAvailableAt.toISOString() } : undefined,
    )
  }
}

/**
 * Best-effort removal of the objects behind a deleted row.
 *
 * Swallowed per object, for the reason the account purge swallows it: the row
 * is already gone, and one unreachable file must not turn a completed delete
 * into an error the user has to retry into a no-op.
 */
export async function deleteObjects(
  storage: StorageProvider | undefined,
  urls: (string | undefined)[],
): Promise<void> {
  if (!storage || !supportsPut(storage)) return
  for (const url of urls) {
    if (!url) continue
    const key = storage.keyFromPublicUrl(url)
    if (!key) continue
    try {
      await storage.deleteObject(key)
    } catch {
      // Intentionally ignored — see above.
    }
  }
}
