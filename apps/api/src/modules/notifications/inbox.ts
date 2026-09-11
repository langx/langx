import {
  IN_APP_NOTIFICATION_KINDS,
  type InAppNotification,
  type InAppNotificationKind,
  type ListNotificationsQuery,
  type NotificationsPage,
} from '@langx/shared'
import { ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import type { AppServer } from '../../ws/types'
import { userRoom } from '../../ws/types'
import type { Post } from '../feed/documents'
import { blockedUserIds } from '../moderation/blocks'
import type { Profile } from '../profiles/profiles'

/**
 * The notification centre: the place the app keeps what happened, as opposed
 * to the two channels that announce it and forget.
 *
 * Until now there was no such place. `social.ts` throttles the reply push to
 * one per post per hour and says, in as many words, that "the rest are waiting
 * in the app" — and they were not, because nothing stored them. Somebody who
 * missed the one push, or read it on a lock screen and swiped it away, had no
 * way of ever learning that three people had corrected their sentence.
 *
 * Nothing here consults `notificationsAllowed`, deliberately. Those switches
 * have two channels and both are about what *leaves* the app; turning off
 * social push is a request not to be buzzed, not a request to be blinded.
 */

/** How far the bell counts before it stops caring about the exact number. */
const UNREAD_COUNT_CAP = 100

/** The post excerpt a row carries, so it can name what it is about. */
const PREVIEW_LENGTH = 80

export interface NotificationDoc {
  _id: ObjectId
  /** The recipient. */
  userId: string
  kind: InAppNotificationKind
  /**
   * What makes this arrive once, composed per kind — the follower's id, the
   * comment's id, the day a pool paid out. Required, never absent: a missing
   * field indexes as null, and `user_kind_ref_unique` would then mean "one row
   * of this kind, ever".
   */
  refId: string
  /** Absent on the kinds nobody did to you. */
  actorId?: string
  postId?: ObjectId
  count?: number
  badgeId?: string
  createdAt: Date
  /** Absent means unread. `null` is never written — see `user_unread`. */
  readAt?: Date
}

export interface RecordNotificationInput {
  userId: string
  kind: InAppNotificationKind
  refId: string
  actorId?: string
  postId?: ObjectId
  count?: number
  badgeId?: string
  at?: Date
}

/**
 * Where a live badge can be delivered, when there is anywhere to deliver it.
 *
 * Optional, and last, because three of the writers have no socket server to
 * hand: `startNotificationScheduler` and `runDailyPool` are given a database
 * and a logger and nothing else. That is not a gap to be plugged later — those
 * three kinds are already up to a day late by construction, so a live blip
 * buys nothing, and the client refetches the count on foreground anyway. Only
 * the social kinds, which fire from a request handler and are the reason this
 * module exists, get the emit.
 */
export interface NotificationLive {
  io: AppServer
  logger: { error: (obj: object, msg: string) => void }
}

/**
 * Write one row, once.
 *
 * The insert failing on a duplicate key *is* the check that it has not been
 * written before — the same trick `likeTarget` uses, and for the same reason:
 * a read followed by a write has a gap, and two taps landing in it is two rows
 * saying the same thing.
 *
 * Nothing here throws into its caller. Every call site has already written
 * successfully — the comment exists, the follow is recorded — and a slow
 * collection must never turn that into a 500.
 */
export async function recordNotification(
  db: Db,
  input: RecordNotificationInput,
  live?: NotificationLive,
): Promise<void> {
  // Telling yourself something you just did is not news.
  if (input.actorId === input.userId) return

  try {
    await db.collection<NotificationDoc>(COLLECTIONS.notifications).insertOne({
      _id: new ObjectId(),
      userId: input.userId,
      kind: input.kind,
      refId: input.refId,
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.postId ? { postId: input.postId } : {}),
      ...(input.count !== undefined ? { count: input.count } : {}),
      ...(input.badgeId ? { badgeId: input.badgeId } : {}),
      createdAt: input.at ?? new Date(),
    })
  } catch (error) {
    // 11000 is a duplicate key: it is already there, which is the answer. The
    // emit is skipped with it — a second badge bump for a row that did not
    // appear is worse than none.
    if ((error as { code?: number }).code === 11000) return
    live?.logger.error({ err: error, userId: input.userId }, 'notification row failed')
    return
  }

  try {
    live?.io.to(userRoom(input.userId)).emit('notification:new', {})
  } catch (error) {
    live?.logger.error({ err: error, userId: input.userId }, 'notification emit failed')
  }
}

