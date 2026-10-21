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
