import {
  ERROR_CODES,
  TOKEN_RULES,
  type CreatePostCorrectionInput,
  type CreatePostInput,
  type FeedPage,
  type FeedPost,
  FEED_FOLLOWING_SOURCE_LIMIT,
  type ListFeedQuery,
  type ListPostCorrectionsQuery,
  type PostCorrectionsPage,
  type PostCorrection,
} from '@langx/shared'
import { ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { decodeFeedCursor, encodeFeedCursor } from '../../lib/feedCursor'
import { blockedUserIds } from '../moderation/blocks'
import { followingIds } from '../social/follows'
import { EMPTY_LIKE_SUMMARY, readLikeSummary } from './likes'
import type { Profile } from '../profiles/profiles'
import { recordActivity } from '../tokens/dailyActivity'
import { awardTokens } from '../tokens/ledger'
import { settleReferral } from '../referrals/settle'
import { recordQualifyingAction } from '../tokens/streak'
import type { StorageProvider } from '../../storage/StorageProvider'
import { assertAttachable, deleteObjects } from './attachments'
import { readCommentSummary } from './comments'
import type { PostCommentDoc } from './documents'
import type { Post, PostCorrectionDoc, PronunciationAnswerDoc } from './documents'
import { correctionDto, loadAuthors, postDto } from './dto'
import { readAnswerSummary } from './pronunciation'

export type { Post, PostCorrectionDoc } from './documents'

/**
 * The one correction each card shows, and whether the viewer has already
 * answered — without reading the rest.
 *
 * The obvious version fetches every correction for the page and picks the first
 * of each in JS. That is fine for a post with two answers and quadratic-feeling
 * for one with three hundred: a single popular post makes every request that
 * happens to include it transfer its whole correction list to compute two
 * booleans' worth of output.
 *
 * `$group`/`$first` after an index-backed `$sort` returns one document per
 * post, so what crosses the wire is O(posts) rather than O(corrections). The
 * viewer lookup is a separate targeted query on `post_author_unique` rather
 * than a second pass over the same documents — it reads at most one row per
 * post by definition, since that index is unique.
 */
async function readCorrectionSummary(
  db: Db,
  userId: string,
  ids: ObjectId[],
): Promise<{ topByPost: Map<string, PostCorrectionDoc>; viewerCorrected: Set<string> }> {
  if (ids.length === 0) return { topByPost: new Map(), viewerCorrected: new Set() }

  const corrections = db.collection<PostCorrectionDoc>(COLLECTIONS.postCorrections)
  const [tops, mine] = await Promise.all([
    corrections
      .aggregate<{ _id: ObjectId; top: PostCorrectionDoc }>([
        { $match: { postId: { $in: ids } } },
        // Matches `post_created` ({ postId: 1, createdAt: 1 }), so the sort is
        // a scan of the index rather than an in-memory sort of the documents.
        { $sort: { postId: 1, createdAt: 1 } },
        { $group: { _id: '$postId', top: { $first: '$$ROOT' } } },
      ])
      .toArray(),
    corrections
      .find({ postId: { $in: ids }, authorId: userId })
      .project<{ postId: ObjectId }>({ postId: 1 })
      .toArray(),
  ])

  return {
    topByPost: new Map(tops.map((row) => [row._id.toHexString(), row.top])),
    viewerCorrected: new Set(mine.map((row) => row.postId.toHexString())),
  }
}

/**
 * A page of posts turned into what a card needs: the author, the one reply
 * shown under it, the viewer's own like and reply state, and the comment count.
 *
 * `want` is here because the two readers disagree about which reply matters. A
 * section of the feed shows one kind at a time — a correction page never draws
 * a `topAnswer`, a pronunciation page never draws a `topCorrection` — and
 * running both aggregates would make each section pay for the other's on every
 * page. A list that mixes the kinds has to ask for both, and can afford to:
 * it is one person's own posts, not the whole collection.
 */
async function hydratePosts(
  db: Db,
  userId: string,
  items: Post[],
  want: { corrections: boolean; answers: boolean },
): Promise<FeedPost[]> {
  const ids = items.map((post) => post._id)
  const [corrections, answers, commentCounts] = await Promise.all([
    want.corrections ? readCorrectionSummary(db, userId, ids) : EMPTY_CORRECTION_SUMMARY,
    want.answers ? readAnswerSummary(db, userId, ids) : EMPTY_ANSWER_SUMMARY,
    readCommentSummary(db, ids),
  ])
  const tops = [...corrections.topByPost.values()]
  const topAnswers = [...answers.topByPost.values()]

  const [authors, likes] = await Promise.all([
    loadAuthors(db, [
      ...items.map((post) => post.authorId),
      ...tops.map((c) => c.authorId),
      ...topAnswers.map((a) => a.authorId),
    ]),
    // One call for the whole page — every post *and* the one reply each card
    // shows. Lists rather than calls, because they share a query.
    readLikeSummary(db, userId, {
      postIds: ids,
      correctionIds: tops.map((c) => c._id),
      answerIds: topAnswers.map((a) => a._id),
    }),
  ])

  return items.map((post) => {
    const key = post._id.toHexString()
    return postDto(post, {
      authors,
      likes,
      top: corrections.topByPost.get(key) ?? null,
      topAnswer: answers.topByPost.get(key) ?? null,
      correctedByViewer: corrections.viewerCorrected.has(key),
      answeredByViewer: answers.viewerAnswered.has(key),
      commentCount: commentCounts.get(key) ?? 0,
    })
  })
}

export async function listFeed(db: Db, userId: string, query: ListFeedQuery): Promise<FeedPage> {
  const posts = db.collection<Post>(COLLECTIONS.posts)

  /**
   * The section decides which posts are in the queue and which count it drains
   * by. Both sections sort the same way — fewest answers first, then newest —
   * and only the *meaning* of the integer changes, which is why one field name
   * and not two code paths.
   */
  const pronunciation = query.kind === 'pronunciation'
  const countField: 'correctionCount' | 'answerCount' = pronunciation
    ? 'answerCount'
    : 'correctionCount'

  // Blocks are symmetric here as everywhere else: `blockedUserIds` returns
  // both directions, so neither party appears in the other's feed.
  // Independent of each other, so they go together: the block list does not
  // narrow the audience lookups, it filters their result.
  const [hidden, follows, conversations] = await Promise.all([
    blockedUserIds(db, userId),
    pronunciation ? Promise.resolve([]) : followingIds(db, userId, FEED_FOLLOWING_SOURCE_LIMIT),
    pronunciation
      ? Promise.resolve([])
      : db
          .collection<{ participants: string[] }>(COLLECTIONS.conversations)
          .find({ participants: userId })
          // Sorted and capped, which is what makes the truncation below mean
          // something rather than being whichever rows Mongo happened to
          // return. `participants_recent` already backs this exact order.
          .sort({ 'lastMessage.createdAt': -1 })
          .limit(FEED_FOLLOWING_SOURCE_LIMIT)
          .project<{ participants: string[] }>({ participants: 1 })
          .toArray(),
  ])

  /*
   * Who comes first: the union of two relationships, not one.
   *
   * The follow graph is the real answer, and the people you have actually
   * talked to are the one this app had before there was a graph — dropping
   * them would have emptied the old "Following" tab for every existing user on
   * the day the Follow button shipped, and a conversation partner is somebody
   * you are following in every sense except the button.
   *
   * Bounded, because the result is an `$in`: see
   * `FEED_FOLLOWING_SOURCE_LIMIT`. Follows come first in the union so that a
   * deliberate choice outranks an incidental one when the cap bites.
   *
   * Empty for the pronunciation section, which has one queue and no graph in
   * it yet — so it falls straight through to the second query below.
   */
  const partners = conversations.flatMap((c) => c.participants).filter((id) => id !== userId)
  const audience = [...new Set([...follows, ...partners])]
    .filter((id) => id !== userId && !hidden.includes(id))
    .slice(0, FEED_FOLLOWING_SOURCE_LIMIT)

  /**
   * `$in` with `null`, not `$ne`.
   *
   * Every post written before the pronunciation section shipped has no `kind`
   * and is a correction post, and there is no backfill. `$in: ['correction',
   * null]` matches the missing field *and* gives the planner bounds it can seek
   * on `kind_needs_correction`. `{ $ne: 'pronunciation' }` reads identically
   * and cannot be bounded — it would quietly turn the main feed into a
   * collection scan, which nothing would fail to warn about.
   */
  const base: Document = { kind: pronunciation ? 'pronunciation' : { $in: ['correction', null] } }
  const sort: Document = { [countField]: 1, createdAt: -1, _id: -1 }

  /**
   * The cursor carries the sort's own keys — `(count, createdAt, _id)` — and
   * which of the two queries below it stopped in. Paging a count-led sort with
   * a `createdAt`-only cursor would silently skip every post whose count
   * differs, which is most of them.
   */
  const cursor = query.cursor ? decodeFeedCursor(query.cursor) : null
  const after = (c: NonNullable<typeof cursor>): Document => ({
    $or: [
      { [countField]: { $gt: c.count } },
      {
        [countField]: c.count,
        $or: [{ createdAt: { $lt: c.date } }, { createdAt: c.date, _id: { $lt: c.id } }],
      },
    ],
  })

  /**
   * Two queries stitched into one page, rather than one sort.
   *
   * "People you follow first" is not a field on the post, so no index can sort
   * by it, and computing it per document (`$addFields` + `$in`) would make
   * every page an in-memory sort of the whole collection. Reading the
   * audience's posts to exhaustion and then everybody else's is the same
   * order, served from `kind_needs_correction` both times, and the cursor
   * remembers which half it is in so page two does not start the first half
   * again.
   *
   * The second query runs even when the first filled the page exactly: its
   * `+1` is what tells the client whether there *is* a page two.
   */
  const items: Post[] = []
  let hasMore = false
  let fromAudience = 0
  if (audience.length > 0 && (!cursor || cursor.followed)) {
    const filter: Document = { ...base, authorId: { $in: audience } }
    if (cursor) filter.$and = [after(cursor)]
    const page = await posts
      .find(filter)
      .sort(sort)
      .limit(query.limit + 1)
      .toArray()
    hasMore = page.length > query.limit
    items.push(...page.slice(0, query.limit))
    fromAudience = items.length
  }
  if (!hasMore) {
    const remaining = query.limit - items.length
    const excluded = [...hidden, ...audience]
    const filter: Document = excluded.length > 0 ? { ...base, authorId: { $nin: excluded } } : base
    if (cursor && !cursor.followed) filter.$and = [after(cursor)]
    const page = await posts
      .find(filter)
      .sort(sort)
      .limit(remaining + 1)
      .toArray()
    hasMore = page.length > remaining
    items.push(...page.slice(0, remaining))
  }
  const last = items.at(-1)

  return {
    items: await hydratePosts(db, userId, items, {
      corrections: !pronunciation,
      answers: pronunciation,
    }),
    nextCursor:
      hasMore && last
        ? encodeFeedCursor(
            last.createdAt,
            last._id,
            last[countField] ?? 0,
            // The page ended inside the audience exactly when nothing after
            // it came from the second query.
            items.length === fromAudience,
          )
        : null,
  }
}

const EMPTY_CORRECTION_SUMMARY = {
  topByPost: new Map<string, PostCorrectionDoc>(),
  viewerCorrected: new Set<string>(),
}
const EMPTY_ANSWER_SUMMARY = {
  topByPost: new Map<string, PronunciationAnswerDoc>(),
  viewerAnswered: new Set<string>(),
}

export async function createPost(
  db: Db,
  userId: string,
  input: CreatePostInput,
  storagePublicBaseUrl?: string,
): Promise<FeedPost> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  // You post in a language you are learning. Posting in your native one is not
  // a request for a correction, it is just talking — and the feed has one job.
  if (!profile.learning.some((entry) => entry.code === input.language)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Post in a language you are learning')
  }

  if (input.media) {
    await assertAttachable(db, userId, profile, [input.media], storagePublicBaseUrl)
  }

  const doc: Post = {
    _id: new ObjectId(),
    authorId: userId,
    body: input.body,
    language: input.language,
    // Written explicitly on every new post, so the missing-field case only ever
    // covers rows that predate the field.
    kind: input.kind,
    correctionCount: 0,
    ...(input.kind === 'pronunciation' ? { answerCount: 0 } : {}),
    ...(input.media ? { media: input.media } : {}),
    createdAt: new Date(),
  }
  await db.collection<Post>(COLLECTIONS.posts).insertOne(doc)

  // Nothing can have liked, corrected or answered a post that did not exist a
  // line ago, so the summary is empty by construction rather than by query.
  return postDto(doc, {
    authors: new Map([[userId, profile]]),
    likes: EMPTY_LIKE_SUMMARY,
    top: null,
    topAnswer: null,
    correctedByViewer: false,
    answeredByViewer: false,
    commentCount: 0,
  })
}

