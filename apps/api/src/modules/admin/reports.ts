import type { AdminReportListQuery, ReportStatus } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Report } from '../moderation/blocks'
import type { Post } from '../feed/feed'
import type { Profile } from '../profiles/profiles'

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
}

export interface AdminReportDetail extends AdminReportRow {
  /**
   * The post, read unfiltered — this is the one reader that must still find a
   * post it has already hidden. Everything else treats hidden as missing.
   */
  post: { id: string; body: string; language: string; hiddenAt: string | null } | null
  /** What is in force on the reported account right now. */
  suspension: Profile['suspension'] | null
  /** Other reports against the same account still waiting, this one excluded. */
  otherOpenReports: number
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

  const [parties, post, reported, otherOpenReports] = await Promise.all([
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
  ])

  return {
    ...toRow(report, parties),
    post: post
      ? {
          id: post._id.toHexString(),
          body: post.body,
          language: post.language,
          hiddenAt: post.hiddenAt ? post.hiddenAt.toISOString() : null,
        }
      : null,
    suspension: reported?.suspension ?? null,
    otherOpenReports,
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
