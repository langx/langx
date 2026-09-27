/**
 * The feed's cache keys that a decision rests on, apart from `queries.ts` so a
 * test can hold them — that file reaches `expo-router` through the API client,
 * which vitest cannot load.
 */

/**
 * The one timeline. Under the `['feed']` prefix every patcher in `feedCache`
 * walks, so a like, a correction or a delete reaches it with no new call site
 * — and never `'mine'` or an old section's segment, which it would collide
 * with.
 */
export const TIMELINE_KEY = ['feed', 'timeline'] as const

/**
 * What a follow or an unfollow refreshes.
 *
 * Not the timeline, on purpose. A refetch of an infinite query re-reads every
 * loaded page, each a ranked read of a two-hundred-post window, and it would
 * re-sort the list under the reader's finger for a weight change they cannot
 * see. The new order arrives with the next pull-to-refresh. The two old
 * section keys stay listed: a cache restored from a build that had them is
 * still keyed that way until it ages out.
 */
export const FOLLOW_INVALIDATES: readonly (readonly string[])[] = [
  ['feed', 'correction'],
  ['feed', 'pronunciation'],
  ['follows'],
]

/** Whether invalidating `prefix` would reach `key` — React Query's own prefix rule. */
export function reaches(prefix: readonly string[], key: readonly string[]): boolean {
  return prefix.length <= key.length && prefix.every((part, index) => key[index] === part)
}

/** `GET /feed/timeline`, with the cursor when there is one. */
export function timelinePath(cursor: string): string {
  return `/feed/timeline${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
}
