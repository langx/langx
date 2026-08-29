import {
  ERROR_CODES,
  TOKEN_RULES,
  type CreatePostCorrectionInput,
  type CreatePostInput,
  type FeedPage,
  type FeedPost,
  type ListFeedQuery,
  type ListPostCorrectionsQuery,
  type PostCorrectionsPage,
  languageLevelSchema,
  type PostCorrection,
} from '@langx/shared'
import { ObjectId, type Db, type Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { decodeFeedCursor, encodeFeedCursor } from '../../lib/feedCursor'
import { blockedUserIds } from '../moderation/blocks'
import type { Profile } from '../profiles/profiles'
import { recordActivity } from '../tokens/dailyActivity'
import { awardTokens } from '../tokens/ledger'
import { recordQualifyingAction } from '../tokens/streak'

export interface Post {
  _id: ObjectId
  authorId: string
  body: string
  language: string
  /**
   * Denormalized, and the one number here that is. It is the sort key for the
   * `needsCorrection` tab, and an index cannot sort on a count it would have to
   * join to find. Written only by `$inc` inside the same call that inserts the
   * correction, so it cannot drift the way a periodically-rebuilt counter would.
   */
  correctionCount: number
  createdAt: Date
}

export interface PostCorrectionDoc {
  _id: ObjectId
  postId: ObjectId
  authorId: string
  corrected: string
  note?: string
  createdAt: Date
}

type AuthorMap = Map<string, Profile>

async function loadAuthors(db: Db, ids: string[]): Promise<AuthorMap> {
  if (ids.length === 0) return new Map()
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ _id: { $in: [...new Set(ids)] } })
    .toArray()
  return new Map(profiles.map((profile) => [profile._id, profile]))
}

function authorDto(profile: Profile | undefined, id: string): FeedPost['author'] {
  return {
    _id: id,
    handle: profile?.handle ?? 'unknown',
    // A post outlives the account that wrote it — `deletedWithAccount` on
    // `messages` exists for the same reason — so the shape has to survive a
    // missing profile rather than dropping the row.
    displayName: profile?.displayName ?? 'Deleted account',
    ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
  }
}

function correctionDto(doc: PostCorrectionDoc, authors: AuthorMap): PostCorrection {
  return {
    _id: doc._id.toHexString(),
    author: authorDto(authors.get(doc.authorId), doc.authorId),
    corrected: doc.corrected,
    ...(doc.note ? { note: doc.note } : {}),
    createdAt: doc.createdAt.toISOString(),
  }
}

function postDto(
  post: Post,
  context: { authors: AuthorMap; top: PostCorrectionDoc | null; correctedByViewer: boolean },
): FeedPost {
  const profile = context.authors.get(post.authorId)
  return {
    _id: post._id.toHexString(),
    author: authorDto(profile, post.authorId),
    body: post.body,
    language: post.language,
    level: levelOf(profile, post.language),
    correctionCount: post.correctionCount,
    topCorrection: context.top ? correctionDto(context.top, context.authors) : null,
    correctedByViewer: context.correctedByViewer,
    createdAt: post.createdAt.toISOString(),
  }
}

/**
 * The author's level in the language they posted in.
 *
 * Resolved at read time from `learning` rather than copied onto the post: a
 * level changes as somebody improves, and a stored copy would freeze every old
 * post at the level they were when they wrote it.
 */
function levelOf(profile: Profile | undefined, language: string): FeedPost['level'] {
  const level = profile?.learning.find((entry) => entry.code === language)?.level
  // `Profile.learning[].level` is a bare `string` on the document; the DTO is
  // the enum. Parsing rather than casting means a level written by an older
  // build degrades to "no level" instead of into the response.
  const parsed = languageLevelSchema.safeParse(level)
  return parsed.success ? parsed.data : null
}

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

