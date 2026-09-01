import {
  ERROR_CODES,
  TOKEN_RULES,
  type CreatePronunciationAnswerInput,
  type ListPronunciationAnswersQuery,
  type PronunciationAnswer,
  type PronunciationAnswersPage,
} from '@langx/shared'
import { ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { blockedUserIds } from '../moderation/blocks'
import type { StorageProvider } from '../../storage/StorageProvider'
import type { Profile } from '../profiles/profiles'
import { awardTokens } from '../tokens/ledger'
import { recordQualifyingAction } from '../tokens/streak'
import { assertAttachable, deleteObjects } from './attachments'
import type { Post, PronunciationAnswerDoc } from './documents'
import { answerDto, loadAuthors, postDto } from './dto'
import { EMPTY_LIKE_SUMMARY, readLikeSummary } from './likes'
import { readCommentSummary } from './comments'

/**
 * What the ledger files a pronunciation award under.
 *
 * **The request's id, not the answer's.** An answer can be deleted and written
 * again, and keying the award on the row would mint a fresh `refId` every time
 * — an unbounded payout from one post. Keyed on the post, the ledger's existing
 * `{userId, kind, refId}` unique index *is* the rule "paid once per request per
 * person", permanently and without a second read.
 *
 * Prefixed for the reason `mutualRefId` is: the kind already separates these
 * from every other row, but an unprefixed ObjectId hex says nothing about which
 * collection it came from, and the prefix is what keeps the row unambiguous if
 * two kinds are ever consolidated.
 */
export function pronunciationRefId(postId: ObjectId): string {
  return `pron:${postId.toHexString()}`
}

/**
 * The one answer each card shows, and whether the viewer has already recorded
 * one — the twin of `readCorrectionSummary`, and the same argument for its
 * shape: `$group`/`$first` after an index-backed `$sort` costs O(posts) rather
 * than O(answers), and the viewer lookup is a targeted read of a unique index.
 */
export async function readAnswerSummary(
  db: Db,
  userId: string,
  ids: ObjectId[],
): Promise<{ topByPost: Map<string, PronunciationAnswerDoc>; viewerAnswered: Set<string> }> {
  if (ids.length === 0) return { topByPost: new Map(), viewerAnswered: new Set() }

  const answers = db.collection<PronunciationAnswerDoc>(COLLECTIONS.pronunciationAnswers)
  const [tops, mine] = await Promise.all([
    answers
      .aggregate<{ _id: ObjectId; top: PronunciationAnswerDoc }>([
        { $match: { postId: { $in: ids } } },
        // Matches `post_created_id`, so the sort is a scan of the index rather
        // than an in-memory sort of the documents.
        { $sort: { postId: 1, createdAt: 1 } },
        { $group: { _id: '$postId', top: { $first: '$$ROOT' } } },
      ])
      .toArray(),
    answers
      .find({ postId: { $in: ids }, authorId: userId })
      .project<{ postId: ObjectId }>({ postId: 1 })
      .toArray(),
  ])

  return {
    topByPost: new Map(tops.map((row) => [row._id.toHexString(), row.top])),
    viewerAnswered: new Set(mine.map((row) => row.postId.toHexString())),
  }
}

export async function answerPronunciation(
  db: Db,
  userId: string,
  postId: string,
  input: CreatePronunciationAnswerInput,
  storagePublicBaseUrl?: string,
): Promise<PronunciationAnswer> {
  if (!ObjectId.isValid(postId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  const _id = new ObjectId(postId)

  const post = await db.collection<Post>(COLLECTIONS.posts).findOne({ _id })
  if (!post) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  // Without this the collection fills with rows no reader ever queries: the
  // pronunciation section is the only place answers are listed, and a
  // correction post is never in it.
  if ((post.kind ?? 'correction') !== 'pronunciation') {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'That post asks for a correction, not a recording',
    )
  }
  // Recording your own word is not teaching, and it would pay for it.
  if (post.authorId === userId) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You cannot answer your own request')
  }

  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  // `'audio'` is what stops a photo of a mouth being submitted as a recording.
  // Both takes together, so they cost one unit and neither is charged for
  // before the other has been checked.
  await assertAttachable(
    db,
    userId,
    profile,
    [input.media, ...(input.slowMedia ? [input.slowMedia] : [])],
    storagePublicBaseUrl,
    'audio',
  )

  const doc: PronunciationAnswerDoc = {
    _id: new ObjectId(),
    postId: _id,
    authorId: userId,
    media: input.media,
    ...(input.slowMedia ? { slowMedia: input.slowMedia } : {}),
    ...(input.note ? { note: input.note } : {}),
    createdAt: new Date(),
  }

  try {
    await db.collection<PronunciationAnswerDoc>(COLLECTIONS.pronunciationAnswers).insertOne(doc)
  } catch (error) {
    // The unique index is the guard, not a prior read: two taps that race would
    // both pass a check-then-insert and both pay.
    if (isDuplicate(error)) {
      throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You have already answered this request')
    }
    throw error
  }

  await db.collection<Post>(COLLECTIONS.posts).updateOne({ _id }, { $inc: { answerCount: 1 } })
  await awardForPronunciationAnswer(db, userId, doc)

  const authors = await loadAuthors(db, [userId])
  return answerDto(doc, authors, EMPTY_LIKE_SUMMARY)
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
}

/**
 * Paid at the same rate as a correction, under its own kind.
 *
 * The same rate because it is the same act in a different medium: somebody
 * spending their own time on a stranger's sentence. Its own kind because the
 * correction badges and cosmetic gates count corrections *written*, and folding
 * a different act into that number moves a threshold that names the other one.
 *
 * No `recordActivity`. The daily pool's weights are a published formula
 * mirrored on the website and in two GitBook pages, and adding a fourth term is
 * a pool rebalance rather than a feature. The consequence is deliberate and
 * worth stating: an answer pays its ten and advances the streak, and
 * contributes nothing to that day's pool share.
 */
async function awardForPronunciationAnswer(
  db: Db,
  userId: string,
  answer: PronunciationAnswerDoc,
): Promise<void> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  const frozen = Boolean(profile?.tokenFrozenAt)
  const at = answer.createdAt

  await awardTokens(db, {
    userId,
    kind: 'pronunciation',
    amount: frozen ? 0 : TOKEN_RULES.award.pronunciation,
    refId: pronunciationRefId(answer.postId),
    at,
  })
  if (profile) await recordQualifyingAction(db, profile, at)
}

