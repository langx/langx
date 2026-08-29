import { z } from 'zod'
import { languageCodeSchema } from './languages'
import { languageLevelSchema } from './level'
import { mediaSchema } from './media'

/**
 * The community feed: a sentence somebody is unsure about, and the corrections
 * other people leave on it.
 *
 * Deliberately *not* a chat. A conversation needs both people present and
 * matched; a post needs neither, which is what it is for — the learner with a
 * sentence at midnight and no partner awake, and the teacher with ten minutes
 * and nobody to spend them on. It pays through exactly the same `correction`
 * award as a chat correction, because it is the same behaviour.
 */
export const MAX_POST_LENGTH = 300
export const MAX_POST_NOTE_LENGTH = 500

export const postBodySchema = z.string().trim().min(1).max(MAX_POST_LENGTH)

/**
 * `needsCorrection` is the default, and it is the whole reason the feed has
 * tabs. Sorting a feed by recency alone means the newest post gets every
 * correction and a post that sat unanswered for an hour never gets one; putting
 * the uncorrected ones first is what makes the queue drain.
 */
export const FEED_FILTERS = ['needsCorrection', 'following'] as const
export type FeedFilter = (typeof FEED_FILTERS)[number]

/**
 * How many people the "Following" tab reads from.
 *
 * The audience is an `$in`, and an `$in` is a list the query planner has to
 * carry — so it needs a ceiling that does not grow with how social somebody is.
 * Truncated by recency, which is the tiebreak the rest of the app already uses:
 * somebody following nine hundred people cares most about the ones they most
 * recently chose. Above this the tab is a sample of the graph rather than all
 * of it, and that is a deliberate trade against a fan-out table we do not need
 * yet.
 */
export const FEED_FOLLOWING_SOURCE_LIMIT = 500

export const createPostSchema = z.object({
  body: postBodySchema,
  /** What language the sentence is in — the one the author is learning. */
  language: languageCodeSchema,
  /**
   * A photo of the sentence, or a recording of it being said.
   *
   * An attachment to a sentence, not a replacement for one: `body` stays
   * required. With no text there is nothing for `corrected` to be an edit of,
   * and the correction composer seeds itself with the post's words. Loosening
   * this later is backwards-compatible; tightening it would not be.
   */
  media: mediaSchema.optional(),
})
export type CreatePostInput = z.infer<typeof createPostSchema>

export const createPostCorrectionSchema = z.object({
  corrected: postBodySchema,
  note: z.string().trim().min(1).max(MAX_POST_NOTE_LENGTH).optional(),
  /** Usually a recording: hearing it said is the half a written correction cannot give. */
  media: mediaSchema.optional(),
})
export type CreatePostCorrectionInput = z.infer<typeof createPostCorrectionSchema>

/**
 * What can be liked, and the discriminator that keeps one collection able to
 * hold all of it.
 *
 * A like is a signal on *content* — a sentence somebody wrote, or a correction
 * somebody left. Never on a person: this app has no match gate, and a like on a
 * profile is the first half of one.
 */
export const LIKE_TARGET_TYPES = ['post', 'correction'] as const
export type LikeTargetType = (typeof LIKE_TARGET_TYPES)[number]

export const likeTargetSchema = z.object({
  targetType: z.enum(LIKE_TARGET_TYPES),
  targetId: z.string().trim().min(1),
})
export type LikeTarget = z.infer<typeof likeTargetSchema>

export const likeStateSchema = z.object({
  likeCount: z.number().int().nonnegative(),
  likedByViewer: z.boolean(),
})
export type LikeState = z.infer<typeof likeStateSchema>

export const LIKERS_PAGE_SIZE_DEFAULT = 30
export const LIKERS_PAGE_SIZE_MAX = 100

export const listLikersQuerySchema = likeTargetSchema.extend({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(LIKERS_PAGE_SIZE_MAX).default(LIKERS_PAGE_SIZE_DEFAULT),
})
export type ListLikersQuery = z.infer<typeof listLikersQuerySchema>