/**
 * Several rows at once, for a pass that already knows every recipient.
 *
 * `ordered: false` so one duplicate does not abandon the rest of the batch —
 * a re-run of the daily pool has to be able to fill in the people it did not
 * reach the first time.
 */
export async function recordNotifications(
  db: Db,
  inputs: RecordNotificationInput[],
  logger?: { warn: (obj: object, msg: string) => void },
): Promise<void> {
  const rows = inputs
    .filter((input) => input.actorId !== input.userId)
    .map((input) => ({
      _id: new ObjectId(),
      userId: input.userId,
      kind: input.kind,
      refId: input.refId,
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.postId ? { postId: input.postId } : {}),
      ...(input.count !== undefined ? { count: input.count } : {}),
      ...(input.badgeId ? { badgeId: input.badgeId } : {}),
      createdAt: input.at ?? new Date(),
    }))
  if (rows.length === 0) return

  try {
    await db
      .collection<NotificationDoc>(COLLECTIONS.notifications)
      .insertMany(rows, { ordered: false })
  } catch (error) {
    // A batch of duplicates reports as one error carrying every rejection;
    // the rows that were new went in regardless, which is the whole point of
    // `ordered: false`.
    if ((error as { code?: number }).code === 11000) return
    logger?.warn({ err: error }, 'notification batch failed')
  }
}

/**
 * Which kinds pile up on one thing, and therefore collapse into one row.
 *
 * Ten people commenting on one sentence is ten pieces of the same news, and
 * ten rows saying so is a list nobody can scan — which is the whole purpose of
 * the screen. A follow is not in here on purpose: each one is a different
 * person and the row opens *that* person, so collapsing them would take the
 * destination away. The badge, the pool and the visit round-up are already one
 * per badge or per day.
 */
const GROUPED_KINDS: InAppNotificationKind[] = [
  'postComment',
  'postCorrection',
  'pronunciationAnswer',
  'like',
]

/**
 * One key per collapsible pile, and the row's own id for everything else —
 * which makes a non-grouped kind a group of one and keeps the pipeline below
 * free of special cases.
 */
const GROUP_KEY = {
  $cond: [
    { $and: [{ $in: ['$kind', GROUPED_KINDS] }, { $ne: [{ $type: '$postId' }, 'missing'] }] },
    { $concat: ['$kind', ':', { $toString: '$postId' }] },
    { $toString: '$_id' },
  ],
}

interface GroupedRow {
  _id: string
  /** The newest member: what the row renders, and where the cursor points. */
  latest: NotificationDoc
  total: number
  unread: number
}

/**
 * The inbox, newest first.
 *
 * Shaped like `listLikers`, including the part that matters most: a row whose
 * actor or post has gone is **dropped**, not rendered as "Deleted account".
 * A feed post outlives its author because the sentence is the point; a line
 * saying somebody followed you is only the somebody.
 *
 * `nextCursor` therefore comes from the last *raw* row rather than the last
 * rendered one. Cursoring from the rendered one would ask for everything older
 * than a row that survived, replaying the dropped rows above it forever.
 */
