import type { InfiniteData } from '@tanstack/react-query'
import type {
  FeedPage,
  FeedPost,
  LikeState,
  LikeTargetType,
  PostCorrection,
  PostCorrectionsPage,
} from '@langx/shared'

type Pages = InfiniteData<FeedPage> | undefined
type ThreadPages = InfiniteData<PostCorrectionsPage> | undefined

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

/**
 * A like patched into the loaded feed pages.
 *
 * The server answers a like with the whole new state rather than an
 * acknowledgement, so there is nothing to guess: `likeCount` and
 * `likedByViewer` are written, not incremented. That is what makes a double
 * tap on a slow network safe — two responses carry the same number, where two
 * increments would carry two.
 *
 * A liked *correction* is patched too, since the card shows one. It is the same
 * correction object the thread screen shows, and the two must not disagree
 * while both are on screen.
 */
export function applyLike(
  data: Pages,
  targetType: LikeTargetType,
  targetId: string,
  state: LikeState,
): Pages {
  if (!data) return data
  let found = false
  const pages = data.pages.map((page) => {
    const items = page.items.map((post) => {
      const patched = likePost(post, targetType, targetId, state)
      if (patched !== post) found = true
      return patched
    })
    return found ? { ...page, items } : page
  })
  return found ? { ...data, pages } : data
}

/** The same patch against the post detail screen's pages. */
export function applyLikeToThread(
  data: ThreadPages,
  targetType: LikeTargetType,
  targetId: string,
  state: LikeState,
): ThreadPages {
  if (!data) return data
  let found = false
  const pages = data.pages.map((page) => {
    const post = likePost(page.post, targetType, targetId, state)
    const items = page.items.map((correction) => {
      if (targetType !== 'correction' || correction._id !== targetId) return correction
      found = true
      return { ...correction, ...state }
    })
    if (post !== page.post) found = true
    return { ...page, post, items }
  })
  return found ? { ...data, pages } : data
}

function likePost(
  post: FeedPost,
  targetType: LikeTargetType,
  targetId: string,
  state: LikeState,
): FeedPost {
  if (targetType === 'post') {
    return post._id === targetId ? { ...post, ...state } : post
  }
  if (post.topCorrection?._id !== targetId) return post
  return { ...post, topCorrection: { ...post.topCorrection, ...state } }
}