export async function listFeed(db: Db, userId: string, query: ListFeedQuery): Promise<FeedPage> {
  const posts = db.collection<Post>(COLLECTIONS.posts)

  // Blocks are symmetric here as everywhere else: `blockedUserIds` returns
  // both directions, so neither party appears in the other's feed.
  // Independent of each other, so they go together: the block list does not
  // narrow the conversation lookup, it filters its result.
  const [hidden, conversations] = await Promise.all([
    blockedUserIds(db, userId),
    query.filter === 'following'
      ? db
          .collection<{ participants: string[] }>(COLLECTIONS.conversations)
          .find({ participants: userId })
          .project<{ participants: string[] }>({ participants: 1 })
          .toArray()
      : Promise.resolve([]),
  ])
  const filter: Document = hidden.length > 0 ? { authorId: { $nin: hidden } } : {}

  if (query.filter === 'following') {
    // "Following" has no follow graph to read, so it means the people you have
    // actually talked to — which is the relationship this app has instead of
    // one. A feed of strangers is what the other tab already is.
    const known = [
      ...new Set(conversations.flatMap((c) => c.participants).filter((id) => id !== userId)),
    ]
    if (known.length === 0) return { items: [], nextCursor: null }
    const visible = known.filter((id) => !hidden.includes(id))
    if (visible.length === 0) return { items: [], nextCursor: null }
    filter.authorId = { $in: visible }
  }

  /**
   * The cursor carries the sort's own keys. On `needsCorrection` that is
   * `(correctionCount, createdAt, _id)`, and paging it with a `createdAt`-only
   * cursor would silently skip every post whose count differs — which is most
   * of them.
   */
  const needsFirst = query.filter === 'needsCorrection'
  if (query.cursor) {
    const { date, id, count } = decodeFeedCursor(query.cursor)
    const after: Document[] = [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }]
    filter.$and = [
      needsFirst && count !== null
        ? { $or: [{ correctionCount: { $gt: count } }, { correctionCount: count, $or: after }] }
        : { $or: after },
    ]
  }

  const sort: Document = needsFirst
    ? { correctionCount: 1, createdAt: -1, _id: -1 }
    : { createdAt: -1, _id: -1 }

  const page = await posts
    .find(filter)
    .sort(sort)
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const items = hasMore ? page.slice(0, query.limit) : page
  const last = items.at(-1)

  const ids = items.map((post) => post._id)
  const { topByPost, viewerCorrected } = await readCorrectionSummary(db, userId, ids)

  const authors = await loadAuthors(db, [
    ...items.map((post) => post.authorId),
    ...[...topByPost.values()].map((c) => c.authorId),
  ])

  return {
    items: items.map((post) =>
      postDto(post, {
        authors,
        top: topByPost.get(post._id.toHexString()) ?? null,
        correctedByViewer: viewerCorrected.has(post._id.toHexString()),
      }),
    ),
    nextCursor:
      hasMore && last
        ? encodeFeedCursor(last.createdAt, last._id, needsFirst ? last.correctionCount : null)
        : null,
  }
}

export async function createPost(
  db: Db,
  userId: string,
  input: CreatePostInput,
): Promise<FeedPost> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  // You post in a language you are learning. Posting in your native one is not
  // a request for a correction, it is just talking — and the feed has one job.
  if (!profile.learning.some((entry) => entry.code === input.language)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Post in a language you are learning')
  }

  const doc: Post = {
    _id: new ObjectId(),
    authorId: userId,
    body: input.body,
    language: input.language,
    correctionCount: 0,
    createdAt: new Date(),
  }
  await db.collection<Post>(COLLECTIONS.posts).insertOne(doc)

  return {
    _id: doc._id.toHexString(),
    author: authorDto(profile, userId),
    body: doc.body,
    language: doc.language,
    level: levelOf(profile, doc.language),
    correctionCount: 0,
    topCorrection: null,
    correctedByViewer: false,
    createdAt: doc.createdAt.toISOString(),
  }
}

export async function correctPost(
  db: Db,
  userId: string,
  postId: string,
  input: CreatePostCorrectionInput,
): Promise<PostCorrection> {
  if (!ObjectId.isValid(postId)) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  const _id = new ObjectId(postId)

  const post = await db.collection<Post>(COLLECTIONS.posts).findOne({ _id })
  if (!post) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Post not found')
  // Correcting your own sentence is not teaching, and it would pay for it.
  if (post.authorId === userId) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You cannot correct your own post')
  }

  const doc: PostCorrectionDoc = {
    _id: new ObjectId(),
    postId: _id,
    authorId: userId,
    corrected: input.corrected,
    ...(input.note ? { note: input.note } : {}),
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
  return correctionDto(doc, authors)
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
 */
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
    refId: correction._id.toHexString(),
    at,
  })
  if (profile) await recordQualifyingAction(db, profile, at)
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

  const [post, hidden] = await Promise.all([
    db.collection<Post>(COLLECTIONS.posts).findOne({ _id }),
    blockedUserIds(db, userId),
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

  const authors = await loadAuthors(db, [post.authorId, ...items.map((doc) => doc.authorId)])
  const { topByPost, viewerCorrected } = await readCorrectionSummary(db, userId, [_id])

  return {
    post: postDto(post, {
      authors,
      top: topByPost.get(postId) ?? null,
      correctedByViewer: viewerCorrected.has(postId),
    }),
    items: items.map((doc) => correctionDto(doc, authors)),
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}
