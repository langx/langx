import type { InfiniteData } from '@tanstack/react-query'
import type { CommentRepliesPage, ThreadedComment, ThreadedCommentsPage } from '../api/types'

/**
 * A post's comments as roots with one level of replies, and the patches that
 * keep a loaded thread in step without refetching it.
 *
 * Patched rather than invalidated for the reason `feedCache` gives about the
 * feed: a refetch of an infinite query re-reads every page, and the thread is
 * the screen the reader is typing into. A reply appears under the finger that
 * sent it and a deleted one leaves the same way.
 *
 * Pure, and free of `react-native`, so vitest can hold every branch.
 */
type Roots = InfiniteData<ThreadedCommentsPage> | undefined
type Replies = InfiniteData<CommentRepliesPage> | undefined

/** How many live replies a root has, whichever of the two fields the server filled. */
export function replyCountOf(root: ThreadedComment): number {
  return root.replyCount ?? root.replies?.length ?? 0
}

function patchRoot(
  data: Roots,
  rootId: string,
  patch: (root: ThreadedComment) => ThreadedComment | null,
): Roots {
  if (!data) return data
  let changed = false
  const pages = data.pages.map((page) => {
    if (!page.items.some((item) => item._id === rootId)) return page
    const items: ThreadedComment[] = []
    for (const item of page.items) {
      if (item._id !== rootId) {
        items.push(item)
        continue
      }
      const next = patch(item)
      if (next !== item) changed = true
      if (next) items.push(next)
    }
    return { ...page, items }
  })
  // Identity when nothing moved, so React Query does not re-render the thread.
  return changed ? { ...data, pages } : data
}

/**
 * A reply you just sent, under its root.
 *
 * Appended to the preview even when the root has replies the preview does not
 * show: the writer has to see what they sent, and "View N more replies" stays
 * right because it counts what is missing, not what is shown. Expanding merges
 * the full list back into order — see `repliesToShow`.
 */
export function appendReply(data: Roots, rootId: string, reply: ThreadedComment): Roots {
  return patchRoot(data, rootId, (root) => {
    const replies = root.replies ?? []
    if (replies.some((existing) => existing._id === reply._id)) return root
    return { ...root, replies: [...replies, reply], replyCount: replyCountOf(root) + 1 }
  })
}

/**
 * The same reply, into an expanded root's own list — but only once that list
 * is loaded to its end. Mid-way, the reply is newer than every row still to
 * come, so it arrives on the last page by itself; appending it now would draw
 * it and then draw it again.
 */
export function appendToReplies(data: Replies, reply: ThreadedComment): Replies {
  if (!data) return data
  const last = data.pages[data.pages.length - 1]
  if (!last || last.nextCursor !== null) return data
  if (data.pages.some((page) => page.items.some((item) => item._id === reply._id))) return data
  const pages = [...data.pages.slice(0, -1), { ...last, items: [...last.items, reply] }]
  return { ...data, pages }
}

/**
 * A comment taken off the loaded thread, the way the server takes it off.
 *
 * - A reply goes, and its root counts one fewer. A root that was already a
 *   tombstone and has just lost its last reply goes with it — the server
 *   removes that one too, and a "Comment removed" over nothing says nothing.
 * - A root with live replies becomes a tombstone, so the conversation under it
 *   survives; a root without any simply goes.
 *
 * `rootId` is the reply's root, when it is a reply. The screen always knows
 * it, and a reply beyond the preview is not in these pages to be found.
 */
export function removeFromThread(data: Roots, commentId: string, rootId?: string): Roots {
  if (rootId && rootId !== commentId) {
    return patchRoot(data, rootId, (root) => {
      const replyCount = Math.max(0, replyCountOf(root) - 1)
      if (root.deleted && replyCount === 0) return null
      return {
        ...root,
        replies: (root.replies ?? []).filter((reply) => reply._id !== commentId),
        replyCount,
      }
    })
  }
  return patchRoot(data, commentId, (root) =>
    replyCountOf(root) > 0 ? { ...root, body: '', deleted: true } : null,
  )
}

export function removeFromReplies(data: Replies, commentId: string): Replies {
  if (!data) return data
  let found = false
  const pages = data.pages.map((page) => {
    if (!page.items.some((item) => item._id === commentId)) return page
    found = true
    return { ...page, items: page.items.filter((item) => item._id !== commentId) }
  })
  return found ? { ...data, pages } : data
}

function byTime(a: ThreadedComment, b: ThreadedComment): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
  return a._id < b._id ? -1 : a._id > b._id ? 1 : 0
}

/**
 * What a root shows under it: the preview, or — once expanded — every reply
 * loaded so far, merged with the preview so a reply just sent is not lost
 * between the two, oldest first.
 */
export function repliesToShow(
  root: ThreadedComment,
  expanded: readonly ThreadedComment[] | undefined,
): ThreadedComment[] {
  const preview = root.replies ?? []
  if (!expanded) return preview
  const seen = new Set<string>()
  const merged: ThreadedComment[] = []
  for (const reply of [...expanded, ...preview]) {
    if (seen.has(reply._id)) continue
    seen.add(reply._id)
    merged.push(reply)
  }
  return merged.sort(byTime)
}

/** How many replies "View N more replies" promises. Never negative. */
export function hiddenReplyCount(root: ThreadedComment, shown: number): number {
  return Math.max(0, replyCountOf(root) - shown)
}

/**
 * Who a reply to `target` answers, and what its text starts with.
 *
 * Replying to a root needs no prefix — the indentation already says who. A
 * reply to a reply joins the same root (there is only one level), so the
 * `@handle` is the only thing left to say which of the replies it answers.
 */
export function replyDraftFor(target: ThreadedComment): {
  rootId: string
  prefill: string
} {
  if (target.parentId) return { rootId: target.parentId, prefill: `@${target.author.handle} ` }
  return { rootId: target._id, prefill: '' }
}
