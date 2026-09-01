import {
  ERROR_CODES,
  type LikeState,
  type LikeTarget,
  type LikeTargetType,
  type LikersPage,
  type ListLikersQuery,
} from '@langx/shared'
import { ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { blockedUserIds } from '../moderation/blocks'
import type { Profile } from '../profiles/profiles'
import type { Post, PostCorrectionDoc, PronunciationAnswerDoc } from './documents'

export interface Like {
  _id: ObjectId
  targetType: LikeTargetType
  targetId: ObjectId
  userId: string
  createdAt: Date
}

/** `${targetType}:${hex}` — one map key for two id spaces that can collide. */
function key(targetType: LikeTargetType, targetId: ObjectId | string): string {
  return `${targetType}:${typeof targetId === 'string' ? targetId : targetId.toHexString()}`
}

export interface LikeSummary {
  counts: Map<string, number>
  liked: Set<string>
}

export const EMPTY_LIKE_SUMMARY: LikeSummary = { counts: new Map(), liked: new Set() }

export function likeStateOf(
  summary: LikeSummary,
  targetType: LikeTargetType,
  targetId: ObjectId | string,
): LikeState {
  const k = key(targetType, targetId)
  return { likeCount: summary.counts.get(k) ?? 0, likedByViewer: summary.liked.has(k) }
}

/**
 * Like counts and the viewer's own likes for a whole page, in two queries.
 *
 * Shaped like `readCorrectionSummary`, and for the same reason. The obvious
 * version asks per card and is an N+1 over a list. `$group` after an
 * index-backed `$match` returns one row per liked target, so what crosses the
 * wire is O(distinct targets) rather than O(likes) — a post with four hundred
 * likes costs the same single row as one with two. The viewer lookup is a
 * separate targeted query on `target_user_unique` rather than a second pass
 * over the same documents: that index is unique, so it reads at most one row
 * per target by definition.
 *
 * All three target lists are **required**, empty array and all. An optional one
 * would let a new call site quietly stop counting a whole kind of like, and the
 * only symptom would be a zero that looks like nobody had liked it.
 *
 * Deliberately **not** block-filtered. Filtering the count would make a
 * page-wide aggregate viewer-dependent to hide a number nobody can attribute;
 * the likers *list* is filtered, which is where a blocked person would actually
 * be visible. See the note on `listLikers`.
 */
export async function readLikeSummary(
  db: Db,
  userId: string,
  targets: { postIds: ObjectId[]; correctionIds: ObjectId[]; answerIds: ObjectId[] },
): Promise<LikeSummary> {
  const clauses: Document[] = []
  if (targets.postIds.length > 0) {
    clauses.push({ targetType: 'post', targetId: { $in: targets.postIds } })
  }
  if (targets.correctionIds.length > 0) {
    clauses.push({ targetType: 'correction', targetId: { $in: targets.correctionIds } })
  }
  if (targets.answerIds.length > 0) {
    clauses.push({ targetType: 'answer', targetId: { $in: targets.answerIds } })
  }
  if (clauses.length === 0) return EMPTY_LIKE_SUMMARY

  const match = clauses.length === 1 ? clauses[0]! : { $or: clauses }
  const likes = db.collection<Like>(COLLECTIONS.likes)

  const [totals, mine] = await Promise.all([
    likes
      .aggregate<{ _id: { targetType: LikeTargetType; targetId: ObjectId }; count: number }>([
        { $match: match },
        {
          $group: { _id: { targetType: '$targetType', targetId: '$targetId' }, count: { $sum: 1 } },
        },
      ])
      .toArray(),
    likes
      .find({ ...match, userId })
      .project<{ targetType: LikeTargetType; targetId: ObjectId }>({ targetType: 1, targetId: 1 })
      .toArray(),
  ])

  return {
    counts: new Map(totals.map((row) => [key(row._id.targetType, row._id.targetId), row.count])),
    liked: new Set(mine.map((row) => key(row.targetType, row.targetId))),
  }
}

/**
 * Resolve a like target and decide whether the viewer may see it at all.
 *
 * The block check is the step an obvious implementation skips, and without it a
 * feed page that has gone stale is a working "like a blocked person's post"
 * button. A correction is checked against its parent post's author too: a
 * correction is only ever read inside a post, so blocking the post's author
 * should make the whole thread absent rather than leaving its replies likeable.
 * A recorded answer is checked the same way, for the same reason.
 *
 * `NOT_FOUND` rather than `FORBIDDEN` throughout, for the reason the profile
 * route gives: a 403 would confirm that the thing exists.
 */
async function resolveTarget(
  db: Db,
  userId: string,
  target: LikeTarget,
): Promise<{ _id: ObjectId; targetType: LikeTargetType }> {
  if (!ObjectId.isValid(target.targetId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Nothing to like')
  }
  const _id = new ObjectId(target.targetId)
  const hidden = await blockedUserIds(db, userId)

  if (target.targetType === 'post') {
    const post = await db.collection<Post>(COLLECTIONS.posts).findOne({ _id })
    if (!post || hidden.includes(post.authorId)) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Nothing to like')
    }
    if (post.authorId === userId) {
      throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You cannot like your own post')
    }
    return { _id, targetType: 'post' }
  }

  if (target.targetType === 'answer') {
    const answer = await db
      .collection<PronunciationAnswerDoc>(COLLECTIONS.pronunciationAnswers)
      .findOne({ _id })
    if (!answer || hidden.includes(answer.authorId)) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Nothing to like')
    }
    if (answer.authorId === userId) {
      throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You cannot like your own answer')
    }
    const parent = await db.collection<Post>(COLLECTIONS.posts).findOne({ _id: answer.postId })
    if (!parent || hidden.includes(parent.authorId)) {
      throw new ApiError(ERROR_CODES.NOT_FOUND, 'Nothing to like')
    }
    return { _id, targetType: 'answer' }
  }

  const correction = await db
    .collection<PostCorrectionDoc>(COLLECTIONS.postCorrections)
    .findOne({ _id })
  if (!correction || hidden.includes(correction.authorId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Nothing to like')
  }
  if (correction.authorId === userId) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You cannot like your own correction')
  }
  const post = await db.collection<Post>(COLLECTIONS.posts).findOne({ _id: correction.postId })
  if (!post || hidden.includes(post.authorId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Nothing to like')
  }
  return { _id, targetType: 'correction' }
}

/**
 * Set liked. Idempotent, and that is the whole reason this is a `PUT` and not a
 * toggle.
 *
 * `reactToMessage` toggles — re-tapping the same emoji clears it — and copying
 * that here would be a bug. It reaches the server over a socket, where
 * `emitWithAck` gives the client a definite answer or a definite failure. Over
 * HTTP a request whose *response* is lost is retried, and a retried toggle
 * silently undoes the like the first attempt already applied. That is the same
 * class of failure the ledger's `user_kind_ref_unique` index exists to make
 * impossible.
 *
 * **A like pays nothing.** No `awardTokens`, no `dailyActivity` counter, no
 * streak advance. A like costs one tap, and anything that pays out for one tap
 * is a farm — worse than a reaction, because two accounts liking each other is
 * a *reciprocal* farm, which is the exact shape the reciprocity bonus was
 * designed against. The streak's condition is a documented product rule
 * ("send a message or write a correction"); a third qualifying action rewrites
 * `docs/architecture.md`, not just this file.
 */
export async function likeTarget(db: Db, userId: string, target: LikeTarget): Promise<LikeState> {
  const { _id, targetType } = await resolveTarget(db, userId, target)
  try {
    await db.collection<Like>(COLLECTIONS.likes).insertOne({
      _id: new ObjectId(),
      targetType,
      targetId: _id,
      userId,
      createdAt: new Date(),
    })
  } catch (error) {
    // The unique index is the guard, and a duplicate is not an error here: it
    // is the answer "already liked".
    if (!isDuplicate(error)) throw error
  }
  return readState(db, userId, targetType, _id)
}

/** Clear liked. Idempotent by construction. */
export async function unlikeTarget(db: Db, userId: string, target: LikeTarget): Promise<LikeState> {
  const { _id, targetType } = await resolveTarget(db, userId, target)
  await db.collection<Like>(COLLECTIONS.likes).deleteOne({ targetType, targetId: _id, userId })
  return readState(db, userId, targetType, _id)
}

async function readState(
  db: Db,
  userId: string,
  targetType: LikeTargetType,
  targetId: ObjectId,
): Promise<LikeState> {
  const summary = await readLikeSummary(db, userId, {
    postIds: targetType === 'post' ? [targetId] : [],
    correctionIds: targetType === 'correction' ? [targetId] : [],
    answerIds: targetType === 'answer' ? [targetId] : [],
  })
  return likeStateOf(summary, targetType, targetId)
}

/**
 * Who liked one thing, newest first.
 *
 * Block-filtered, unlike the count on the card. The two get opposite answers on
 * purpose: a follower list is short enough that a filtered list beside an
 * unfiltered count visibly disagrees, while likers are many and the count is
 * unattributable — nobody can tell which of four hundred names is missing. What
 * a viewer must never see is the blocked person's name, and that is the list.
 * The screen therefore counts its own rows rather than echoing the card's
 * number.
 */
export async function listLikers(
  db: Db,
  userId: string,
  query: ListLikersQuery,
): Promise<LikersPage> {
  const { _id, targetType } = await resolveTargetForRead(db, userId, query)
  const hidden = await blockedUserIds(db, userId)

  const filter: Document = { targetType, targetId: _id }
  if (hidden.length > 0) filter.userId = { $nin: hidden }
  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    filter.$or = [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }]
  }

  const page = await db
    .collection<Like>(COLLECTIONS.likes)
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const rows = hasMore ? page.slice(0, query.limit) : page
  const last = rows.at(-1)

  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ _id: { $in: rows.map((row) => row.userId) }, deletedAt: { $exists: false } })
    .toArray()
  const byId = new Map(profiles.map((profile) => [profile._id, profile]))

  // A row whose profile is gone is dropped rather than rendered as "Deleted
  // account": a feed post outlives its author because the sentence is the
  // point, but a name in a list of names is only the name. The page can
  // therefore come back shorter than `limit`, exactly as `getViewers` does.
  const items = rows.flatMap((row) => {
    const profile = byId.get(row.userId)
    if (!profile) return []
    return [
      {
        _id: profile._id,
        handle: profile.handle,
        displayName: profile.displayName,
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
 * The same visibility check as `resolveTarget`, minus the self-check: you may
 * read who liked your own post, you just may not like it.
 */
async function resolveTargetForRead(
  db: Db,
  userId: string,
  target: LikeTarget,
): Promise<{ _id: ObjectId; targetType: LikeTargetType }> {
  try {
    return await resolveTarget(db, userId, target)
  } catch (error) {
    if (error instanceof ApiError && error.code === ERROR_CODES.VALIDATION_FAILED) {
      return { _id: new ObjectId(target.targetId), targetType: target.targetType }
    }
    throw error
  }
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
}
