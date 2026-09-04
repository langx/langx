import {
  attachmentsOf,
  languageLevelSchema,
  type FeedPost,
  type PostComment,
  type PostCorrection,
  type Media,
  type PronunciationAnswer,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { likeStateOf, type LikeSummary } from './likes'
import type { Post, PostCommentDoc, PostCorrectionDoc, PronunciationAnswerDoc } from './documents'

export type AuthorMap = Map<string, Profile>

export async function loadAuthors(db: Db, ids: string[]): Promise<AuthorMap> {
  if (ids.length === 0) return new Map()
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ _id: { $in: [...new Set(ids)] } })
    .toArray()
  return new Map(profiles.map((profile) => [profile._id, profile]))
}

/**
 * Both attachment fields, normalised.
 *
 * `attachments` is what a client should read; `media` stays beside it as the
 * first file so a build that predates the list still shows something. See
 * `attachmentsOf`.
 */
function attachmentFields(doc: { attachments?: Media[]; media?: Media }): {
  attachments?: Media[]
  media?: Media
} {
  const attachments = attachmentsOf(doc)
  if (attachments.length === 0) return {}
  return { attachments, ...(attachments[0] ? { media: attachments[0] } : {}) }
}

export function authorDto(profile: Profile | undefined, id: string): FeedPost['author'] {
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

export function correctionDto(
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
    ...attachmentFields(doc),
    createdAt: doc.createdAt.toISOString(),
  }
}

export function answerDto(
  doc: PronunciationAnswerDoc,
  authors: AuthorMap,
  likes: LikeSummary,
): PronunciationAnswer {
  return {
    _id: doc._id.toHexString(),
    author: authorDto(authors.get(doc.authorId), doc.authorId),
    media: doc.media,
    ...(doc.slowMedia ? { slowMedia: doc.slowMedia } : {}),
    ...(doc.note ? { note: doc.note } : {}),
    ...likeStateOf(likes, 'answer', doc._id),
    createdAt: doc.createdAt.toISOString(),
  }
}

export function commentDto(doc: PostCommentDoc, authors: AuthorMap): PostComment {
  return {
    _id: doc._id.toHexString(),
    author: authorDto(authors.get(doc.authorId), doc.authorId),
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
  }
}

export interface PostDtoContext {
  authors: AuthorMap
  top: PostCorrectionDoc | null
  topAnswer: PronunciationAnswerDoc | null
  correctedByViewer: boolean
  answeredByViewer: boolean
  commentCount: number
  likes: LikeSummary
}

export function postDto(post: Post, context: PostDtoContext): FeedPost {
  const profile = context.authors.get(post.authorId)
  return {
    _id: post._id.toHexString(),
    author: authorDto(profile, post.authorId),
    body: post.body,
    language: post.language,
    level: levelOf(profile, post.language),
    // The gap a missing field leaves is filled here, once, rather than by a
    // backfill: every post that predates the field is a correction post.
    kind: post.kind ?? 'correction',
    correctionCount: post.correctionCount,
    answerCount: post.answerCount ?? 0,
    commentCount: context.commentCount,
    topCorrection: context.top ? correctionDto(context.top, context.authors, context.likes) : null,
    topAnswer: context.topAnswer
      ? answerDto(context.topAnswer, context.authors, context.likes)
      : null,
    correctedByViewer: context.correctedByViewer,
    answeredByViewer: context.answeredByViewer,
    ...likeStateOf(context.likes, 'post', post._id),
    ...attachmentFields(post),
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