export async function listNotifications(
  db: Db,
  userId: string,
  query: ListNotificationsQuery,
): Promise<NotificationsPage> {
  const hidden = await blockedUserIds(db, userId)

  const filter: Document = { userId }
  if (hidden.length > 0) filter.actorId = { $nin: hidden }

  const after: Document[] = []
  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    // Applied **after** the grouping, because the thing being paged is a
    // group and its position is its newest member's.
    after.push({
      $match: {
        $or: [
          { 'latest.createdAt': { $lt: date } },
          { 'latest.createdAt': date, 'latest._id': { $lt: id } },
        ],
      },
    })
  }

  const groups = await db
    .collection<NotificationDoc>(COLLECTIONS.notifications)
    .aggregate<GroupedRow>([
      { $match: filter },
      // Index-backed, and the reason `$first` below is the newest member.
      { $sort: { createdAt: -1, _id: -1 } },
      { $addFields: { groupKey: GROUP_KEY } },
      {
        $group: {
          _id: '$groupKey',
          latest: { $first: '$$ROOT' },
          total: { $sum: 1 },
          // A group is unread if anything in it is. Absent means unread, so
          // this counts the rows with no `readAt` rather than comparing one.
          unread: {
            $sum: { $cond: [{ $eq: [{ $type: '$readAt' }, 'missing'] }, 1, 0] },
          },
        },
      },
      { $sort: { 'latest.createdAt': -1, 'latest._id': -1 } },
      ...after,
      { $limit: query.limit + 1 },
    ])
    .toArray()

  const hasMore = groups.length > query.limit
  const kept = hasMore ? groups.slice(0, query.limit) : groups
  const rows = kept.map((group) => group.latest)
  const last = rows.at(-1)
  const extraByRow = new Map(
    kept.map((group) => [
      group.latest._id.toHexString(),
      { others: group.total - 1, unread: group.unread },
    ]),
  )

  const actorIds = [...new Set(rows.flatMap((row) => (row.actorId ? [row.actorId] : [])))]
  const postIds = [
    ...new Set(rows.flatMap((row) => (row.postId ? [row.postId.toHexString()] : []))),
  ]

  // Two queries for the whole page rather than two per row. The post lookup
  // has to happen anyway to drop rows whose post is gone, so the excerpt the
  // row renders costs one more field in a projection and nothing else.
  const [profiles, posts] = await Promise.all([
    actorIds.length > 0
      ? db
          .collection<Profile>(COLLECTIONS.profiles)
          .find(
            { _id: { $in: actorIds }, deletedAt: { $exists: false } },
            { projection: { handle: 1, displayName: 1, avatarUrl: 1 } },
          )
          .toArray()
      : [],
    postIds.length > 0
      ? db
          .collection<Post>(COLLECTIONS.posts)
          .find(
            { _id: { $in: postIds.map((id) => new ObjectId(id)) } },
            { projection: { body: 1 } },
          )
          .toArray()
      : [],
  ])
  const byId = new Map(profiles.map((profile) => [profile._id, profile]))
  const postById = new Map(posts.map((post) => [post._id.toHexString(), post]))

  const items = rows.flatMap((row): InAppNotification[] => {
    const extra = extraByRow.get(row._id.toHexString())
    const actor = row.actorId ? byId.get(row.actorId) : undefined
    if (row.actorId && !actor) return []

    const post = row.postId ? postById.get(row.postId.toHexString()) : undefined
    if (row.postId && !post) return []

    return [
      {
        _id: row._id.toHexString(),
        kind: row.kind,
        ...(actor
          ? {
              actor: {
                _id: actor._id,
                handle: actor.handle,
                displayName: actor.displayName,
                ...(actor.avatarUrl ? { avatarUrl: actor.avatarUrl } : {}),
              },
            }
          : {}),
        ...(row.postId ? { postId: row.postId.toHexString() } : {}),
        ...(post?.body ? { preview: post.body.slice(0, PREVIEW_LENGTH) } : {}),
        /*
         * Two different numbers behind one field, and the kind says which.
         * On a collapsed pile it is how many *other* people did the thing —
         * the sentence already names the first — and on a visit round-up or a
         * pool payout it is the count the row was written with.
         */
        ...(extra && extra.others > 0
          ? { count: extra.others }
          : row.count !== undefined
            ? { count: row.count }
            : {}),
        ...(row.badgeId ? { badgeId: row.badgeId } : {}),
        read: extra ? extra.unread === 0 : row.readAt !== undefined,
        createdAt: row.createdAt.toISOString(),
      },
    ]
  })

  return {
    items,
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}

/**
 * The number on the bell — and it counts **rows of the list**, not documents.
 *
 * Ten unread comments on one post are one row, so a raw `countDocuments` would
 * put 10 on the badge over a list with one thing in it. A badge that disagrees
 * with the screen it leads to is worse than no badge: it sends somebody
 * looking for nine things that were never there.
 *
 * So it groups the same way the list does, and filters blocked people the same
 * way, and matches the unread rows *before* grouping — which is both correct
 * (a group is unread if anything in it is) and cheaper than grouping
 * everything and then asking.
 *
 * Capped, because past a point the answer stops being a number and starts
 * being "lots": `unreadBadge` draws `99+` anyway.
 */