export async function correctPost(
  db: Db,
  userId: string,
  postId: string,
  input: CreatePostCorrectionInput,
  storagePublicBaseUrl?: string,
): Promise<PostCorrection> {
  if (!ObjectId.isValid(postId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  const _id = new ObjectId(postId)

  const post = await db.collection<Post>(COLLECTIONS.posts).findOne({ _id })
  if (!post) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  // The mirror of the guard in `answerPronunciation`. A request for a recording
  // is not a sentence to rewrite, and a correction on one would sit in a list
  // that section never reads.
  if ((post.kind ?? 'correction') !== 'correction') {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'That post asks for a recording, not a correction',
    )
  }
  // Correcting your own sentence is not teaching, and it would pay for it.
  if (post.authorId === userId) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You cannot correct your own post')
  }

  if (input.media) {
    const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
    if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
    await assertAttachable(db, userId, profile, [input.media], storagePublicBaseUrl)
  }

  const doc: PostCorrectionDoc = {
    _id: new ObjectId(),
    postId: _id,
    authorId: userId,
    corrected: input.corrected,
    ...(input.note ? { note: input.note } : {}),
    ...(input.media ? { media: input.media } : {}),
    createdAt: new Date(),
  }

  try {
    await db.collection<PostCorrectionDoc>(COLLECTIONS.postCorrections).insertOne(doc)
  } catch (error) {
    // The unique index is the guard, not a prior read: two taps that race would
    // both pass a check-then-insert and both pay.
    if (isDuplicate(error)) {
      throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You have already corrected this post')
    }
    throw error
  }

  await db.collection<Post>(COLLECTIONS.posts).updateOne({ _id }, { $inc: { correctionCount: 1 } })
  await awardForPostCorrection(db, userId, doc)

  const authors = await loadAuthors(db, [userId])
  return correctionDto(doc, authors, EMPTY_LIKE_SUMMARY)
}

function isDuplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
}

/**
 * Paid through the same `correction` kind as a chat correction, at the same
 * rate and with the same absence of a cap.
 *
 * That sameness is the point: the economy rewards teaching, and it must not
 * matter whether the teaching happened in a thread or on a post. A separate
 * kind would also have made the correction badges — which count `correction`
 * rows — quietly wrong.
 *
 * **Filed under the post's id, not the correction's.** A correction can be
 * deleted and written again, and keying the award on the row would mint a fresh
 * `refId` each time — an unbounded payout from one post. Keyed on the post, the
 * ledger's `{userId, kind, refId}` unique index *is* the rule "paid once per
 * post per person", permanently and without a second read.
 *
 * Prefixed for the reason `mutualRefId` is: a bare ObjectId hex says nothing
 * about which collection it came from.
 */
export function correctionRefId(postId: ObjectId): string {
  return `postcorr:${postId.toHexString()}`
}

async function awardForPostCorrection(
  db: Db,
  userId: string,
  correction: PostCorrectionDoc,
): Promise<void> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  const frozen = Boolean(profile?.tokenFrozenAt)
  const at = correction.createdAt

  await recordActivity(db, { userId, kind: 'correction', at })
  await awardTokens(db, {
    userId,
    kind: 'correction',
    amount: frozen ? 0 : TOKEN_RULES.award.correction,
    refId: correctionRefId(correction.postId),
    at,
  })
  if (profile) await recordQualifyingAction(db, profile, at)
  // Teaching on a post is teaching. See the same call in `awardForSend`.
  if (profile?.referredBy && !frozen) await settleReferral(db, userId, at)
}

