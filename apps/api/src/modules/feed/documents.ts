import type { Media } from '@langx/shared'
import type { Document, ObjectId } from 'mongodb'

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
  /**
   * Everything attached, in the order it was picked. Read through
   * `attachmentsOf` — a post written before the field has only `media`.
   */
  attachments?: Media[]
  /** The first of `attachments`, repeated for builds that predate the list. */
  media?: Media
  /**
   * When a moderator hid this post from the report email, or absent — which is
   * almost every post, and why this is a missing field rather than a `false`.
   *
   * Hidden, not deleted: the row and its attachments stay exactly where they
   * are and the same link puts it back. Every read that can surface a post to
   * somebody filters on it, **including the author's own list** — the decision
   * is silent, so a post that is still visible to the person who wrote it
   * would be a different feature wearing this one's name.
   *
   * A date rather than a flag because "when" is the only question anyone asks
   * afterwards, and it costs the same to store.
   */
  hiddenAt?: Date
  createdAt: Date
}

/**
 * "Not hidden by a moderator", as a Mongo fragment — the one every read that
 * can put a post in front of somebody spreads into its filter.
 *
 * `$exists: false` rather than `$ne: true`, and the difference is the same one
 * `listFeed` makes over `kind`: a missing field has to pass, because that is
 * every post there has ever been. It is a residual filter either way — the
 * bounds still come from the compound index's leading keys — and that costs
 * nothing worth naming, since the documents it rejects are a handful in the
 * whole collection.
 */
export function notHidden(): Document {
  return { hiddenAt: { $exists: false } }
}

export interface PostCorrectionDoc {
  _id: ObjectId
  postId: ObjectId
  authorId: string
  corrected: string
  note?: string
  /** As on a post: the list, and its first item repeated. */
  attachments?: Media[]
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
