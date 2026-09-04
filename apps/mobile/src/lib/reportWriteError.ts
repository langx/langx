import { MAX_VIDEO_SECONDS } from '@langx/shared'
import { ApiRequestError } from '../api/client'
import type { TranslateFn } from '../i18n'
import { showToast } from './toast'

/**
 * Says what actually went wrong when a post or a correction is refused.
 *
 * Every failure used to read "the attachment did not upload", including the
 * ones with no attachment in them — most visibly "you have already corrected
 * this", which is not something the writer can fix by retrying and is exactly
 * what the retry it invited would hit again.
 *
 * `instanceof` is the right check here because these are REST calls. The
 * `errorCodeOf` workaround in the chat screen exists only because
 * `emitWithAck` rejects with a plain `Error`.
 *
 * Lives in `src/lib` now that both the feed's correction box and the `compose`
 * route need it — two copies of this list would drift, and the drift would
 * show up as one screen naming a failure the other one shrugs at.
 */
export function reportWriteError(caught: unknown, t: TranslateFn): void {
  if (!(caught instanceof ApiRequestError)) {
    showToast(t('feed.attachmentFailed'))
    return
  }
  if (caught.code === 'QUOTA_EXCEEDED') {
    showToast(t('feed.mediaQuota'))
    return
  }
  if (caught.code === 'UNSUPPORTED_MEDIA_TYPE') {
    showToast(t('errors.attachmentUnsupported'))
    return
  }
  if (caught.code === 'MEDIA_TOO_LARGE') {
    showToast(t('errors.attachmentTooLarge'))
    return
  }
  if (caught.code === 'MEDIA_TOO_LONG') {
    showToast(t('errors.videoTooLong', { count: MAX_VIDEO_SECONDS }))
    return
  }
  showToast(
    caught.code === 'VALIDATION_FAILED' ? t('feed.wrongPostKind') : t('feed.attachmentFailed'),
  )
}
