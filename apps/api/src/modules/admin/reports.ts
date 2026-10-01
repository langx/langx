import {
  asksOf,
  attachmentsOf,
  type AdminReportListQuery,
  type Media,
  type PostAsk,
  type ReportStatus,
} from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Report } from '../moderation/blocks'
import type { PostCommentDoc } from '../feed/documents'
import type { Post } from '../feed/feed'
import type { Profile } from '../profiles/profiles'
import { findTestimonialById } from '../testimonials/testimonials'

/**
 * The two queues the panel works through: reports, and appeals against what
 * was decided about them.
 *
 * Reads only. Every decision goes through `moderation/decide.ts`, which the
 * emailed link uses too — a list that could also decide things would be the
 * second implementation this whole arrangement exists to avoid.
 */

/** As much of somebody as a queue row needs. */
export interface AdminParty {
  userId: string
  handle: string | null
  displayName: string | null
  avatarUrl: string | null
  suspended: boolean
}

export interface AdminReportRow {
  id: string
  reason: string
  details: string | null
  status: ReportStatus
  createdAt: string
  reported: AdminParty
  reporter: AdminParty
  /** Whether the report named a post, so the list can say so without loading it. */
  aboutPost: boolean
  /** The same, for a report raised from a comment. */
  aboutComment: boolean
  /** The same, for a report raised from a review on somebody's profile. */
  aboutTestimonial: boolean
  /** Whether @langx warned the account over this report. */
  warned: boolean
}

/**
 * A reported comment as the panel judges it: its words, whether they are still
 * up, and where it was said. Read unfiltered, like the post beside it.
 */
export interface AdminReportedComment {
  id: string
  /** `null` once its author removed the words and replies kept the row. */
  body: string | null
  postId: string
  /** The opening of the post it sits under, for context; not what is judged. */
  postBody: string | null
  /** Whether it is a reply in a thread rather than a comment on the post. */
  isReply: boolean
  hiddenAt: string | null
}

/**
 * A reported review ("testimonial"). Its author is always the reported person
 * — `reportUser` checks — so only the profile it sits on is named here. Both
 * hidden states, because they mean different things: the owner's is theirs to
 * undo, the moderator's is not.
 */
export interface AdminReportedTestimonial {
  id: string
  body: string
  /** Whose profile it is on. */
  subject: AdminParty
  createdAt: string
  editedAt: string | null
  ownerHiddenAt: string | null
  moderatorHiddenAt: string | null
}

export interface AdminReportDetail extends AdminReportRow {
  /**
   * The post, read unfiltered — this is the one reader that must still find a
   * post it has already hidden. Everything else treats hidden as missing.
   */
  post: {
    id: string
    /** `''` for a photo or a video posted without words; never absent. */
    body: string
    language: string
    hiddenAt: string | null
    /**
     * Every file, so a report about a picture can be judged from the picture.
     * Always a list — empty for a post that had none — so the panel needs no
     * second question about which field an older row kept its file in.
     */
    attachments: Media[]
    /** What it asked for; empty for a moment. */
    asks: PostAsk[]
  } | null
  /** The comment, when the report named one. Never beside `post` — see `Report.commentId`. */
  comment: AdminReportedComment | null
  /** The review, when the report named one. Never beside `post` or `comment`. */
  testimonial: AdminReportedTestimonial | null
  /** What is in force on the reported account right now. */
  suspension: Profile['suspension'] | null
  /** Other reports against the same account still waiting, this one excluded. */
  otherOpenReports: number
  /** What the reporter was thanked with, or `null` while they have not been. */
  reward: { amount: number; at: string } | null
  /** When @langx warned the account over this report, or `null`. */
  warning: { at: string } | null
  /**
   * Warnings the same account was sent over its other reports, newest first —
   * the panel's "already warned", so a second report reaches for the next
   * rung rather than the first one again.
   */
  earlierWarnings: { at: string; reason: string }[]
}

export interface AdminAppealRow {
  userId: string
  handle: string | null
  displayName: string | null
  text: string
  appealedAt: string
  until: string | null
  permanent: boolean
  reason: string
  /** The report the suspension was decided from, when there was one. */
  reportId: string | null
}

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

