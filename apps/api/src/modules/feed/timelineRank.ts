import {
  asksOf,
  FEED_OWN_PIN_MINUTES,
  FEED_RANK,
  FEED_RANK_ASK_HALF_LIFE_H,
  FEED_RANK_AUTHOR_REPEAT,
  FEED_RANK_SOCIAL_HALF_LIFE_H,
  type PostAsk,
} from '@langx/shared'
import type { ObjectId } from 'mongodb'

/**
 * The timeline's order, as a pure function of the posts in the window, the
 * person reading and a pinned `now`.
 *
 * Pure and DB-free for the reason `boostedOrder.ts` is: an ordering bug is
 * cheapest to prove fixed where there is no database to stand up, and every
 * input that could make two pages disagree — the clock, the window, the
 * viewer — is an argument, so the cursor can pin them.
 */

/** The fields a post is ranked on, and nothing else: the window read projects these. */
export interface TimelineCandidate {
  _id: ObjectId
  authorId: string
  createdAt: Date
  language: string
  asks?: PostAsk[]
  kind?: string
  correctionCount: number
  answerCount?: number
}

export interface TimelineViewer {
  id: string
  /** `nativeLanguages[].code`. Empty for a viewer with no profile. */
  native: ReadonlySet<string>
  /** `learning[].code`. */
  learning: ReadonlySet<string>
  /** Follows ∪ conversation partners, blocks already removed. */
  audience: ReadonlySet<string>
  /**
   * Whether the viewer can act on an ask at all — verified and not a guest.
   * Boosting help somebody cannot give only degrades their feed.
   */
  canAnswer: boolean
}

/**
 * A post's place, and everything the cursor needs to find the next one.
 *
 * `tier` 0 is your own post in its first hour, sorted by recency; tier 1 is
 * everything else, sorted by `score`. `score` is an integer (the float score
 * times a million, floored) so it survives a round trip through a cursor
 * exactly — a float printed and parsed back is not always the same float.
 */
export interface TimelineKey {
  tier: 0 | 1
  score: number
  createdAt: Date
  _id: ObjectId
}

const HOUR_MS = 60 * 60 * 1000

/**
 * The score formula, for one post.
 *
 * `social` decays over a day and a half; `needsYou` over a week. Both are then
 * multiplied by the author-repeat factor, so an author's fifth post in the
 * window counts a sixteenth of their first.
 */
export function scorePost(
  post: TimelineCandidate,
  viewer: TimelineViewer,
  now: Date,
  repeats: number,
): number {
  const own = post.authorId === viewer.id
  const ageH = Math.max(0, now.getTime() - post.createdAt.getTime()) / HOUR_MS
  const asks = asksOf(post)

  const social = own
    ? FEED_RANK.base
    : FEED_RANK.base +
      (viewer.audience.has(post.authorId) ? FEED_RANK.audience : 0) +
      (viewer.learning.has(post.language) ? FEED_RANK.peer : 0)

  /*
   * Per ask, so a post asking for both keeps pulling native speakers while
   * either half is open — somebody who corrected it can still record it. It
   * also drops out for anybody who answered, with no per-viewer query: their
   * reply is what made that ask's count non-zero.
   */
  const openCorrection = asks.includes('correction') && post.correctionCount === 0
  const openRecording = asks.includes('pronunciation') && (post.answerCount ?? 0) === 0
  const needsYou =
    viewer.canAnswer &&
    !own &&
    (openCorrection || openRecording) &&
    viewer.native.has(post.language)

  const score =
    social * 0.5 ** (ageH / FEED_RANK_SOCIAL_HALF_LIFE_H) +
    (needsYou ? FEED_RANK.needsYou * 0.5 ** (ageH / FEED_RANK_ASK_HALF_LIFE_H) : 0)
  return score * FEED_RANK_AUTHOR_REPEAT ** repeats
}

/** Newest first, `_id` breaking ties — the `recent` index's own order. */
function newestFirst(a: { createdAt: Date; _id: ObjectId }, b: { createdAt: Date; _id: ObjectId }) {
  return (
    b.createdAt.getTime() - a.createdAt.getTime() ||
    b._id.toHexString().localeCompare(a._id.toHexString())
  )
}

/**
 * The order two keys go in: negative when `a` comes first.
 *
 * Tier first; inside tier 0 by recency; inside tier 1 by score, then recency,
 * then `_id` — so no two posts ever tie and "strictly after this key" is
 * always one well-defined place, including on the tier boundary.
 */
export function compareTimelineKeys(a: TimelineKey, b: TimelineKey): number {
  if (a.tier !== b.tier) return a.tier - b.tier
  if (a.tier === 1 && a.score !== b.score) return b.score - a.score
  return newestFirst(a, b)
}

/**
 * Every candidate's key, in timeline order.
 *
 * `repeats` — how many newer posts by the same author sit in the window — is
 * counted over the whole window rather than the page, so it is the same on
 * every page and a deleted post only shifts its own author's cards.
 */
export function rankTimeline(
  candidates: readonly TimelineCandidate[],
  viewer: TimelineViewer,
  now: Date,
): TimelineKey[] {
  const seen = new Map<string, number>()
  const keys: TimelineKey[] = []
  for (const post of [...candidates].sort(newestFirst)) {
    const repeats = seen.get(post.authorId) ?? 0
    seen.set(post.authorId, repeats + 1)

    const pinned =
      post.authorId === viewer.id &&
      now.getTime() - post.createdAt.getTime() < FEED_OWN_PIN_MINUTES * 60 * 1000
    keys.push(
      pinned
        ? { tier: 0, score: 0, createdAt: post.createdAt, _id: post._id }
        : {
            tier: 1,
            score: Math.floor(scorePost(post, viewer, now, repeats) * 1e6),
            createdAt: post.createdAt,
            _id: post._id,
          },
    )
  }
  return keys.sort(compareTimelineKeys)
}