/**
 * A post and the corrections on it, oldest first.
 *
 * Three things this did not do before anything called it. It never took a
 * viewer, so it applied no block filter at all — a symmetry hole everywhere
 * else in the app closes, invisible only because no screen had been built yet.
 * It read the whole list with `.toArray()`, which is fine for two answers and
 * not for three hundred. And it returned corrections without the post, so the
 * screen showing them would have needed a second request for the sentence they
 * are corrections *of*.
 */
export async function listPostCorrections(
  db: Db,
  userId: string,
  postId: string,
  query: ListPostCorrectionsQuery,
): Promise<PostCorrectionsPage> {
  if (!ObjectId.isValid(postId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  const _id = new ObjectId(postId)

  // The correction summary only needs the post's id, which we already have, so
  // it rides along here rather than costing a second round trip below.
  const [post, hidden, { topByPost, viewerCorrected }, commentCounts] = await Promise.all([
    db.collection<Post>(COLLECTIONS.posts).findOne({ _id }),
    blockedUserIds(db, userId),
    readCorrectionSummary(db, userId, [_id]),
    // Carried here so the detail screen's header agrees with the card that
    // opened it. A count that differs between the two reads as a bug.
    readCommentSummary(db, [_id]),
  ])
  if (!post) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  // 404 rather than 403, for the reason the profile route gives: a blocked
  // account is absent, and a 403 would confirm it exists.
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
    .collection<PostCorrectionDoc>(COLLECTIONS.postCorrections)
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
      // The top correction is on page one and nowhere else, so past the first
      // page it has to be named explicitly or the header's copy of it would
      // claim nobody had liked it.
      correctionIds: [
        ...items.map((doc) => doc._id),
        ...(top && !items.some((doc) => doc._id.equals(top._id)) ? [top._id] : []),
      ],
      answerIds: [],
    }),
  ])

  return {
    post: postDto(post, {
      authors,
      likes,
      top,
      topAnswer: null,
      correctedByViewer: viewerCorrected.has(postId),
      answeredByViewer: false,
      commentCount: commentCounts.get(postId) ?? 0,
    }),
    items: items.map((doc) => correctionDto(doc, authors, likes)),
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}

