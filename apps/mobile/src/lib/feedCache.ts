import type { InfiniteData } from '@tanstack/react-query'
import type {
  FeedPage,
  FeedPost,
  LikeState,
  LikeTargetType,
  PostCorrection,
  PostCorrectionsPage,
} from '@langx/shared'
import { diffCorrection } from './correctionDiff'

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

/** One run of a folded correction line. `kept` is the uncoloured majority. */
export interface FoldRun {
  text: string
  kind: 'kept' | 'removed' | 'added'
}

/**
 * The two lines of `diffCorrection` folded into the one the feed draws: the
 * corrected sentence, with what was deleted struck through where it stood.
 *
 * The chat bubble has room for both lines; a feed card and a correction row do
 * not, and v3 draws them as one. The fold leans on the diff's invariant that
 * the unchanged segments of the two sides spell the same non-whitespace
 * characters in the same order, so both sides can be walked in lockstep — the
 * corrected side's text wins wherever they agree, and each side's changed runs
 * drop in at the point the walk has reached when it meets them.
 *
 * Pure and free of `react-native` for the same reason `correctionDiff` is.
 */
export function foldCorrection(original: string, corrected: string): FoldRun[] {
  const { original: a, corrected: b } = diffCorrection(original, corrected)
  const runs: FoldRun[] = []

  const emit = (text: string, kind: FoldRun['kind']): void => {
    if (text.length === 0) return
    const last = runs[runs.length - 1]
    if (last && last.kind === kind) last.text += text
    else runs.push({ text, kind })
  }
  // A deleted word's surrounding whitespace lives on the unchanged runs, which
  // the corrected side owns — so the strike would touch its neighbours without
  // this shim.
  const space = (): void => {
    const last = runs[runs.length - 1]
    if (last && !/\s$/.test(last.text)) emit(' ', 'kept')
  }

  let i = 0
  let j = 0
  let ai = 0
  let bj = 0
  while (i < a.length || j < b.length) {
    const sa = a[i]
    const sb = b[j]
    if (sa && ai >= sa.text.length) {
      i += 1
      ai = 0
      continue
    }
    if (sb && bj >= sb.text.length) {
      j += 1
      bj = 0
      continue
    }
    if (sa?.changed) {
      space()
      emit(sa.text, 'removed')
      space()
      i += 1
      ai = 0
      continue
    }
    // A replacement reads struck-then-green. The corrected side reaches its
    // changed run one whitespace earlier than the original reaches its own, so
    // drain that whitespace first — otherwise the green word lands before the
    // struck one.
    if (sb?.changed && sa && !sa.changed && /\s/.test(sa.text.charAt(ai))) {
      ai += 1
      continue
    }
    if (sb?.changed) {
      emit(sb.text, 'added')
      j += 1
      bj = 0
      continue
    }
    // Only the original's trailing whitespace can be left once the corrected
    // side has run out; it has nowhere to stand in the folded line.
    if (!sb) {
      i += 1
      ai = 0
      continue
    }
    const cb = sb.text.charAt(bj)
    if (/\s/.test(cb)) {
      emit(cb, 'kept')
      bj += 1
      continue
    }
    if (sa && /\s/.test(sa.text.charAt(ai))) {
      ai += 1
      continue
    }
    emit(cb, 'kept')
    bj += 1
    if (sa) ai += 1
  }
  return runs
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
