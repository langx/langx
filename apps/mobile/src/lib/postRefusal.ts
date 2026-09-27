import type { MessageKey } from '../i18n'
import type { PostRefusalReason } from '../api/types'

/**
 * What to say when the feed refuses a post, a correction or a recording.
 *
 * The refusals share one code, `VALIDATION_FAILED`, so an installed build that
 * predates them still says something — and a newer one tells them apart by the
 * `reason` beside the code. Duck-typed on purpose: `ApiRequestError` lives in
 * `api/client`, which imports `expo-router`, and vitest cannot load that — so
 * the decisions live here, where they can be asserted, and the screens only
 * show what comes back.
 */
interface RefusalLike {
  code?: unknown
  reason?: unknown
  limit?: unknown
}

function fieldsOf(error: unknown): { code?: string; reason?: string; limit?: string } {
  if (typeof error !== 'object' || error === null) return {}
  const { code, reason, limit } = error as RefusalLike
  return {
    ...(typeof code === 'string' ? { code } : {}),
    ...(typeof reason === 'string' ? { reason } : {}),
    ...(typeof limit === 'string' ? { limit } : {}),
  }
}

/** Every reason the feed can give, worded. `stale_cursor` is never shown — see `isStaleCursor`. */
const REASON_KEYS: Record<Exclude<PostRefusalReason, 'stale_cursor'>, MessageKey> = {
  not_asked: 'feed.notAsking',
  ask_needs_words: 'feed.needsText',
  ask_needs_learning_language: 'feed.askNeedsLearning',
  moment_needs_content: 'feed.needsSomething',
  language_not_yours: 'feed.languageNotYours',
}

/**
 * A timeline cursor minted under different ranking constants.
 *
 * Not a failure to report: the order it pointed into no longer exists, so the
 * only honest continuation is page one again. A restored cache is how one gets
 * here — it keeps page one and its `nextCursor` across an update.
 */
export function isStaleCursor(error: unknown): boolean {
  const { code, reason } = fieldsOf(error)
  return code === 'VALIDATION_FAILED' && reason === 'stale_cursor'
}

/**
 * The sentence for a refused post, or `null` when the caller's own handling
 * (offline, media errors, the generic fallback) should decide.
 *
 * The daily post cap is a `QUOTA_EXCEEDED` like the media quota, told apart by
 * `limit` — without that branch it would read "today's attachment limit" on a
 * post with no attachment, which is what an installed build says.
 */
export function postRefusalKey(error: unknown): MessageKey | null {
  const { code, reason, limit } = fieldsOf(error)
  if (code === 'QUOTA_EXCEEDED' && limit === 'postsPer24h') return 'feed.postLimit'
  if (code !== 'VALIDATION_FAILED') return null
  if (reason && reason in REASON_KEYS) return REASON_KEYS[reason as keyof typeof REASON_KEYS]
  // A validation failure with no reason is an API that does not know asks yet
  // (it refuses the field outright) or a shape this build got wrong. Neither
  // is something the writer can fix, so it gets the generic sentence.
  return 'feed.postFailed'
}

/**
 * The sentence for a refused correction or recording.
 *
 * "You have already corrected this" was the answer to every `VALIDATION_FAILED`
 * here, which was true while the duplicate was the only way to get one. It
 * still is the only one without a `reason`; everything with one — the post
 * asks for something else — is worded as what it is.
 */
export function replyRefusalKey(
  error: unknown,
  duplicate: MessageKey,
): { key: MessageKey; duplicate: boolean } | null {
  const { code, reason } = fieldsOf(error)
  if (code !== 'VALIDATION_FAILED') return null
  if (reason && reason in REASON_KEYS) {
    return { key: REASON_KEYS[reason as keyof typeof REASON_KEYS], duplicate: false }
  }
  return { key: duplicate, duplicate: true }
}
