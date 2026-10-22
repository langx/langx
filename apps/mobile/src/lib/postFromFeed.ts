import type { FeedPost } from '@langx/shared'

/**
 * A post as some cached feed list already holds it, or `undefined`.
 *
 * Takes what `queryClient.getQueriesData({ queryKey: ['feed'] })` returns:
 * `[key, data]` pairs for the timeline, "My posts" and anything else cached
 * under the prefix. Each `data` is checked for an infinite query's shape
 * rather than trusted — a cache restored from an older build can hold a key
 * under `['feed']` whose pages are something else, and a lookup that threw on
 * one would take the post screen down with it.
 *
 * The first match wins. The lists under the prefix are patched together (a
 * like or a correction writes to the whole prefix), so any copy is as fresh as
 * the others.
 */
export function findFeedPost(
  entries: readonly (readonly [unknown, unknown])[],
  postId: string,
): FeedPost | undefined {
  for (const [, data] of entries) {
    const pages = (data as { pages?: unknown } | null | undefined)?.pages
    if (!Array.isArray(pages)) continue
    for (const page of pages) {
      const items = (page as { items?: unknown } | null | undefined)?.items
      if (!Array.isArray(items)) continue
      const found = items.find(
        (item): item is FeedPost => (item as { _id?: unknown } | null)?._id === postId,
      )
      if (found) return found
    }
  }
  return undefined
}

/**
 * Which copy of a post its screen draws: the post's own answer, else the
 * feed's while that answer is on its way — and neither once the post has
 * answered 404.
 *
 * Gone wins over the post's own cached answer too, not only over the feed's
 * copy. A failed refetch keeps the last data, which is right for a dropped
 * connection and wrong here: a post opened once, then deleted by its author,
 * reopened from a feed that had not refetched as the post still standing,
 * with every comment and correction sent to it refused as "try again".
 */
export function postOnScreen<T>(
  fetched: T | undefined,
  fromFeed: T | undefined,
  gone: boolean,
): T | undefined {
  if (gone) return undefined
  return fetched ?? fromFeed
}
