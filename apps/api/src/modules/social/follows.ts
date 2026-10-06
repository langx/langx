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

  /*
   * Your own counts are plain counts — your own lists show everyone (see
   * `listEdges`). Anybody else's leave out the people their list leaves out,
   * for the block's reason above: a count beside a shorter list says somebody
   * is missing from it, and that is the thing "hide me from Discover" is for.
   * A join rather than a `countDocuments`, so only when it is needed.
   */
  const count = (match: Document, personField: PersonField) =>
    viewerId === targetId
      ? follows.countDocuments({ ...match, ...(notHidden ? { [personField]: notHidden } : {}) })
      : countListed(db, viewerId, match, personField, notHidden)

  const [followers, following, mine] = await Promise.all([
    count({ followeeId: targetId }, 'followerId'),
    count({ followerId: targetId }, 'followeeId'),
    viewerId === targetId
      ? Promise.resolve(null)
      : follows.findOne({ followerId: viewerId, followeeId: targetId }),
  ])

  return { followers, following, viewerFollows: mine !== null }
}

type PersonField = 'followerId' | 'followeeId'

/**
 * Who a list shows, as a profile filter. Somebody with "hide me from
 * Discover" on is left out of other people's lists — a follower list is a
 * place strangers browse to find people, and the switch promises they will
 * not — but never out of their own view of it, and never out of the list's
 * owner's. The owner chose to follow them or was told they followed; and a
 * person you follow but cannot see in your own list is somebody you cannot
 * unfollow.
 */
function listedProfiles(viewerId: string, ownerId: string): Document {
  if (viewerId === ownerId) return { deletedAt: { $exists: false } }
  return {
    deletedAt: { $exists: false },
    $or: [{ 'settings.discoverable': true }, { _id: viewerId }],
  }
}

/** The number of rows `listEdges` would show `viewerId`, across every page. */
async function countListed(
  db: Db,
  viewerId: string,
  match: Document,
  personField: PersonField,
  notHidden: { $nin: string[] } | undefined,
): Promise<number> {
  const ownerId = String(personField === 'followerId' ? match.followeeId : match.followerId)
  const [row] = await db
    .collection<Follow>(COLLECTIONS.follows)
    .aggregate<{ n: number }>([
      { $match: { ...match, ...(notHidden ? { [personField]: notHidden } : {}) } },
      {
        $lookup: {
          from: COLLECTIONS.profiles,
          localField: personField,
          foreignField: '_id',
          pipeline: [{ $match: listedProfiles(viewerId, ownerId) }, { $project: { _id: 1 } }],
          as: 'person',
        },
      },
      { $match: { 'person.0': { $exists: true } } },
      { $count: 'n' },
    ])
    .toArray()
  return row?.n ?? 0
}

export async function listFollowers(
  db: Db,
  viewerId: string,
  targetId: string,
  query: ListFollowsQuery,
): Promise<PeoplePage> {
  return listEdges(db, viewerId, targetId, { followeeId: targetId }, 'followerId', query)
}

export async function listFollowing(
  db: Db,
  viewerId: string,
  targetId: string,
  query: ListFollowsQuery,
): Promise<PeoplePage> {
  return listEdges(db, viewerId, targetId, { followerId: targetId }, 'followeeId', query)
}

async function listEdges(
  db: Db,
  viewerId: string,
  ownerId: string,
  match: Document,
  personField: PersonField,
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
    .find({
      _id: { $in: rows.map((row) => row[personField]) },
      ...listedProfiles(viewerId, ownerId),
    })
    .toArray()
  const byId = new Map(profiles.map((profile) => [profile._id, profile]))

  // A row whose profile is gone, or is hidden from this viewer, is dropped
  // rather than rendered, so the page can come back shorter than `limit` — the
  // accepted behaviour in `getViewers` and the likers list for the same reason:
  // a name in a list of names is only the name, and there is nothing to show.
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