/**
 * Delete your own post, and everything hanging off it.
 *
 * A hard delete, not a tombstone. The tombstone pattern `deleteMessage` uses
 * works there because a withdrawn message still has a place in a thread; here
 * the post *is* the sentence its corrections are corrections of, and an empty
 * one leaves a list of rewrites of nothing. Somebody removing a sentence they
 * regret posting also means it to be gone, and half-gone is the answer nobody
 * asked for.
 *
 * **Earned token is not clawed back.** The ledger is append-only and the people
 * who corrected this post did the work; deleting the sentence does not undo
 * their afternoon. The rows stay exactly where they are, which is also why
 * rewriting a correction on a *different* post cannot be used to re-earn — see
 * `correctionRefId`.
 *
 * Ownership lives in the filter rather than in an `if` above it: two devices
 * pressing delete at once both pass a read-then-decide, and only one can match
 * a `deleteOne`. `deletedCount` is what tells the second to stop.
 *
 * 404 rather than 403 for somebody else's post, for the reason the rest of this
 * module gives: a 403 confirms the row exists.
 */
export async function deletePost(
  db: Db,
  userId: string,
  postId: string,
  storage?: StorageProvider,
): Promise<void> {
  if (!ObjectId.isValid(postId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  const _id = new ObjectId(postId)

  const post = await db.collection<Post>(COLLECTIONS.posts).findOne({ _id })
  if (!post || post.authorId !== userId) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  }

  const corrections = db.collection<PostCorrectionDoc>(COLLECTIONS.postCorrections)
  const answers = db.collection<PronunciationAnswerDoc>(COLLECTIONS.pronunciationAnswers)

  // Read the children before the parent goes, because after it does there is
  // nothing left to find them by that a later sweep could use.
  const [childCorrections, childAnswers] = await Promise.all([
    corrections.find({ postId: _id }).toArray(),
    answers.find({ postId: _id }).toArray(),
  ])

  const deleted = await db.collection<Post>(COLLECTIONS.posts).deleteOne({ _id, authorId: userId })
  if (deleted.deletedCount === 0) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')

  /*
   * The post goes first so it leaves the feed immediately and a correction
   * racing this call cannot attach to something already on its way out.
   *
   * The accepted residue: a `correctPost` that read the post between those two
   * lines leaves one orphan row. It is invisible — every reader reaches a
   * correction through its post, and that lookup now 404s — but its attachment
   * stays in the bucket. Closing it would need a `deletingAt` flag and a
   * two-phase delete, which is more machinery than one stranded object is worth.
   */
  await Promise.all([
    corrections.deleteMany({ postId: _id }),
    answers.deleteMany({ postId: _id }),
    db.collection<PostCommentDoc>(COLLECTIONS.postComments).deleteMany({ postId: _id }),
    db.collection(COLLECTIONS.likes).deleteMany({
      $or: [
        { targetType: 'post', targetId: _id },
        { targetType: 'correction', targetId: { $in: childCorrections.map((c) => c._id) } },
        { targetType: 'answer', targetId: { $in: childAnswers.map((a) => a._id) } },
      ],
    }),
  ])

  await deleteObjects(storage, [
    post.media?.url,
    ...childCorrections.map((c) => c.media?.url),
    ...childAnswers.flatMap((a) => [a.media.url, a.slowMedia?.url]),
  ])
}

/**
 * Delete a correction you wrote.
 *
 * The row goes and `correctionCount` comes down with it, so the post returns to
 * the front of the `needsCorrection` queue where it belongs — and, because
 * `post_author_unique` no longer holds a row, you can write a better one.
 *
 * That second attempt **pays nothing**, and needs no check to make it so:
 * `correctionRefId` keys the award on the post, so the ledger's existing unique
 * index has already recorded that this person was paid for this post. Delete
 * and rewrite as often as you like; the payment happened once.
 */
export async function deleteCorrection(
  db: Db,
  userId: string,
  postId: string,
  correctionId: string,
  storage?: StorageProvider,
): Promise<void> {
  if (!ObjectId.isValid(postId) || !ObjectId.isValid(correctionId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Correction not found')
  }
  const _id = new ObjectId(correctionId)
  const post_id = new ObjectId(postId)

  const corrections = db.collection<PostCorrectionDoc>(COLLECTIONS.postCorrections)
  const doc = await corrections.findOne({ _id, postId: post_id })
  const deleted = await corrections.deleteOne({ _id, postId: post_id, authorId: userId })
  if (deleted.deletedCount === 0) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Correction not found')
  }

  await Promise.all([
    db
      .collection<Post>(COLLECTIONS.posts)
      .updateOne({ _id: post_id }, { $inc: { correctionCount: -1 } }),
    db.collection(COLLECTIONS.likes).deleteMany({ targetType: 'correction', targetId: _id }),
  ])
  await deleteObjects(storage, [doc?.media?.url])
}