export async function countUnreadNotifications(db: Db, userId: string): Promise<number> {
  const hidden = await blockedUserIds(db, userId)
  const match: Document = { userId, readAt: { $exists: false } }
  if (hidden.length > 0) match.actorId = { $nin: hidden }

  const rows = await db
    .collection<NotificationDoc>(COLLECTIONS.notifications)
    .aggregate<{ _id: string }>([
      { $match: match },
      { $addFields: { groupKey: GROUP_KEY } },
      { $group: { _id: '$groupKey' } },
      { $limit: UNREAD_COUNT_CAP },
    ])
    .toArray()
  return rows.length
}

/**
 * "I have looked at the inbox."
 *
 * Everything unread, not a row at a time: the bell counts them all, so the
 * only honest thing a reader can say by opening it is that they have seen the
 * lot. Returns the stamp it wrote, so the client can patch its cache rather
 * than refetch a list it is currently looking at.
 */
export async function markNotificationsRead(
  db: Db,
  userId: string,
  /**
   * One row's id to read just that one, or nothing for the lot.
   *
   * "That one" means the whole pile behind it, not the single document: the
   * row on screen says nine other people commented too, and marking it read
   * while leaving eight of its members unread would put the badge back up for
   * something the reader has demonstrably just looked at.
   */
  only?: ObjectId,
  now: Date = new Date(),
): Promise<{ readAt: string; read: number }> {
  const rows = db.collection<NotificationDoc>(COLLECTIONS.notifications)
  const filter: Document = { userId, readAt: { $exists: false } }

  if (only) {
    // Scoped by `userId` as well as `_id`, so an id belonging to somebody else
    // matches nothing rather than reading their inbox for them.
    const row = await rows.findOne({ _id: only, userId })
    if (!row) return { readAt: now.toISOString(), read: 0 }
    filter.kind = row.kind
    // The same rule `GROUP_KEY` applies, spelled out: a kind that collapses is
    // marked across its post, and one that does not is marked on its own.
    if (GROUPED_KINDS.includes(row.kind) && row.postId) filter.postId = row.postId
    else filter._id = row._id
  }

  const result = await rows.updateMany(filter, { $set: { readAt: now } })
  return { readAt: now.toISOString(), read: result.modifiedCount }
}

/** Guards a `kind` that came off the wire or out of an older row. */
export function isInAppNotificationKind(value: string): value is InAppNotificationKind {
  return (IN_APP_NOTIFICATION_KINDS as readonly string[]).includes(value)
}

/**
 * Which likeable thing lives where, and where its likes should land a tap.
 *
 * The third column is why this is a table rather than three ifs: a like on a
 * *correction* is news to whoever wrote the correction, but the screen that
 * shows it is the post being corrected — so the row deep-links to the parent.
 * `runLikesRoundUpPass` does the same thing with the same `postId ?? _id`.
 */
const LIKE_TARGETS = {
  post: COLLECTIONS.posts,
  correction: COLLECTIONS.postCorrections,
  answer: COLLECTIONS.pronunciationAnswers,
} as const

interface LikeableRow {
  _id: ObjectId
  authorId: string
  postId?: ObjectId
}

/**
 * Who wrote the thing that was just liked, and which post shows it.
 *
 * Its own lookup rather than a wider return from `resolveTarget`: that
 * function belongs to the feed and answers "may this person like this", and
 * widening it so a notification can read a field would put this module's
 * concern inside it. One indexed `_id` read is the cheaper mistake.
 */
export async function likeTargetOwner(
  db: Db,
  targetType: keyof typeof LIKE_TARGETS,
  targetId: ObjectId,
): Promise<{ authorId: string; postId: ObjectId } | null> {
  const row = await db
    .collection<LikeableRow>(LIKE_TARGETS[targetType])
    .findOne({ _id: targetId }, { projection: { authorId: 1, postId: 1 } })
  if (!row) return null
  return { authorId: row.authorId, postId: row.postId ?? row._id }
}
