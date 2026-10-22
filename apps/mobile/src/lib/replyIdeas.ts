import type { MessageDto } from '../api/queries'

/**
 * The partner message Reply ideas would answer, or nothing when the chip has
 * no business being drawn.
 *
 * Only the thread's newest message, and only when it is theirs: once you have
 * written back, the line is answered, and offering ideas for an older one
 * would suggest a reply to something the conversation has moved past. Text
 * only, and not a withdrawn or view-once message — the server leaves those
 * out of what it reads, so an idea "for" one would be an idea for the line
 * before it. An empty composer, and not a correction: a draft means the
 * person is already answering in their own words, and ideas dropped in then
 * would throw those words away.
 *
 * `items` newest first, the order the thread holds them in — including the
 * stand-ins for sends still on their way, so a sentence just sent puts the
 * chip away at once.
 */
export function replyIdeasFor(
  items: readonly MessageDto[],
  viewerId: string | undefined,
  draft: string,
  correcting: boolean,
): MessageDto | undefined {
  if (!viewerId || correcting || draft.trim().length > 0) return undefined
  const newest = items[0]
  if (!newest || newest.senderId === viewerId) return undefined
  if (newest.type !== 'text' || newest.deleted || newest.viewOnce) return undefined
  return newest.body.trim().length > 0 ? newest : undefined
}

/** Enough for every unanswered message somebody opens in a sitting; the oldest goes first. */
const CACHE_LIMIT = 50

/**
 * Ideas already paid for, by the message they answer, for as long as the app
 * runs. Reopening the strip — or leaving the thread and coming back — draws
 * them again without spending another answer. Kept in memory only: they are
 * a reading of somebody's private chat, and nothing about them should outlive
 * the session. Keyed by the reader too, so a second account signed in on the
 * same device never sees the first one's.
 */
export function createReplyIdeasCache(limit = CACHE_LIMIT) {
  const entries = new Map<string, readonly string[]>()
  const key = (viewerId: string, messageId: string) => `${viewerId}:${messageId}`
  return {
    get(viewerId: string, messageId: string): readonly string[] | undefined {
      return entries.get(key(viewerId, messageId))
    },
    set(viewerId: string, messageId: string, ideas: readonly string[]): void {
      const at = key(viewerId, messageId)
      entries.delete(at)
      entries.set(at, ideas)
      while (entries.size > limit) {
        const oldest = entries.keys().next().value
        if (oldest === undefined) break
        entries.delete(oldest)
      }
    },
  }
}

export const replyIdeasCache = createReplyIdeasCache()
