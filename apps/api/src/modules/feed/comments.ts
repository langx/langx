import {
  COMMENT_REPLY_PREVIEW,
  ERROR_CODES,
  type CreatePostCommentInput,
  type ListCommentRepliesQuery,
  type ListPostCommentsQuery,
  type PostComment,
  type PostCommentsPage,
} from '@langx/shared'
import { ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { blockedUserIds } from '../moderation/blocks'
import { notHidden } from './documents'
import type { Post, PostCommentDoc } from './documents'
import { commentDto, loadAuthors } from './dto'

/**
 * A comment anybody may still read: not hidden by a moderator, and not a
 * tombstone its author left behind. The same `$exists: false` shape as
 * `notHidden()`, for the same reason — a missing field is every comment there
 * has ever been, and it has to pass.
 */
function liveComment(): Document {
  return { hiddenAt: { $exists: false }, deletedAt: { $exists: false } }
}

/**
 * A thread's first comment, and a reply. `null` matches the field missing,
 * which is every comment written before replies existed; typed as plain
 * documents because the driver's filter types have no word for "absent or
 * null" on an optional field.
 */
const IS_ROOT: Document = { parentId: null }
const IS_REPLY: Document = { parentId: { $ne: null } }

/** The roots a `distinct('parentId')` found — never `undefined`, since it only ever reads replies. */
function rootIdsOf(values: (ObjectId | undefined)[]): ObjectId[] {
  return values.flatMap((id) => (id ? [id] : []))
}

/**
 * How many comments each of these posts has.
 *
 * Counted rather than stored, unlike `correctionCount`. A denormalized counter
 * is worth its drift risk when it is a **sort key** — an index cannot sort on a
 * number it would have to join to find — and nothing sorts by comments. Nothing
 * may start, either, for the reason likes may not: the feed is a correction
 * queue, and the day it ranks by chatter it stops being one.
 *
 * Replies count — each is a comment somebody wrote on the post. Tombstones and
 * hidden rows do not: neither has words anybody can read, and a count the list
 * under it cannot add up to reads as a bug.
 *
 * Shaped like `readLikeSummary`: `$group` after an index-backed `$match`
 * returns one row per post, so what crosses the wire is O(posts) rather than
 * O(comments).
 *
 * Deliberately not block-filtered, for the same reason the like counts are not:
 * a page-wide aggregate would become viewer-dependent to hide a number nobody
 * can attribute to anyone. The *list* is filtered, which is where a blocked
 * person would actually be visible.
 */
export async function readCommentSummary(db: Db, ids: ObjectId[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()

  const rows = await db
    .collection<PostCommentDoc>(COLLECTIONS.postComments)
    .aggregate<{ _id: ObjectId; count: number }>([
      { $match: { postId: { $in: ids }, ...liveComment() } },
      { $group: { _id: '$postId', count: { $sum: 1 } } },
    ])
    .toArray()

  return new Map(rows.map((row) => [row._id.toHexString(), row.count]))
}

/**
 * The post a comment read or write is about, with the viewer's blocks — both
 * reads every function here starts with, in parallel.
 *
 * 404 rather than 403 for a blocked author: a blocked account is absent, and a
 * 403 confirms it.
 */
async function openPost(db: Db, userId: string, postId: string) {
  if (!ObjectId.isValid(postId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  const _id = new ObjectId(postId)

  const [post, hidden] = await Promise.all([
    db.collection<Post>(COLLECTIONS.posts).findOne({ _id, ...notHidden() }),
    blockedUserIds(db, userId),
  ])
  if (!post) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  if (hidden.includes(post.authorId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  return { post, hidden }
}

/**
 * Who a new reply is news to, worked out while the thread was already open.
 *
 * `rootAuthorId` is `null` when the thread's first comment is removed — its
 * author took it back, or a moderator did, and neither is an invitation to be
 * pinged about the conversation it left behind. `replyToAuthorId` is set only
 * on a reply to a reply. Neither is ever somebody the replier has blocked or
 * been blocked by.
 */
export interface CommentThreadNews {
  rootId: ObjectId
  rootAuthorId: string | null
  replyToAuthorId: string | null
}

/**
 * A comment pays nothing.
 *
 * No `awardTokens`, no `dailyActivity` counter, no streak advance — the same
 * ruling as a like, and for a stronger reason. A like is one tap; a comment is
 * one sentence, which is barely more, and unlike a correction there is nothing
 * in its shape that makes it teaching. Anything that pays out for a sentence
 * two accounts can trade all day is a farm, and the streak's condition is a
 * documented product rule rather than a detail of this module.
 *
 * Commenting on your **own** post is allowed, unlike correcting it. Correcting
 * your own sentence would have paid you for it; replying in your own thread is
 * ordinary, and pays nothing to abuse.
 *
 * **A reply** names any comment on the same post as its `parentId`, and is
 * filed under that comment's thread root — one read, and the reason there is
 * never a second level. The parent must be readable to the replier: on this
 * post, not hidden, not by somebody on either side of a block. A tombstoned
 * root still takes replies, so a thread does not die with its first comment.
 */
export async function addComment(
  db: Db,
  userId: string,
  postId: string,
  input: CreatePostCommentInput,
): Promise<{ comment: PostComment; thread: CommentThreadNews | null }> {
  const { post, hidden } = await openPost(db, userId, postId)
  const comments = db.collection<PostCommentDoc>(COLLECTIONS.postComments)

  let thread: CommentThreadNews | null = null
  if (input.parentId !== undefined) {
    if (!ObjectId.isValid(input.parentId)) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Comment not found')
    }
    const parent = await comments.findOne({
      _id: new ObjectId(input.parentId),
      postId: post._id,
      hiddenAt: { $exists: false },
    })
    if (!parent || hidden.includes(parent.authorId)) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Comment not found')
    }

    if (parent.parentId) {
      // A reply to a reply: the same thread, answering its author. The root
      // is read for its author's sake only, and a root gone missing (a purge
      // racing this) still leaves a reply worth keeping.
      const root = await comments.findOne(
        { _id: parent.parentId },
        { projection: { authorId: 1, deletedAt: 1, hiddenAt: 1 } },
      )
      thread = {
        rootId: parent.parentId,
        rootAuthorId: root && !root.deletedAt && !root.hiddenAt ? root.authorId : null,
        replyToAuthorId: parent.authorId,
      }
    } else {
      thread = {
        rootId: parent._id,
        rootAuthorId: parent.deletedAt ? null : parent.authorId,
        replyToAuthorId: null,
      }
    }
    if (thread.rootAuthorId && hidden.includes(thread.rootAuthorId)) thread.rootAuthorId = null
  }

  const doc: PostCommentDoc = {
    _id: new ObjectId(),
    postId: post._id,
    authorId: userId,
    body: input.body,
    createdAt: new Date(),
    ...(thread ? { parentId: thread.rootId } : {}),
    ...(thread?.replyToAuthorId ? { replyToAuthorId: thread.replyToAuthorId } : {}),
  }
  await comments.insertOne(doc)

  const authors = await loadAuthors(db, [
    userId,
    ...(doc.replyToAuthorId ? [doc.replyToAuthorId] : []),
  ])
  return { comment: commentDto(doc, authors), thread }
}

/** "After this one", for the ascending keyset every list here pages on. */
function afterCursor(cursor: string | undefined): Document {
  if (!cursor) return {}
  const { date, id } = decodeDateIdCursor(cursor)
  return { $or: [{ createdAt: { $gt: date } }, { createdAt: date, _id: { $gt: id } }] }
}

/**
 * A post's comments, oldest first — the order a conversation reads in, and the
 * same one the corrections list uses.
 *
 * Two shapes, chosen by `threaded`:
 *
 * - **Flat**, the default, is the list installed builds were written against:
 *   every readable comment, replies included, on `post_created_id`. A reply
 *   carries `parentId` and `replyTo`, which those builds ignore, so they see a
 *   conversation that is merely unindented. Tombstones are left out — for an
 *   old build a removed comment has always simply gone.
 * - **Threaded** is the first comments only, each with its `replyCount` and
 *   first `COMMENT_REPLY_PREVIEW` replies. A removed root stays, drawn as
 *   removed, while it has a reply this viewer can read; without one it is
 *   dropped, and the page comes back a row short rather than a row wrong.
 *
 * No `post` echo in the page, unlike `listPostCorrections`. Comments are never
 * the first thing a screen loads: you are already looking at the post, so the
 * round trip that page saves does not exist to save here.
 */
export async function listPostComments(
  db: Db,
  userId: string,
  postId: string,
  query: ListPostCommentsQuery,
): Promise<PostCommentsPage> {
  const { post, hidden } = await openPost(db, userId, postId)
  const comments = db.collection<PostCommentDoc>(COLLECTIONS.postComments)
  const notBlocked: Document = hidden.length > 0 ? { authorId: { $nin: hidden } } : {}

  if (!query.threaded) {
    const page = await comments
      .find({ postId: post._id, ...liveComment(), ...notBlocked, ...afterCursor(query.cursor) })
      .sort({ createdAt: 1, _id: 1 })
      .limit(query.limit + 1)
      .toArray()

    const hasMore = page.length > query.limit
    const items = hasMore ? page.slice(0, query.limit) : page
    const last = items.at(-1)
    const authors = await loadAuthors(db, items.flatMap(peopleOn))
    return {
      items: items.map((doc) => commentDto(doc, authors)),
      nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
    }
  }

  // Removed roots are read too, and judged after their replies are counted.
  const page = await comments
    .find({ postId: post._id, ...IS_ROOT, ...notBlocked, ...afterCursor(query.cursor) })
    .sort({ createdAt: 1, _id: 1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const roots = hasMore ? page.slice(0, query.limit) : page
  // The cursor is the last row *read*, not the last one kept, so a dropped
  // tombstone at the end of a page is not read again on the next.
  const last = roots.at(-1)

  const threads = await readReplyPreview(
    db,
    post._id,
    roots.map((root) => root._id),
    notBlocked,
  )
  const kept = roots.filter((root) => {
    const removed = Boolean(root.deletedAt || root.hiddenAt)
    return !removed || (threads.get(root._id.toHexString())?.count ?? 0) > 0
  })

  const authors = await loadAuthors(db, [
    ...kept.flatMap(peopleOn),
    ...[...threads.values()].flatMap((thread) => thread.replies.flatMap(peopleOn)),
  ])

  return {
    items: kept.map((root) => {
      const thread = threads.get(root._id.toHexString())
      return {
        ...commentDto(root, authors, Boolean(root.deletedAt || root.hiddenAt)),
        replyCount: thread?.count ?? 0,
        replies: (thread?.replies ?? []).map((reply) => commentDto(reply, authors)),
      }
    }),
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}

/** Everybody a comment's row names: its author, and whom it answers. */
function peopleOn(doc: PostCommentDoc): string[] {
  return doc.replyToAuthorId ? [doc.authorId, doc.replyToAuthorId] : [doc.authorId]
}

/**
 * Each thread's reply count and first replies, for a page of roots, in one
 * aggregate — shaped like `readCorrectionSummary`, and like it bounded by an
 * index (`post_parent_created_id`) whose order the `$sort` repeats.
 *
 * Filtered the way the list it feeds is, so the count is the number of rows
 * "View N more" would actually show this viewer.
 */
async function readReplyPreview(
  db: Db,
  postId: ObjectId,
  rootIds: ObjectId[],
  notBlocked: Document,
): Promise<Map<string, { count: number; replies: PostCommentDoc[] }>> {
  if (rootIds.length === 0) return new Map()
  const rows = await db
    .collection<PostCommentDoc>(COLLECTIONS.postComments)
    .aggregate<{ _id: ObjectId; count: number; replies: PostCommentDoc[] }>([
      { $match: { postId, parentId: { $in: rootIds }, ...liveComment(), ...notBlocked } },
      { $sort: { parentId: 1, createdAt: 1, _id: 1 } },
      { $group: { _id: '$parentId', count: { $sum: 1 }, replies: { $push: '$$ROOT' } } },
      { $project: { count: 1, replies: { $slice: ['$replies', COMMENT_REPLY_PREVIEW] } } },
    ])
    .toArray()
  return new Map(
    rows.map((row) => [row._id.toHexString(), { count: row.count, replies: row.replies }]),
  )
}

/**
 * One thread's replies, oldest first — what "View N more replies" opens.
 *
 * Any comment in the thread names it, the way `parentId` does on a write. The
 * root may be removed: its replies stay reachable, which is the reason a
 * tombstone exists at all. A root by somebody on either side of a block is a
 * 404, the same absence the post has.
 */
export async function listCommentReplies(
  db: Db,
  userId: string,
  postId: string,
  commentId: string,
  query: ListCommentRepliesQuery,
): Promise<PostCommentsPage> {
  const { post, hidden } = await openPost(db, userId, postId)
  if (!ObjectId.isValid(commentId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Comment not found')
  const comments = db.collection<PostCommentDoc>(COLLECTIONS.postComments)

  const named = await comments.findOne({ _id: new ObjectId(commentId), postId: post._id })
  const rootId = named?.parentId ?? named?._id
  const root = named?.parentId ? await comments.findOne({ _id: named.parentId }) : named
  if (!rootId || !root || hidden.includes(root.authorId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Comment not found')
  }

  const page = await comments
    .find({
      postId: post._id,
      parentId: rootId,
      ...liveComment(),
      ...(hidden.length > 0 ? { authorId: { $nin: hidden } } : {}),
      ...afterCursor(query.cursor),
    })
    .sort({ createdAt: 1, _id: 1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const items = hasMore ? page.slice(0, query.limit) : page
  const last = items.at(-1)
  const authors = await loadAuthors(db, items.flatMap(peopleOn))
  return {
    items: items.map((doc) => commentDto(doc, authors)),
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}

/**
 * Delete a comment you wrote.
 *
 * Still the simplest delete in the feed — no attachment to sweep, no likes to
 * cascade, no token to unpick, no counter to decrement, since `commentCount` is
 * counted at read time — with one exception replies brought:
 *
 * - **A thread's first comment with replies** becomes a tombstone: the words
 *   are unset, the row stays, and the thread reads on under "Comment removed".
 *   Deleting it outright would leave every reply answering nothing.
 * - **Anything else** is deleted, as before. And when that was the last reply
 *   under a tombstone, the tombstone goes too — it was only kept for them.
 *
 * Ownership is in the filter, not in an `if` above it: two devices pressing
 * delete at once both pass a read-then-decide, and the write's own count is
 * what tells the second one it lost.
 */
export async function deleteComment(
  db: Db,
  userId: string,
  postId: string,
  commentId: string,
): Promise<void> {
  if (!ObjectId.isValid(postId) || !ObjectId.isValid(commentId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Comment not found')
  }
  const comments = db.collection<PostCommentDoc>(COLLECTIONS.postComments)
  const mine = {
    _id: new ObjectId(commentId),
    postId: new ObjectId(postId),
    authorId: userId,
    // A tombstone is already deleted, as far as its author can tell.
    deletedAt: { $exists: false },
  }

  const doc = await comments.findOne(mine, { projection: { postId: 1, parentId: 1 } })
  // 404 rather than 403 for somebody else's comment: a 403 confirms it exists.
  if (!doc) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Comment not found')

  // `postId` beside `parentId` in every thread read here, so each one is a
  // range on `post_parent_created_id` rather than a scan of every comment.
  const answered =
    !doc.parentId &&
    (await comments.countDocuments({ postId: doc.postId, parentId: doc._id }, { limit: 1 })) > 0
  if (answered) {
    const result = await comments.updateOne(mine, {
      $set: { deletedAt: new Date() },
      $unset: { body: '' },
    })
    if (result.modifiedCount === 0) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Comment not found')
    return
  }

  const deleted = await comments.deleteOne(mine)
  if (deleted.deletedCount === 0) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Comment not found')
  if (doc.parentId) await sweepEmptyTombstones(db, [{ postId: doc.postId, rootId: doc.parentId }])
}

/**
 * Remove the tombstones among these roots that no reply hangs from any more.
 *
 * Hidden replies count as hanging: a moderator can show one again, and it
 * should come back under the thread it was written in.
 */
async function sweepEmptyTombstones(
  db: Db,
  threads: { postId: ObjectId; rootId: ObjectId }[],
): Promise<void> {
  if (threads.length === 0) return
  const comments = db.collection<PostCommentDoc>(COLLECTIONS.postComments)
  const rootIds = threads.map((thread) => thread.rootId)
  const stillAnswered = new Set(
    rootIdsOf(
      await comments.distinct('parentId', {
        postId: { $in: threads.map((thread) => thread.postId) },
        parentId: { $in: rootIds },
      }),
    ).map((id) => id.toHexString()),
  )
  const empty = rootIds.filter((id) => !stillAnswered.has(id.toHexString()))
  if (empty.length === 0) return
  await comments.deleteMany({ _id: { $in: empty }, deletedAt: { $exists: true } })
}

/**
 * Every comment an account wrote, at its purge.
 *
 * Comments used to go with the account wholesale — chatter nobody's thread
 * depended on. Replies made that untrue for one case: a thread's first comment
 * other people answered. That one is tombstoned, exactly as its author's own
 * delete would have done, and everything else goes. The tombstone keeps the
 * purged id as its author, which renders as "Deleted account" like every other
 * row that outlives its writer.
 *
 * Replies go first, so a thread that only this account answered is not kept
 * alive by answers about to disappear; and a tombstone somebody else left,
 * which only this account's replies were holding up, is swept after.
 */
export async function purgeCommentsBy(db: Db, userId: string): Promise<void> {
  const comments = db.collection<PostCommentDoc>(COLLECTIONS.postComments)

  // Both reads name the author, so both ride `author_recent`.
  const answered = await comments
    .find({ authorId: userId, ...IS_REPLY }, { projection: { postId: 1, parentId: 1 } })
    .toArray()
  await comments.deleteMany({ authorId: userId, ...IS_REPLY })

  const roots = await comments.find({ authorId: userId }, { projection: { postId: 1 } }).toArray()
  const withReplies =
    roots.length > 0
      ? rootIdsOf(
          await comments.distinct('parentId', {
            postId: { $in: roots.map((root) => root.postId) },
            parentId: { $in: roots.map((root) => root._id) },
          }),
        )
      : []
  if (withReplies.length > 0) {
    await comments.updateMany(
      { _id: { $in: withReplies } },
      { $set: { deletedAt: new Date() }, $unset: { body: '' } },
    )
  }
  await comments.deleteMany({ authorId: userId, _id: { $nin: withReplies } })

  await sweepEmptyTombstones(
    db,
    answered.flatMap((row) => (row.parentId ? [{ postId: row.postId, rootId: row.parentId }] : [])),
  )
}

/**
 * Hide or show a comment, from a report. Answers the comment as it was before
 * the write, or `null` when there is no such comment — the same contract as
 * `setPostHidden`, so the review decision reads the two alike.
 *
 * Read unfiltered on purpose: the moderator has to find a comment they have
 * already hidden to show it again.
 */
export async function setCommentHidden(
  db: Db,
  commentId: ObjectId,
  hidden: boolean,
): Promise<PostCommentDoc | null> {
  return db
    .collection<PostCommentDoc>(COLLECTIONS.postComments)
    .findOneAndUpdate(
      { _id: commentId },
      hidden ? { $set: { hiddenAt: new Date() } } : { $unset: { hiddenAt: '' } },
      { returnDocument: 'before' },
    )
}
