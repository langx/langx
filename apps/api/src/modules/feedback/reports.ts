import type { AdminFeedbackListQuery, FeedbackKind } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

/**
 * A bug report or an idea, as a row somebody can close.
 *
 * `routes/feedback.ts` argued against this collection, and the argument was
 * right at the time: *"a copy of a decision taken in an inbox, with no screen
 * in the app able to close a row and nobody looking at the ones left open"*.
 * Three things answer it now.
 *
 * The row is not a copy — the decision is made in the panel, and the mailbox
 * is the fallback. The row and the emailed link are the **same object**: the
 * `_id` here is the `randomUUID()` `submit.ts` already minted, which is also
 * the bounty token's `reportId` and the ledger's `refId`, so paying from the
 * panel and paying from a six-week-old forwarded mail are physically the same
 * payment — enforced by `tokenLedger`'s unique index, not by a check. And the
 * queue is ordered oldest-open-first, so the thing nobody has closed is the
 * first thing the screen shows.
 *
 * No TTL. A bug report is evidence; expiring it on a timer is how the oldest
 * open one disappears instead of getting fixed.
 */
export interface FeedbackReport {
  /** The uuid `submit.ts` mints — also the bounty token's `reportId`. */
  _id: string
  userId: string
  kind: FeedbackKind
  body: string
  attachmentUrls: string[]
  /**
   * The prefilled GitHub new-issue link at submit; replaced with the real
   * issue's URL once somebody files it.
   */
  issueUrl?: string
  status: FeedbackStatus
  /** A mirror of the ledger row, never the authority on whether it paid. */
  bounty?: { amount: number; at: Date }
  closedAt?: Date
  closedBy?: string
  closeReason?: FeedbackCloseReason
  note?: string
  createdAt: Date
}

export type FeedbackStatus = 'open' | 'triaged' | 'closed'
export type FeedbackCloseReason = 'fixed' | 'shipped' | 'wontfix' | 'duplicate' | 'invalid'

export interface FeedbackRow extends Omit<FeedbackReport, 'createdAt' | 'bounty' | 'closedAt'> {
  createdAt: string
  bounty: { amount: number; at: string } | null
  closedAt: string | null
  sender: { userId: string; handle: string | null; displayName: string | null }
}

export async function recordFeedback(
  db: Db,
  report: Omit<FeedbackReport, 'status' | 'createdAt'>,
): Promise<void> {
  await db
    .collection<FeedbackReport>(COLLECTIONS.feedback)
    .insertOne({ ...report, status: 'open', createdAt: new Date() })
}

/**
 * Oldest first, deliberately.
 *
 * Every other list in this codebase is newest-first because every other list
 * is a feed. This one is a queue, and the row that matters most is the one
 * that has been waiting longest — which is also why the index is ascending.
 */
export async function listFeedback(
  db: Db,
  query: AdminFeedbackListQuery,
): Promise<{ items: FeedbackRow[]; nextCursor: string | null }> {
  const rows = await db
    .collection<FeedbackReport>(COLLECTIONS.feedback)
    .find({
      status: query.status,
      ...(query.cursor ? { createdAt: { $gt: new Date(query.cursor) } } : {}),
    })
    .sort({ createdAt: 1 })
    .limit(query.limit + 1)
    .toArray()

  const page = rows.slice(0, query.limit)
  return {
    items: await withSenders(db, page),
    nextCursor: rows.length > query.limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
  }
}

export async function getFeedback(db: Db, id: string): Promise<FeedbackRow | null> {
  const row = await db.collection<FeedbackReport>(COLLECTIONS.feedback).findOne({ _id: id })
  if (!row) return null
  return (await withSenders(db, [row]))[0] ?? null
}

export interface FeedbackUpdate {
  status?: FeedbackStatus
  issueUrl?: string
  closeReason?: FeedbackCloseReason
  note?: string
}

export async function updateFeedback(
  db: Db,
  id: string,
  update: FeedbackUpdate,
  byAdminId: string,
): Promise<FeedbackReport | null> {
  const closing = update.status === 'closed'
  return db.collection<FeedbackReport>(COLLECTIONS.feedback).findOneAndUpdate(
    { _id: id },
    {
      $set: {
        ...update,
        ...(closing ? { closedAt: new Date(), closedBy: byAdminId } : {}),
      },
    },
    { returnDocument: 'after' },
  )
}

/**
 * Marks a report as paid for.
 *
 * Called only when the ledger says the award actually happened, so a second
 * press of either door changes nothing here either. `triaged` rather than
 * `closed`: paying says the report was real, not that the fix has shipped.
 */
export async function markFeedbackPaid(db: Db, id: string, amount: number): Promise<void> {
  await db
    .collection<FeedbackReport>(COLLECTIONS.feedback)
    .updateOne({ _id: id }, { $set: { status: 'triaged', bounty: { amount, at: new Date() } } })
}

async function withSenders(db: Db, rows: FeedbackReport[]): Promise<FeedbackRow[]> {
  const ids = [...new Set(rows.map((row) => row.userId))]
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ _id: { $in: ids } }, { projection: { handle: 1, displayName: 1 } })
    .toArray()
  const byId = new Map(profiles.map((profile) => [profile._id, profile]))

  return rows.map((row) => {
    const profile = byId.get(row.userId)
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      bounty: row.bounty ? { amount: row.bounty.amount, at: row.bounty.at.toISOString() } : null,
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      sender: {
        userId: row.userId,
        handle: profile?.handle ?? null,
        displayName: profile?.displayName ?? null,
      },
    }
  })
}