/** A request and the recordings left on it, oldest first. */
export async function listPronunciationAnswers(
  db: Db,
  userId: string,
  postId: string,
  query: ListPronunciationAnswersQuery,
): Promise<PronunciationAnswersPage> {
  if (!ObjectId.isValid(postId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  const _id = new ObjectId(postId)

  const [post, hidden, { topByPost, viewerAnswered }, commentCounts] = await Promise.all([
    db.collection<Post>(COLLECTIONS.posts).findOne({ _id }),
    blockedUserIds(db, userId),
    readAnswerSummary(db, userId, [_id]),
    readCommentSummary(db, [_id]),
  ])
  if (!post) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  if (hidden.includes(post.authorId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')

  const filter: Document = { postId: _id }
  if (hidden.length > 0) filter.authorId = { $nin: hidden }
  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    filter.$or = [{ createdAt: { $gt: date } }, { createdAt: date, _id: { $gt: id } }]
  }

  const page = await db
    .collection<PronunciationAnswerDoc>(COLLECTIONS.pronunciationAnswers)
    .find(filter)
    .sort({ createdAt: 1, _id: 1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const items = hasMore ? page.slice(0, query.limit) : page
  const last = items.at(-1)

  const top = topByPost.get(postId) ?? null
  const [authors, likes] = await Promise.all([
    loadAuthors(db, [post.authorId, ...items.map((doc) => doc.authorId)]),
    readLikeSummary(db, userId, {
      postIds: [_id],
      correctionIds: [],
      // The top answer is on page one and nowhere else, so past the first page
      // it has to be named explicitly or the header's copy of it would claim
      // nobody had liked it.
      answerIds: [
        ...items.map((doc) => doc._id),
        ...(top && !items.some((doc) => doc._id.equals(top._id)) ? [top._id] : []),
      ],
    }),
  ])

  return {
    post: postDto(post, {
      authors,
      likes,
      top: null,
      topAnswer: top,
      correctedByViewer: false,
      answeredByViewer: viewerAnswered.has(postId),
      commentCount: commentCounts.get(postId) ?? 0,
    }),
    items: items.map((doc) => answerDto(doc, authors, likes)),
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}

/**
 * Delete a recording you left.
 *
 * Both takes leave the bucket, `answerCount` comes down so the request goes
 * back into the queue, and `post_author_unique` releases so you can record a
 * better one.
 *
 * The second recording **pays nothing**, and needs no check to make it so:
 * `pronunciationRefId` keys the award on the request rather than on the row, so
 * the ledger's unique index already holds the fact that this person was paid
 * for this request. Without that, delete-and-rerecord would be an unbounded
 * payout from a single post.
 */
export async function deleteAnswer(
  db: Db,
  userId: string,
  postId: string,
  answerId: string,
  storage?: StorageProvider,
): Promise<void> {
  if (!ObjectId.isValid(postId) || !ObjectId.isValid(answerId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Answer not found')
  }
  const _id = new ObjectId(answerId)
  const post_id = new ObjectId(postId)

  const answers = db.collection<PronunciationAnswerDoc>(COLLECTIONS.pronunciationAnswers)
  const doc = await answers.findOne({ _id, postId: post_id })
  const deleted = await answers.deleteOne({ _id, postId: post_id, authorId: userId })
  if (deleted.deletedCount === 0) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Answer not found')

  await Promise.all([
    db
      .collection<Post>(COLLECTIONS.posts)
      .updateOne({ _id: post_id }, { $inc: { answerCount: -1 } }),
    db.collection(COLLECTIONS.likes).deleteMany({ targetType: 'answer', targetId: _id }),
  ])
  await deleteObjects(storage, [doc?.media.url, doc?.slowMedia?.url])
}
