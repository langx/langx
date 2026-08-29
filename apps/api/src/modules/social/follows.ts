import {
  ERROR_CODES,
  type FollowState,
  type ListFollowsQuery,
  type PeoplePage,
} from '@langx/shared'
import { ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { blockedUserIds } from '../moderation/blocks'
import type { Profile } from '../profiles/profiles'

export interface Follow {
  _id: ObjectId
  /** The one who pressed Follow. */
  followerId: string
  /** The one being followed. */
  followeeId: string
  createdAt: Date
}

/**
 * The target must exist, must not be the viewer, and must not be blocked in
 * either direction.
 *
 * `NOT_FOUND` rather than `FORBIDDEN` for a blocked target, matching
 * `GET /profiles/:handleOrId`: a blocked account is *absent*, and a 403 would
 * confirm that it exists.
 */
async function assertFollowable(db: Db, followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You cannot follow yourself')
  }
  const [target, hidden] = await Promise.all([
    db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: followeeId, deletedAt: { $exists: false } }),
    blockedUserIds(db, followerId),
  ])
  if (!target || hidden.includes(followeeId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  }
}

/**
 * Follow, idempotently.
 *
 * `insertOne` and catch the duplicate rather than reading first: two taps that
 * race would both pass a check-then-write, and the unique index is the only
 * thing that decides for the whole cluster at once. Same shape as `blockUser`.
 */
export async function followUser(
  db: Db,
  followerId: string,
  followeeId: string,
): Promise<FollowState> {
  await assertFollowable(db, followerId, followeeId)
  try {
    await db.collection<Follow>(COLLECTIONS.follows).insertOne({
      _id: new ObjectId(),
      followerId,
      followeeId,
      createdAt: new Date(),
    })
  } catch (error) {
    // Already following is not an error, it is the answer.
    if (!isDuplicate(error)) throw error
  }
  return readFollowState(db, followerId, followeeId)
}

/** Unfollow. Idempotent by construction. */
export async function unfollowUser(
  db: Db,
  followerId: string,
  followeeId: string,
): Promise<FollowState> {
  await assertFollowable(db, followerId, followeeId)
  await db.collection<Follow>(COLLECTIONS.follows).deleteOne({ followerId, followeeId })
  return readFollowState(db, followerId, followeeId)
}

/**
 * Follower and following counts for one profile, as the viewer sees them.
 *
 * **Counted, not denormalized.** The deciding question in this repo is whether
 * the number is a sort key: `posts.correctionCount` is stored because an index
 * cannot sort on a count it would have to join to find, and `tokenAggregates`
 * is the counter-example — "no duplicate counter in `profiles`, which would
 * only drift". Nothing sorts by follower count, so it is the second case, and
 * both queries ride an index prefix.
 *
 * **Block-filtered, which makes them viewer-dependent — deliberately.** An
 * unfiltered count beside a filtered list would read "12 followers" over 11
 * rows, and that discrepancy tells the viewer that somebody they blocked
 * follows this person. A blocked account is absent, not hidden-but-counted.
 * Do not simplify this back to a bare `countDocuments` for speed: `hidden` is
 * a handful of ids and the query stays on the same index prefix.
 *
 * Likes get the opposite answer for a reason, not by accident — see
 * `listLikers`.
 */
export async function readFollowState(
  db: Db,
  viewerId: string,
  targetId: string,
): Promise<FollowState> {
  const follows = db.collection<Follow>(COLLECTIONS.follows)
  const hidden = await blockedUserIds(db, viewerId)
  const notHidden = hidden.length > 0 ? { $nin: hidden } : undefined

  const [followers, following, mine] = await Promise.all([
    follows.countDocuments({
      followeeId: targetId,
      ...(notHidden ? { followerId: notHidden } : {}),
    }),
    follows.countDocuments({
      followerId: targetId,
      ...(notHidden ? { followeeId: notHidden } : {}),
    }),
    viewerId === targetId
      ? Promise.resolve(null)
      : follows.findOne({ followerId: viewerId, followeeId: targetId }),
  ])

  return { followers, following, viewerFollows: mine !== null }
}

export async function listFollowers(
  db: Db,
  viewerId: string,
  targetId: string,
  query: ListFollowsQuery,
): Promise<PeoplePage> {
  return listEdges(db, viewerId, { followeeId: targetId }, 'followerId', query)
}

export async function listFollowing(
  db: Db,
  viewerId: string,
  targetId: string,
  query: ListFollowsQuery,
): Promise<PeoplePage> {
  return listEdges(db, viewerId, { followerId: targetId }, 'followeeId', query)
}

async function listEdges(
  db: Db,
  viewerId: string,
  match: Document,
  personField: 'followerId' | 'followeeId',
  query: ListFollowsQuery,
): Promise<PeoplePage> {
  const hidden = await blockedUserIds(db, viewerId)
  const filter: Document = { ...match }
  if (hidden.length > 0) filter[personField] = { $nin: hidden }
  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    filter.$or = [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }]
  }

  const page = await db
    .collection<Follow>(COLLECTIONS.follows)
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const rows = hasMore ? page.slice(0, query.limit) : page
  const last = rows.at(-1)

  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ _id: { $in: rows.map((row) => row[personField]) }, deletedAt: { $exists: false } })
    .toArray()
  const byId = new Map(profiles.map((profile) => [profile._id, profile]))

  // A row whose profile is gone is dropped rather than rendered, so the page
  // can come back shorter than `limit` — the accepted behaviour in `getViewers`
  // and the likers list for the same reason: a name in a list of names is only
  // the name, and there is nothing left to show.
  const items = rows.flatMap((row) => {
    const profile = byId.get(row[personField])
    if (!profile) return []
    return [
      {
        _id: profile._id,
        handle: profile.handle,
        displayName: profile.displayName ?? profile.handle,
        ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
      },
    ]
  })

  return {
    items,
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}

/**
 * Who this user follows, most recent first, capped.
 *
 * The cap is not a page size: this feeds an `$in` on the feed's author filter,
 * and an `$in` is a list the query planner has to carry. Truncating by recency
 * is the tiebreak the rest of the app already uses — somebody who follows nine
 * hundred people cares most about the ones they most recently chose.
 */
export async function followingIds(db: Db, userId: string, limit: number): Promise<string[]> {
  const rows = await db
    .collection<Follow>(COLLECTIONS.follows)
    .find({ followerId: userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .project<{ followeeId: string }>({ followeeId: 1 })
    .toArray()
  return rows.map((row) => row.followeeId)
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
}
