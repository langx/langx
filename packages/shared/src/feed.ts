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

/**
 * What a post is asking for, and therefore which half of the feed it lives in.
 *
 * A routing discriminator, not a content one: it decides which section shows
 * the post, which composer answers it and which endpoint that answer goes to.
 * The attachment's own kind is still derived from its content type — this does
 * not start a second habit of writing down what the bytes already say.
 *
 * Absent on every post written before this shipped, and those are all
 * corrections. The reader spells that out rather than backfilling: see the
 * `$in` in `listFeed`.
 */
export const POST_KINDS = ['correction', 'pronunciation'] as const
export type PostKind = (typeof POST_KINDS)[number]

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
  /**
   * Defaulted, so a client that predates the pronunciation section keeps
   * posting exactly what it always posted.
   */
  kind: z.enum(POST_KINDS).default('correction'),
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
 * How long a comment can be.
 *
 * The same 500 as a correction's note, because it is the same kind of writing —
 * a remark about a sentence rather than the sentence itself. One number for
 * both is easier to explain than two that differ for no reason.
 */
export const MAX_COMMENT_LENGTH = MAX_POST_NOTE_LENGTH

/**
 * A comment carries text and nothing else.
 *
 * No media: an attachment costs bytes we store forever and a comment pays
 * nothing, so it is the one place in the feed where the two do not balance. No
 * like state either — see `LIKE_TARGET_TYPES`.
 */
export const createPostCommentSchema = z.object({
  body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
})
export type CreatePostCommentInput = z.infer<typeof createPostCommentSchema>

/**
 * Two takes of the same word, and only the first is required.
 *
 * `media` is the answer; `slowMedia` is the same person saying it again,
 * deliberately slower. That second file is a re-articulation, which is a
 * different thing from the half-speed toggle on every voice note — the toggle
 * stretches a recording, a slow take is somebody choosing different sounds.
 * Optional, because an answer with one take is still an answer, and requiring
 * two would mean the request goes unanswered while somebody re-records.
 */
export const createPronunciationAnswerSchema = z.object({
  media: mediaSchema,
  slowMedia: mediaSchema.optional(),
  note: z.string().trim().min(1).max(MAX_POST_NOTE_LENGTH).optional(),
})
export type CreatePronunciationAnswerInput = z.infer<typeof createPronunciationAnswerSchema>

/**
 * What can be liked, and the discriminator that keeps one collection able to
 * hold all of it.
 *
 * A like is a signal on *content* — a sentence somebody wrote, a correction
 * somebody left, or a recording somebody made. Never on a person: this app has
 * no match gate, and a like on a profile is the first half of one.
 *
 * Comments are missing from this list on purpose. A like says "this helped",
 * and it means something on the three kinds here because each is capped at one
 * per person and each took real work. A comment is unlimited, pays nothing and
 * costs a sentence, so a like on one signals nothing about teaching and is the
 * cheapest thing in the app for two accounts to trade.
 */
export const LIKE_TARGET_TYPES = ['post', 'correction', 'answer'] as const
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

export const pronunciationAnswerSchema = z.object({
  _id: z.string(),
  author: feedAuthorSchema,
  /** The take at ordinary speed. Always present — see the input schema. */
  media: mediaSchema,
  /** The deliberate second take, if the answerer recorded one. */
  slowMedia: mediaSchema.optional(),
  note: z.string().optional(),
  likeCount: z.number().int().nonnegative(),
  likedByViewer: z.boolean(),
  createdAt: z.string(),
})
export type PronunciationAnswer = z.infer<typeof pronunciationAnswerSchema>

export const postCommentSchema = z.object({
  _id: z.string(),
  author: feedAuthorSchema,
  body: z.string(),
  createdAt: z.string(),
})
export type PostComment = z.infer<typeof postCommentSchema>

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
  /**
   * Which section the post belongs to. Filled for every post the server
   * returns, including the ones on disk that predate the field.
   */
  kind: z.enum(POST_KINDS),
  correctionCount: z.number().int(),
  /** Zero on a correction post, and the pronunciation section's sort key. */
  answerCount: z.number().int().nonnegative(),
  /**
   * Counted at read time rather than stored. Nothing sorts by it, so there is
   * no second number to drift out of step with the rows it claims to count —
   * and nothing may start sorting by it, for the reason likes may not.
   */
  commentCount: z.number().int().nonnegative(),
  /**
   * The oldest correction, which is the one the card shows. Oldest rather than
   * "best": there is no voting, and whoever answered first is the one who
   * answered — ranking by recency would bury it under every later reply.
   */
  topCorrection: postCorrectionSchema.nullable(),
  /** The oldest answer, on the same "first, not best" rule. */
  topAnswer: pronunciationAnswerSchema.nullable(),
  /** Whether the viewer has already corrected this. Drives "Add yours". */
  correctedByViewer: z.boolean(),
  /** The same, for the pronunciation section's composer. */
  answeredByViewer: z.boolean(),
  likeCount: z.number().int().nonnegative(),
  likedByViewer: z.boolean(),
  /**
   * The attachment's own kind is not written down: a post's attachment is
   * unambiguous from its content type, so `isImageContentType` derives it and
   * there is one less field to keep in step with the bytes. `kind` above is a
   * different question — what the post is asking for, which nothing in the
   * bytes can answer.
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
  /** Which section. `filter` below is read only when this is `'correction'`. */
  kind: z.enum(POST_KINDS).default('correction'),
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

export const POST_COMMENTS_PAGE_SIZE_DEFAULT = 20
export const POST_COMMENTS_PAGE_SIZE_MAX = 50

export const listPostCommentsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(POST_COMMENTS_PAGE_SIZE_MAX)
    .default(POST_COMMENTS_PAGE_SIZE_DEFAULT),
})
export type ListPostCommentsQuery = z.infer<typeof listPostCommentsQuerySchema>

export const postCommentsPageSchema = z.object({
  /**
   * No `post` echo, unlike the corrections page. Comments are never the first
   * thing a screen loads — you are already looking at the post — so the round
   * trip the corrections page saves does not exist to save here.
   */
  items: z.array(postCommentSchema),
  nextCursor: z.string().nullable(),
})
export type PostCommentsPage = z.infer<typeof postCommentsPageSchema>

export const PRONUNCIATION_ANSWERS_PAGE_SIZE_DEFAULT = 20
export const PRONUNCIATION_ANSWERS_PAGE_SIZE_MAX = 50

export const listPronunciationAnswersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PRONUNCIATION_ANSWERS_PAGE_SIZE_MAX)
    .default(PRONUNCIATION_ANSWERS_PAGE_SIZE_DEFAULT),
})
export type ListPronunciationAnswersQuery = z.infer<typeof listPronunciationAnswersQuerySchema>

export const pronunciationAnswersPageSchema = z.object({
  /** Carried for the same reason the corrections page carries it: deep links. */
  post: feedPostSchema,
  /** Oldest first, matching the corrections page. */
  items: z.array(pronunciationAnswerSchema),
  nextCursor: z.string().nullable(),
})
export type PronunciationAnswersPage = z.infer<typeof pronunciationAnswersPageSchema>
