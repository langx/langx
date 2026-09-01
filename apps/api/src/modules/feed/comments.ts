import {
  ERROR_CODES,
  type CreatePostCommentInput,
  type ListPostCommentsQuery,
  type PostComment,
  type PostCommentsPage,
} from '@langx/shared'
import { ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { blockedUserIds } from '../moderation/blocks'
import type { Post, PostCommentDoc } from './documents'
import { commentDto, loadAuthors } from './dto'

/**
 * How many comments each of these posts has.
 *
 * Counted rather than stored, unlike `correctionCount`. A denormalized counter
 * is worth its drift risk when it is a **sort key** — an index cannot sort on a
 * number it would have to join to find — and nothing sorts by comments. Nothing
 * may start, either, for the reason likes may not: the feed is a correction
 * queue, and the day it ranks by chatter it stops being one.
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
      { $match: { postId: { $in: ids } } },
      { $group: { _id: '$postId', count: { $sum: 1 } } },
    ])
    .toArray()

  return new Map(rows.map((row) => [row._id.toHexString(), row.count]))
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
 */
export async function addComment(
  db: Db,
  userId: string,
  postId: string,
  input: CreatePostCommentInput,
): Promise<PostComment> {
  if (!ObjectId.isValid(postId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  const _id = new ObjectId(postId)

  const [post, hidden] = await Promise.all([
    db.collection<Post>(COLLECTIONS.posts).findOne({ _id }),
    blockedUserIds(db, userId),
  ])
  if (!post) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  // 404 rather than 403: a blocked account is absent, and a 403 confirms it.
  if (hidden.includes(post.authorId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')

  const doc: PostCommentDoc = {
    _id: new ObjectId(),
    postId: _id,
    authorId: userId,
    body: input.body,
    createdAt: new Date(),
  }
  await db.collection<PostCommentDoc>(COLLECTIONS.postComments).insertOne(doc)

  const authors = await loadAuthors(db, [userId])
  return commentDto(doc, authors)
}

/**
 * A post's comments, oldest first — the order a conversation reads in, and the
 * same one the corrections list uses.
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
  if (!ObjectId.isValid(postId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  const _id = new ObjectId(postId)

  const [post, hidden] = await Promise.all([
    db.collection<Post>(COLLECTIONS.posts).findOne({ _id }),
    blockedUserIds(db, userId),
  ])
  if (!post) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  if (hidden.includes(post.authorId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')

  const filter: Document = { postId: _id }
  if (hidden.length > 0) filter.authorId = { $nin: hidden }
  if (query.cursor) {
    // Ascending, so the page boundary is "after this one" — the mirror of the
    // feed's descending keyset, on `post_created_id`.
    const { date, id } = decodeDateIdCursor(query.cursor)
    filter.$or = [{ createdAt: { $gt: date } }, { createdAt: date, _id: { $gt: id } }]
  }

  const page = await db
    .collection<PostCommentDoc>(COLLECTIONS.postComments)
    .find(filter)
    .sort({ createdAt: 1, _id: 1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const items = hasMore ? page.slice(0, query.limit) : page
  const last = items.at(-1)

  const authors = await loadAuthors(
    db,
    items.map((doc) => doc.authorId),
  )

  return {
    items: items.map((doc) => commentDto(doc, authors)),
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}

/**
 * Delete a comment you wrote.
 *
 * The simplest delete in the feed, and deliberately so: a comment has no
 * attachment to sweep out of the bucket, no likes to cascade, no token to
 * unpick, and no counter to decrement — `commentCount` is counted at read time,
 * so it corrects itself.
 *
 * Ownership is in the filter, not in an `if` above it: two devices pressing
 * delete at once both pass a read-then-decide, and `deletedCount` is what tells
 * the second one it lost.
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
  const deleted = await db.collection<PostCommentDoc>(COLLECTIONS.postComments).deleteOne({
    _id: new ObjectId(commentId),
    postId: new ObjectId(postId),
    authorId: userId,
  })
  // 404 rather than 403 for somebody else's comment: a 403 confirms it exists.
  if (deleted.deletedCount === 0) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Comment not found')
}
