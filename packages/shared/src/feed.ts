import { z } from 'zod'
import { languageCodeSchema } from './languages'
import { languageLevelSchema } from './level'

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

export const createPostSchema = z.object({
  body: postBodySchema,
  /** What language the sentence is in — the one the author is learning. */
  language: languageCodeSchema,
})
export type CreatePostInput = z.infer<typeof createPostSchema>

export const createPostCorrectionSchema = z.object({
  corrected: postBodySchema,
  note: z.string().trim().min(1).max(MAX_POST_NOTE_LENGTH).optional(),
})
export type CreatePostCorrectionInput = z.infer<typeof createPostCorrectionSchema>

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
  createdAt: z.string(),
})
export type PostCorrection = z.infer<typeof postCorrectionSchema>

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
  createdAt: z.string(),
})
export type FeedPost = z.infer<typeof feedPostSchema>

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
