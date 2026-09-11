import { currentTranslate } from '../i18n/runtime'
import { errorStatusOf } from './errors'
import { showToast } from './toast'

/**
 * Whether a failure means "nobody answered".
 *
 * `ApiRequestError` carries the status the server sent back; a transport
 * failure — no route, a tunnel, `apiFetch`'s own fifteen-second timeout —
 * carries none. That is the whole distinction, and it is the one the reader
 * cares about: "that didn't go through" is a shrug, "you're offline" is an
 * explanation with an end to it.
 */
export function isOfflineFailure(caught: unknown): boolean {
  return errorStatusOf(caught) === undefined
}

/**
 * Says a tap did not take.
 *
 * The optimistic mutations put the heart back, the follow button back, the
 * unread badge back — and said nothing at all, so on a train the interface
 * appeared to undo itself for no reason, over and over. The rollback is right;
 * the silence was the bug.
 *
 * Reads the locale itself rather than taking a `t`, because the callers are
 * mutations in `api/queries.ts`, which is not a component and has no hook to
 * read one with. `AppGate` does the same for the update toast.
 */
export function reportActionError(caught: unknown): void {
  const t = currentTranslate()
  showToast(isOfflineFailure(caught) ? t('errors.offlineAction') : t('errors.actionFailed'))
}