export const feedAuthorSchema = z.object({
  _id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
})

export const postCorrectionSchema = z.object({
  _id: z.string(),
  author: feedAuthorSchema,
  corrected: z.string(),
  note: z.string().optional(),
  /** Flat, to read the same way `correctionCount` does one level up. */
  likeCount: z.number().int().nonnegative(),
  likedByViewer: z.boolean(),
  media: mediaSchema.optional(),
  createdAt: z.string(),
})
export type PostCorrection = z.infer<typeof postCorrectionSchema>

export const likersPageSchema = z.object({
  items: z.array(feedAuthorSchema),
  nextCursor: z.string().nullable(),
})
export type LikersPage = z.infer<typeof likersPageSchema>

/**
 * A page of people, used by both the likers list and the follower/following
 * lists. `feedAuthorSchema` is exactly what a row draws and exactly what
 * `openProfile` needs, so there is no second shape for the same four fields.
 */
export const peoplePageSchema = likersPageSchema
export type PeoplePage = LikersPage

export const feedPostSchema = z.object({
  _id: z.string(),
  author: feedAuthorSchema,
  body: z.string(),
  language: z.string(),
  /** The author's own level in `language`, resolved at read time from their profile. */
  level: languageLevelSchema.nullable(),
  correctionCount: z.number().int(),
  /**
   * The oldest correction, which is the one the card shows. Oldest rather than
   * "best": there is no voting, and whoever answered first is the one who
   * answered — ranking by recency would bury it under every later reply.
   */
  topCorrection: postCorrectionSchema.nullable(),
  /** Whether the viewer has already corrected this. Drives "Add yours". */
  correctedByViewer: z.boolean(),
  likeCount: z.number().int().nonnegative(),
  likedByViewer: z.boolean(),
  /**
   * No `kind` field. `messages` carries `type` because it also has `'text'` and
   * `'correction'`; a post's attachment is unambiguous from its content type,
   * so `isImageContentType` derives it and there is one less field to keep in
   * step with the bytes.
   */
  media: mediaSchema.optional(),
  createdAt: z.string(),
})
export type FeedPost = z.infer<typeof feedPostSchema>

export const postMediaUploadUrlSchema = z.object({
  kind: z.enum(['image', 'audio']),
  contentType: z.string().trim().min(1),
})
export type PostMediaUploadUrlInput = z.infer<typeof postMediaUploadUrlSchema>

export const listFeedQuerySchema = z.object({
  filter: z.enum(FEED_FILTERS).default('needsCorrection'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export type ListFeedQuery = z.infer<typeof listFeedQuerySchema>

export const feedPageSchema = z.object({
  items: z.array(feedPostSchema),
  nextCursor: z.string().nullable(),
})
export type FeedPage = z.infer<typeof feedPageSchema>

export const POST_CORRECTIONS_PAGE_SIZE_DEFAULT = 20
export const POST_CORRECTIONS_PAGE_SIZE_MAX = 50

export const listPostCorrectionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(POST_CORRECTIONS_PAGE_SIZE_MAX)
    .default(POST_CORRECTIONS_PAGE_SIZE_DEFAULT),
})
export type ListPostCorrectionsQuery = z.infer<typeof listPostCorrectionsQuerySchema>

export const postCorrectionsPageSchema = z.object({
  /**
   * The post the corrections are of, so the screen showing them is one round
   * trip rather than two. Page one is the authority; later pages carry it too
   * rather than making the shape conditional on which page you are holding.
   */
  post: feedPostSchema,
  /**
   * Oldest first — the same order that makes the card's `topCorrection` the
   * oldest one. A correction is a reply, and replies read forwards.
   */
  items: z.array(postCorrectionSchema),
  nextCursor: z.string().nullable(),
})
export type PostCorrectionsPage = z.infer<typeof postCorrectionsPageSchema>