function party(userId: string, profile: Profile | null, now: Date): AdminParty {
  const until = profile?.suspension?.until
  return {
    userId,
    handle: profile?.handle ?? null,
    displayName: profile?.displayName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    suspended: until !== undefined && new Date(until).getTime() > now.getTime(),
  }
}

/**
 * Both people on every row, in one query rather than two per row.
 *
 * A page is thirty reports, which is sixty ids and — before this — sixty point
 * reads. The same `$in` shape `pool.ts` was rewritten into for the same
 * reason.
 */
async function partiesFor(db: Db, ids: string[], now: Date): Promise<Map<string, AdminParty>> {
  const unique = [...new Set(ids)]
  const rows = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      { _id: { $in: unique } },
      { projection: { handle: 1, displayName: 1, avatarUrl: 1, suspension: 1 } },
    )
    .toArray()
  const byId = new Map(rows.map((row) => [row._id, row]))
  return new Map(unique.map((id) => [id, party(id, byId.get(id) ?? null, now)]))
}

/**
 * One status at a time, newest first — served by the `status_created` index
 * that has been on `reports` since the collection existed and had no reader.
 *
 * The cursor is the `_id` of the last row, which for an ObjectId sorts the
 * same way `createdAt` does.
 */
export async function listReports(
  db: Db,
  query: AdminReportListQuery,
  now: Date = new Date(),
): Promise<Page<AdminReportRow>> {
  const cursor = query.cursor ? toObjectId(query.cursor) : null
  const rows = await db
    .collection<Report>(COLLECTIONS.reports)
    .find({
      status: query.status,
      ...(cursor ? { _id: { $lt: cursor } } : {}),
    })
    .sort({ _id: -1 })
    .limit(query.limit + 1)
    .toArray()

  const page = rows.slice(0, query.limit)
  const parties = await partiesFor(
    db,
    page.flatMap((row) => [row.reportedId, row.reporterId]),
    now,
  )

  return {
    items: page.map((row) => toRow(row, parties)),
    nextCursor: rows.length > query.limit ? (page.at(-1)?._id.toHexString() ?? null) : null,
  }
}

export async function getReport(
  db: Db,
  id: string,
  now: Date = new Date(),
): Promise<AdminReportDetail | null> {
  const reportId = toObjectId(id)
  if (!reportId) return null
  const report = await db.collection<Report>(COLLECTIONS.reports).findOne({ _id: reportId })
  if (!report) return null

  const [parties, post, reported, otherOpenReports, earlierWarnings] = await Promise.all([
    partiesFor(db, [report.reportedId, report.reporterId], now),
    report.postId
      ? db.collection<Post>(COLLECTIONS.posts).findOne({ _id: report.postId })
      : Promise.resolve(null),
    db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: report.reportedId }),
    db.collection<Report>(COLLECTIONS.reports).countDocuments({
      reportedId: report.reportedId,
      status: { $in: ['open', 'reviewing'] },
      _id: { $ne: reportId },
    }),
    db
      .collection<Report>(COLLECTIONS.reports)
      .find(
        { reportedId: report.reportedId, warning: { $exists: true }, _id: { $ne: reportId } },
        { projection: { reason: 1, warning: 1 } },
      )
      .sort({ 'warning.at': -1 })
      .limit(10)
      .toArray(),
  ])

  return {
    ...toRow(report, parties),
    comment: await readComment(db, report.commentId),
    testimonial: await readTestimonial(db, report.testimonialId, now),
    post: post
      ? {
          id: post._id.toHexString(),
          body: post.body,
          language: post.language,
          hiddenAt: post.hiddenAt ? post.hiddenAt.toISOString() : null,
          attachments: attachmentsOf(post),
          asks: asksOf(post),
        }
      : null,
    suspension: reported?.suspension ?? null,
    otherOpenReports,
    reward: report.reward
      ? { amount: report.reward.amount, at: report.reward.at.toISOString() }
      : null,
    warning: report.warning ? { at: report.warning.at.toISOString() } : null,
    earlierWarnings: earlierWarnings.flatMap((row) =>
      row.warning ? [{ at: row.warning.at.toISOString(), reason: row.reason }] : [],
    ),
  }
}

/**
 * Appeals nobody has answered.
 *
 * `decidedAt` is what takes a row out of this list, and until `closeAppeal`
 * existed nothing wrote it — so an appeal that was read and refused looked
 * exactly like one that had never been opened. Served by the partial
 * `appeal_recent` index.
 */
