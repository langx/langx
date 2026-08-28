import {
  ERROR_CODES,
  MODERATION_PAGE_SIZE_DEFAULT,
  REPORTS_TO_FREEZE_XP,
  type ModerationListQuery,
  type ReportInput,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db, type Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'

export interface Block {
  _id: ObjectId
  blockerId: string
  blockedId: string
  createdAt: Date
}

export interface Report {
  _id: ObjectId
  reporterId: string
  reportedId: string
  reason: string
  details?: string
  conversationId?: ObjectId
  /** The specific message, when the report was raised from one. */
  messageId?: ObjectId
  status: 'open' | 'reviewing' | 'actioned' | 'dismissed'
  createdAt: Date
}

function isDuplicateKeyError(error: unknown, indexName: string): boolean {
  return (
    error instanceof MongoServerError && error.code === 11000 && error.message.includes(indexName)
  )
}

/**
 * Every id the viewer must not see, in one query: people they blocked *and*
 * people who blocked them.
 *
 * This is the single source every listing filters through — discovery, the
 * conversation list, the leaderboard, profile views. Duplicating the two-sided
 * `$or` at each call site is how one of them eventually gets it half right and
 * a blocked user reappears somewhere.
 */
export async function blockedUserIds(db: Db, viewerId: string): Promise<string[]> {
  const rows = await db
    .collection<Block>(COLLECTIONS.blocks)
    .find({ $or: [{ blockerId: viewerId }, { blockedId: viewerId }] })
    .toArray()

  const ids = new Set<string>()
  for (const row of rows) {
    ids.add(row.blockerId === viewerId ? row.blockedId : row.blockerId)
  }
  return [...ids]
}

export async function blockUser(db: Db, blockerId: string, blockedId: string): Promise<Block> {
  if (blockerId === blockedId) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You cannot block yourself')
  }

  const block: Block = { _id: new ObjectId(), blockerId, blockedId, createdAt: new Date() }
  try {
    await db.collection<Block>(COLLECTIONS.blocks).insertOne(block)
  } catch (error) {
    if (isDuplicateKeyError(error, 'blocker_blocked_unique')) {
      const existing = await db
        .collection<Block>(COLLECTIONS.blocks)
        .findOne({ blockerId, blockedId })
      if (existing) return existing // idempotent: blocking twice is not an error
    }
    throw error
  }
  return block
}

export async function unblockUser(db: Db, blockerId: string, blockedId: string): Promise<void> {
  await db.collection<Block>(COLLECTIONS.blocks).deleteOne({ blockerId, blockedId })
}

export interface BlockedPage {
  items: Block[]
  nextCursor: string | null
}

/**
 * Paged. This used to have no limit at all — one query and one response body
 * sized by however many people someone had blocked.
 */
export async function listBlocked(
  db: Db,
  blockerId: string,
  query: ModerationListQuery = { limit: MODERATION_PAGE_SIZE_DEFAULT },
): Promise<BlockedPage> {
  const filter: Filter<Block> = { blockerId }
  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    filter.$or = [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }]
  }

  // One extra to know whether a next page exists without a second round trip.
  const page = await db
    .collection<Block>(COLLECTIONS.blocks)
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const items = hasMore ? page.slice(0, query.limit) : page
  const last = items.at(-1)
  return {
    items,
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}

export interface ReportResult {
  report: Report
  /** True when this report crossed the threshold and suspended the target's token. */
  xpFrozen: boolean
}

/**
 * Files a report and, past `REPORTS_TO_FREEZE_XP` *distinct* reporters,
 * suspends the target's token earning.
 *
 * Distinct reporters, not reports: otherwise one person could freeze anyone by
 * reporting them three times. Freezing stops the payout only — messages still
 * send and activity counters still move, so a human reviewer who clears the
 * report can reconcile what was withheld from history that was never lost.
 */
export async function reportUser(
  db: Db,
  reporterId: string,
  input: ReportInput,
): Promise<ReportResult> {
  if (reporterId === input.userId) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You cannot report yourself')
  }

  const reports = db.collection<Report>(COLLECTIONS.reports)
  const report: Report = {
    _id: new ObjectId(),
    reporterId,
    reportedId: input.userId,
    reason: input.reason,
    status: 'open',
    createdAt: new Date(),
  }
  if (input.details !== undefined) report.details = input.details
  if (input.conversationId !== undefined) {
    try {
      report.conversationId = new ObjectId(input.conversationId)
    } catch {
      throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed conversation id')
    }
  }
  if (input.messageId !== undefined) {
    try {
      report.messageId = new ObjectId(input.messageId)
    } catch {
      throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed message id')
    }
  }
  await reports.insertOne(report)

  const distinctReporters = await reports.distinct('reporterId', {
    reportedId: input.userId,
    status: { $in: ['open', 'reviewing'] },
  })

  let xpFrozen = false
  if (distinctReporters.length >= REPORTS_TO_FREEZE_XP) {
    const result = await db
      .collection(COLLECTIONS.profiles)
      .updateOne(
        { _id: input.userId as unknown as never, tokenFrozenAt: { $exists: false } },
        { $set: { tokenFrozenAt: new Date() } },
      )
    xpFrozen = result.modifiedCount > 0
  }

  return { report, xpFrozen }
}
