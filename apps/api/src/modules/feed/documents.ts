import type { Media } from '@langx/shared'
import type { ObjectId } from 'mongodb'

/**
 * The shapes stored in the feed's four collections.
 *
 * Their own file so that `comments.ts` and `pronunciation.ts` can name a post
 * without importing `feed.ts`, which imports them back for the page summaries.
 * A type-only cycle would erase, but the DTO builders in `dto.ts` are values
 * and would not.
 */

export interface Post {
  _id: ObjectId
  authorId: string
  body: string
  language: string
  /**
   * Which half of the feed this belongs to, and **absent on every post written
   * before the pronunciation section shipped** — those are all corrections.
   *
   * Optional here and required on the DTO: the reader fills the gap
   * (`post.kind ?? 'correction'`) rather than a migration doing it, and the
   * correction section's query matches `{ $in: ['correction', null] }`. Writes
   * always set it explicitly, so the absence only ever shrinks.
   */
  kind?: 'correction' | 'pronunciation'
  /**
   * Denormalized, and one of the two numbers here that are. It is the sort key
   * for the correction queue, and an index cannot sort on a count it would
   * have to join to find. Written only by `$inc` inside the same call that
   * inserts the correction, so it cannot drift the way a periodically-rebuilt
   * counter would.
   */
  correctionCount: number
  /**
   * The same bargain as `correctionCount`, for the pronunciation section's
   * queue. Written only on `kind: 'pronunciation'` posts; a legacy post has
   * neither this nor `kind`, which is safe only because a legacy post never
   * appears on the tab that sorts by it.
   */
  answerCount?: number
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

export interface PronunciationAnswerDoc {
  _id: ObjectId
  postId: ObjectId
  authorId: string
  /** The take at ordinary speed. Required, unlike the one below. */
  media: Media
  /** A deliberate second, slower take. Two files, one quota unit. */
  slowMedia?: Media
  note?: string
  createdAt: Date
}

export interface PostCommentDoc {
  _id: ObjectId
  postId: ObjectId
  authorId: string
  body: string
  createdAt: Date
}
