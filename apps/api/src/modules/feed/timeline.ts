import { FEED_TIMELINE_WINDOW, type ListTimelineQuery, type TimelinePage } from '@langx/shared'
import type { Db, Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import {
  decodeTimelineCursor,
  encodeTimelineCursor,
  type TimelineCursor,
  type TimelinePoint,
} from '../../lib/timelineCursor'
import { blockedUserIds } from '../moderation/blocks'
import type { Profile } from '../profiles/profiles'
import { notHidden, type Post } from './documents'
import { boundAudience, hydratePosts, readAudience } from './feed'
import {
  compareTimelineKeys,
  rankTimeline,
  type TimelineCandidate,
  type TimelineKey,
  type TimelineViewer,
} from './timelineRank'

/**
 * `GET /feed/timeline`: every post in one list, most relevant to the reader
 * first, then everything older in plain recency.
 *
 * **The window.** Page one reads the newest `FEED_TIMELINE_WINDOW` posts on
 * `recent`, projected to what ranking needs, and pins three things into the
 * cursor: `now`, the newest `(createdAt, _id)` it read (`anchor`) and the
 * oldest (`floor`). Every later page re-reads exactly that range and ranks it
 * again against the same `now`, so the order is identical and the cursor's key
 * finds its place in it. A post written since is newer than `anchor` and
 * cannot enter; one deleted, hidden or blocked since only removes itself.
 * Ranking is in memory because the score is not a field — but over at most a
 * window's worth of small projected rows, never the collection.
 *
 * **The tail.** Once the window is spent, the same response fills the page
 * from plain recency strictly below `floor`, on the same index, and the
 * cursor switches shape. The feed never ends early.
 *
 * Suspended authors are not filtered, as in the sections: hiding is decided
 * per post.
 */

export interface TimelineReader {
  userId: string
  /** Verified and not a guest — see `TimelineViewer.canAnswer`. Passed in, not read. */
  canAnswer: boolean
}

export interface TimelineOptions {
  /** How many posts page one ranks. Injectable so a test's fixtures are the window. */
  window?: number
  now?: Date
  /** Told the window's span on page one — see the note beside the call. */
  log?: (fields: { windowPosts: number; windowSpanHours: number }) => void
}

/** The fields the window read keeps, and the only ones ranking reads. */
const SCORING_PROJECTION = {
  _id: 1,
  authorId: 1,
  createdAt: 1,
  language: 1,
  asks: 1,
  kind: 1,
  correctionCount: 1,
  answerCount: 1,
} as const

/**
 * `(createdAt, _id)` inside `[floor, anchor]`, both ends included.
 *
 * The plain range on `createdAt` is what bounds the scan on `recent`; the two
 * clauses under `$and` only settle the ties at each end, where several posts
 * can share a millisecond. Written as the pair a planner can bound rather than
 * one `$or` of the whole comparison, which it cannot — and a range it cannot
 * bound would scan from the floor to the end of the collection looking for
 * rows that are not there.
 */
export function withinRange(anchor: TimelinePoint, floor: TimelinePoint): Document {
  return {
    createdAt: { $gte: floor.date, $lte: anchor.date },
    $and: [
      { $or: [{ createdAt: { $lt: anchor.date } }, { _id: { $lte: anchor.id } }] },
      { $or: [{ createdAt: { $gt: floor.date } }, { _id: { $gte: floor.id } }] },
    ],
  }
}

/** `(createdAt, _id)` strictly below a point, bounded the same way. */
export function olderThan(point: TimelinePoint): Document {
  return {
    createdAt: { $lte: point.date },
    $and: [{ $or: [{ createdAt: { $lt: point.date } }, { _id: { $lt: point.id } }] }],
  }
}

export async function listTimeline(
  db: Db,
  reader: TimelineReader,
  query: ListTimelineQuery,
  options: TimelineOptions = {},
): Promise<TimelinePage> {
  const { userId } = reader
  const posts = db.collection<Post>(COLLECTIONS.posts)
  const cursor = query.cursor ? decodeTimelineCursor(query.cursor) : null

  if (cursor?.segment === 'tail') {
    const hidden = await blockedUserIds(db, userId)
    const page = await posts
      .find({ ...visibleTo(hidden), ...olderThan(cursor.last) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .toArray()
    const items = page.slice(0, query.limit)
    const last = items.at(-1)
    return {
      items: await hydratePosts(db, userId, items, { corrections: true, answers: true }),
      nextCursor:
        page.length > query.limit && last
          ? encodeTimelineCursor({ segment: 'tail', last: { date: last.createdAt, id: last._id } })
          : null,
    }
  }

  /*
   * Everything the ranking reads about the reader, in parallel: who they are
   * hidden from, who their people are, and which languages they speak and
   * learn. Read on every page rather than cached across them, because a cache
   * would leave a new block stale for as long as it lived.
   */
  const [hidden, related, profile] = await Promise.all([
    blockedUserIds(db, userId),
    readAudience(db, userId),
    db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne(
        { _id: userId },
        { projection: { nativeLanguages: 1, learning: 1 } },
      ) as Promise<Pick<Profile, 'nativeLanguages' | 'learning'> | null>,
  ])
  // A viewer with no profile — a guest — ranks with empty language sets rather
  // than a 404: browsing is exactly what a guest is for.
  const viewer: TimelineViewer = {
    id: userId,
    native: new Set((profile?.nativeLanguages ?? []).map((entry) => entry.code)),
    learning: new Set((profile?.learning ?? []).map((entry) => entry.code)),
    audience: new Set(boundAudience(related, userId, hidden)),
    canAnswer: reader.canAnswer,
  }
  const filter = visibleTo(hidden)
  const window = options.window ?? FEED_TIMELINE_WINDOW

  let now: Date
  let anchor: TimelinePoint
  let floor: TimelinePoint
  let candidates: TimelineCandidate[]
  if (cursor) {
    now = cursor.now
    anchor = cursor.anchor
    floor = cursor.floor
    candidates = await posts
      .find({ ...filter, ...withinRange(anchor, floor) })
      .sort({ createdAt: -1, _id: -1 })
      // The range held at most a window's worth on page one, and only an
      // unblock or an unhide can add to it. Bounded anyway, so no change
      // between pages can turn this into an unbounded read.
      .limit(window * 2)
      .project<TimelineCandidate>(SCORING_PROJECTION)
      .toArray()
  } else {
    now = options.now ?? new Date()
    candidates = await posts
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(window)
      .project<TimelineCandidate>(SCORING_PROJECTION)
      .toArray()
    const newest = candidates[0]
    const oldest = candidates.at(-1)
    if (!newest || !oldest) return { items: [], nextCursor: null }
    anchor = { date: newest.createdAt, id: newest._id }
    floor = { date: oldest.createdAt, id: oldest._id }
    /*
     * The ranking assumes the window reaches back further than an open ask's
     * half-life; an older open ask is served only by the tail. Logged so that
     * the day it stops being true is visible before anybody notices the asks.
     */
    options.log?.({
      windowPosts: candidates.length,
      windowSpanHours: (anchor.date.getTime() - floor.date.getTime()) / 3_600_000,
    })
  }

  const ranked = rankTimeline(candidates, viewer, now)
  const after = cursor?.segment === 'window' ? cursorKey(cursor) : null
  const rest = after ? ranked.filter((key) => compareTimelineKeys(key, after) > 0) : ranked

  const fromWindow = rest.slice(0, query.limit)
  const windowHasMore = rest.length > query.limit

  /*
   * The page's own documents, by id, with the same filters again: a post
   * hidden or blocked between the window read and this one is never served.
   * A page thinned that way comes back short; the cursor is the last key
   * *ranked*, not the last kept, so it does not loop.
   */
  const fetched = fromWindow.length
    ? await posts.find({ ...filter, _id: { $in: fromWindow.map((key) => key._id) } }).toArray()
    : []
  const byId = new Map(fetched.map((post) => [post._id.toHexString(), post]))
  const items = fromWindow.flatMap((key) => byId.get(key._id.toHexString()) ?? [])

  let nextCursor: string | null = null
  const lastKey = fromWindow.at(-1)
  if (windowHasMore && lastKey) {
    nextCursor = encodeTimelineCursor({
      segment: 'window',
      now,
      anchor,
      floor,
      last: { tier: lastKey.tier, score: lastKey.score, date: lastKey.createdAt, id: lastKey._id },
    })
  } else {
    // The window is spent inside this page: carry on below `floor`. The `+1`
    // is what says whether there is a page after this one, even when the
    // window filled the page exactly.
    const room = query.limit - fromWindow.length
    const tail = await posts
      .find({ ...filter, ...olderThan(floor) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(room + 1)
      .toArray()
    const served = tail.slice(0, room)
    items.push(...served)
    if (tail.length > room) {
      const last = served.at(-1)
      nextCursor = encodeTimelineCursor({
        segment: 'tail',
        last: last ? { date: last.createdAt, id: last._id } : floor,
      })
    }
  }

  return {
    items: await hydratePosts(db, userId, items, { corrections: true, answers: true }),
    nextCursor,
  }
}

/** Not hidden by a moderator, and not by or to anybody on either side of a block. */
export function visibleTo(hidden: readonly string[]): Document {
  return { ...notHidden(), ...(hidden.length > 0 ? { authorId: { $nin: [...hidden] } } : {}) }
}

function cursorKey(cursor: Extract<TimelineCursor, { segment: 'window' }>): TimelineKey {
  const { tier, score, date, id } = cursor.last
  return { tier, score, createdAt: date, _id: id }
}