export async function listAppeals(
  db: Db,
  query: AdminReportListQuery,
): Promise<Page<AdminAppealRow>> {
  const rows = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      {
        'suspension.appeal.at': { $exists: true },
        'suspension.appeal.decidedAt': { $exists: false },
        ...(query.cursor ? { 'suspension.appeal.at': { $lt: new Date(query.cursor) } } : {}),
      },
      { projection: { handle: 1, displayName: 1, suspension: 1 } },
    )
    .sort({ 'suspension.appeal.at': -1 })
    .limit(query.limit + 1)
    .toArray()

  const page = rows.slice(0, query.limit)
  return {
    items: page.flatMap((row) => {
      const suspension = row.suspension
      const appeal = suspension?.appeal
      if (!suspension || !appeal) return []
      return [
        {
          userId: row._id,
          handle: row.handle ?? null,
          displayName: row.displayName ?? null,
          text: appeal.text,
          appealedAt: new Date(appeal.at).toISOString(),
          until: suspension.permanent ? null : new Date(suspension.until).toISOString(),
          permanent: suspension.permanent,
          reason: suspension.reason,
          reportId: suspension.reportId?.toHexString() ?? null,
        },
      ]
    }),
    nextCursor:
      rows.length > query.limit
        ? (page.at(-1)?.suspension?.appeal?.at.toISOString() ?? null)
        : null,
  }
}

function toRow(report: Report, parties: Map<string, AdminParty>): AdminReportRow {
  const unknown = (userId: string): AdminParty => ({
    userId,
    handle: null,
    displayName: null,
    avatarUrl: null,
    suspended: false,
  })
  return {
    id: report._id.toHexString(),
    reason: report.reason,
    details: report.details ?? null,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
    reported: parties.get(report.reportedId) ?? unknown(report.reportedId),
    reporter: parties.get(report.reporterId) ?? unknown(report.reporterId),
    aboutPost: report.postId !== undefined,
    aboutComment: report.commentId !== undefined,
    aboutTestimonial: report.testimonialId !== undefined,
    warned: report.warning !== undefined,
  }
}

async function readComment(
  db: Db,
  commentId: ObjectId | undefined,
): Promise<AdminReportedComment | null> {
  if (!commentId) return null
  const comment = await db
    .collection<PostCommentDoc>(COLLECTIONS.postComments)
    .findOne({ _id: commentId })
  if (!comment) return null
  const post = await db
    .collection<Post>(COLLECTIONS.posts)
    .findOne({ _id: comment.postId }, { projection: { body: 1 } })
  return {
    id: comment._id.toHexString(),
    body: comment.deletedAt ? null : (comment.body ?? null),
    postId: comment.postId.toHexString(),
    postBody: post?.body ?? null,
    isReply: comment.parentId !== undefined,
    hiddenAt: comment.hiddenAt ? comment.hiddenAt.toISOString() : null,
  }
}

/** Read unfiltered: the panel must still find one a moderator already hid. */
async function readTestimonial(
  db: Db,
  testimonialId: ObjectId | undefined,
  now: Date,
): Promise<AdminReportedTestimonial | null> {
  if (!testimonialId) return null
  const testimonial = await findTestimonialById(db, testimonialId)
  if (!testimonial) return null
  const parties = await partiesFor(db, [testimonial.subjectId], now)
  return {
    id: testimonial._id.toHexString(),
    body: testimonial.body,
    subject: parties.get(testimonial.subjectId) ?? party(testimonial.subjectId, null, now),
    createdAt: testimonial.createdAt.toISOString(),
    editedAt: testimonial.editedAt ? testimonial.editedAt.toISOString() : null,
    ownerHiddenAt: testimonial.ownerHiddenAt ? testimonial.ownerHiddenAt.toISOString() : null,
    moderatorHiddenAt: testimonial.moderatorHiddenAt
      ? testimonial.moderatorHiddenAt.toISOString()
      : null,
  }
}

/** An id that came out of a URL. `new ObjectId` throws on anything else. */
export function toObjectId(value: string | null | undefined): ObjectId | null {
  if (!value) return null
  try {
    return new ObjectId(value)
  } catch {
    return null
  }
}
