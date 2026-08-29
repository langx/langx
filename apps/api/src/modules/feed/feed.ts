import {
  ERROR_CODES,
  TOKEN_RULES,
  type CreatePostCorrectionInput,
  type CreatePostInput,
  type Media,
  type FeedPage,
  type FeedPost,
  FEED_FOLLOWING_SOURCE_LIMIT,
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
import { consumeQuota } from '../../lib/quota'
import { assertMediaAllowed } from '../media/assertMedia'
import { blockedUserIds } from '../moderation/blocks'
import { effectiveTier } from '../profiles/entitlement'
import { followingIds } from '../social/follows'
import { EMPTY_LIKE_SUMMARY, likeStateOf, readLikeSummary, type LikeSummary } from './likes'
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
  media?: Media
  createdAt: Date
}

export interface PostCorrectionDoc {
  _id: ObjectId
  postId: ObjectId
  authorId: string
  corrected: string
  note?: string
  media?: Media
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

function correctionDto(
  doc: PostCorrectionDoc,
  authors: AuthorMap,
  likes: LikeSummary,
): PostCorrection {
  return {
    _id: doc._id.toHexString(),
    author: authorDto(authors.get(doc.authorId), doc.authorId),
    corrected: doc.corrected,
    ...(doc.note ? { note: doc.note } : {}),
    ...likeStateOf(likes, 'correction', doc._id),
    ...(doc.media ? { media: doc.media } : {}),
    createdAt: doc.createdAt.toISOString(),
  }
}

function postDto(
  post: Post,
  context: {
    authors: AuthorMap
    top: PostCorrectionDoc | null
    correctedByViewer: boolean
    likes: LikeSummary
  },
): FeedPost {
  const profile = context.authors.get(post.authorId)
  return {
    _id: post._id.toHexString(),
    author: authorDto(profile, post.authorId),
    body: post.body,
    language: post.language,
    level: levelOf(profile, post.language),
    correctionCount: post.correctionCount,
    topCorrection: context.top ? correctionDto(context.top, context.authors, context.likes) : null,
    correctedByViewer: context.correctedByViewer,
    ...likeStateOf(context.likes, 'post', post._id),
    ...(post.media ? { media: post.media } : {}),
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
  const following = query.filter === 'following'
  const [hidden, follows, conversations] = await Promise.all([
    blockedUserIds(db, userId),
    following ? followingIds(db, userId, FEED_FOLLOWING_SOURCE_LIMIT) : Promise.resolve([]),
    following
      ? db
          .collection<{ participants: string[] }>(COLLECTIONS.conversations)
          .find({ participants: userId })
          // Sorted and capped, which is what makes the truncation below mean
          // something rather than being whichever rows Mongo happened to
          // return. `participants_recent` already backs this exact order.
          .sort({ 'lastMessage.createdAt': -1 })
          .limit(FEED_FOLLOWING_SOURCE_LIMIT)
          .project<{ participants: string[] }>({ participants: 1 })
          .toArray()
      : Promise.resolve([]),
  ])
  const filter: Document = hidden.length > 0 ? { authorId: { $nin: hidden } } : {}

  if (following) {
    /*
     * The union of two relationships, not one.
     *
     * The follow graph is the real answer, and the people you have actually
     * talked to are the one this app had before there was a graph — dropping
     * them would empty the tab for every existing user on the day the Follow
     * button shipped, and a conversation partner is somebody you are following
     * in every sense except the button.
     *
     * Bounded, because the result is an `$in`: see
     * `FEED_FOLLOWING_SOURCE_LIMIT`. Follows come first in the union so that a
     * deliberate choice outranks an incidental one when the cap bites.
     */
    const partners = conversations.flatMap((c) => c.participants).filter((id) => id !== userId)
    const audience = [...new Set([...follows, ...partners])]
      .filter((id) => id !== userId && !hidden.includes(id))
      .slice(0, FEED_FOLLOWING_SOURCE_LIMIT)
    if (audience.length === 0) return { items: [], nextCursor: null }
    filter.authorId = { $in: audience }
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

  const [authors, likes] = await Promise.all([
    loadAuthors(db, [
      ...items.map((post) => post.authorId),
      ...[...topByPost.values()].map((c) => c.authorId),
    ]),
    // One call for the whole page — every post *and* the one correction each
    // card shows. Two lists rather than two calls, because they share a query.
    readLikeSummary(db, userId, {
      postIds: ids,
      correctionIds: [...topByPost.values()].map((c) => c._id),
    }),
  ])

  return {
    items: items.map((post) =>
      postDto(post, {
        authors,
        likes,
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

/**
 * The attachment is allowed, and the daily media budget can pay for it.
 *
 * The same `media` bucket chat uses, deliberately. It is the same abuse
 * surface — bytes stored and served forever — and `PLAN_LIMITS.mediaPer24h` is
 * documented as a ceiling on abuse rather than a paywall. A second bucket would
 * mean a second limit key, a second quota kind, and a free tier that is really
 * a hundred a day through two doors.
 *
 * The user-visible consequence is real and worth saying out loud: a heavy day
 * in chat leaves fewer attachments for the feed.
 *
 * Consumed only when there *is* an attachment, so a plain sentence still costs
 * nothing.
 */
async function assertAttachable(
  db: Db,
  userId: string,
  profile: Profile,
  media: Media,
  storagePublicBaseUrl: string | undefined,
): Promise<void> {
  assertMediaAllowed(media, storagePublicBaseUrl)
  const quota = await consumeQuota(db, userId, effectiveTier(profile), 'media')
  if (!quota.consumed) {
    throw new ApiError(
      ERROR_CODES.QUOTA_EXCEEDED,
      'Daily attachment limit reached',
      quota.nextAvailableAt ? { retryAt: quota.nextAvailableAt.toISOString() } : undefined,
    )
  }
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

  if (input.media) await assertAttachable(db, userId, profile, input.media, storagePublicBaseUrl)

  const doc: Post = {
    _id: new ObjectId(),
    authorId: userId,
    body: input.body,
    language: input.language,
    correctionCount: 0,
    ...(input.media ? { media: input.media } : {}),
    createdAt: new Date(),
  }
  await db.collection<Post>(COLLECTIONS.posts).insertOne(doc)

  // Nothing can have liked or corrected a post that did not exist a line ago,
  // so the summary is empty by construction rather than by query.
  return postDto(doc, {
    authors: new Map([[userId, profile]]),
    likes: EMPTY_LIKE_SUMMARY,
    top: null,
    correctedByViewer: false,
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
  // Correcting your own sentence is not teaching, and it would pay for it.
  if (post.authorId === userId) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You cannot correct your own post')
  }

  if (input.media) {
    const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
    if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')
    await assertAttachable(db, userId, profile, input.media, storagePublicBaseUrl)
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

  // The correction summary only needs the post's id, which we already have, so
  // it rides along here rather than costing a second round trip below.
  const [post, hidden, { topByPost, viewerCorrected }] = await Promise.all([
    db.collection<Post>(COLLECTIONS.posts).findOne({ _id }),
    blockedUserIds(db, userId),
    readCorrectionSummary(db, userId, [_id]),
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
    }),
  ])

  return {
    post: postDto(post, {
      authors,
      likes,
      top,
      correctedByViewer: viewerCorrected.has(postId),
    }),
    items: items.map((doc) => correctionDto(doc, authors, likes)),
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}
