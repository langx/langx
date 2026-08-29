import type { InfiniteData } from '@tanstack/react-query'
import type { FeedPage, FeedPost, PostCorrection } from '@langx/shared'

type Pages = InfiniteData<FeedPage> | undefined

/**
 * A correction patched into the loaded feed pages instead of invalidating them.
 *
 * The invalidation was not a performance choice that went too far, it was a
 * disappearing card. `needsCorrection` sorts `correctionCount` **ascending**,
 * so a refetch right after you answer re-sorts that post behind every
 * unanswered post in the collection — the card you just acted on vanished
 * rather than flipping to "You corrected this". That sort is not the bug: it is
 * what makes the queue drain, and inverting it would trade a UI glitch for the
 * product.
 *
 * So the fix belongs here. The next natural refetch — pull-to-refresh, tab
 * switch, remount — sorts it away for real, which is correct: it no longer
 * belongs at the top of a queue of unanswered sentences. It just should not
 * happen in the same frame as the tap.
 */
export function applyCorrection(data: Pages, postId: string, correction: PostCorrection): Pages {
  return patchPost(data, postId, (post) => ({
    ...post,
    correctionCount: post.correctionCount + 1,
    correctedByViewer: true,
    /*
     * Only when there was none. `topCorrection` is the *oldest* correction, not
     * the best and not the newest — whoever answered first is the one who
     * answered. Yours is the oldest exactly when the post had no answer at all.
     */
    topCorrection: post.topCorrection ?? correction,
  }))
}

/**
 * Returns the identical object when nothing matched, so React Query sees an
 * unchanged cache and does not re-render every card in the list.
 */
function patchPost(data: Pages, postId: string, patch: (post: FeedPost) => FeedPost): Pages {
  if (!data) return data
  let found = false
  const pages = data.pages.map((page) => {
    if (!page.items.some((post) => post._id === postId)) return page
    found = true
    return { ...page, items: page.items.map((post) => (post._id === postId ? patch(post) : post)) }
  })
  return found ? { ...data, pages } : data
}
