import {
  DEFAULT_LOCALE,
  matchLocale,
  type AdminFeedbackListQuery,
  type CopilotAction,
  type CopilotReportRequest,
  type FeedbackKind,
  type Locale,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { translator } from '../../i18n'
import type { Profile } from '../profiles/profiles'
import { isFiledIssue } from './githubIssue'

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
  kind: FeedbackRowKind
  /** For `copilot`, the answer being reported. */
  body: string
  attachmentUrls: string[]
  /** Only on a `copilot` row: which help answered, and the draft, when they chose to send it. */
  copilot?: { action: CopilotAction; question?: string }
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
  /** When the panel last wrote back to the sender about it. */
  repliedAt?: Date
  createdAt: Date
}

/**
 * What a row is. `bug` and `feature` are what `POST /feedback` takes;
 * `copilot` is a reported AI answer, which only `POST /copilot/report` writes
 * — never a choice on the feedback form, and never a GitHub issue, because
 * the tracker is public and an answer is about somebody's chat.
 */
export type FeedbackRowKind = FeedbackKind | 'copilot'

export type FeedbackStatus = 'open' | 'triaged' | 'closed'
export type FeedbackCloseReason = 'fixed' | 'shipped' | 'wontfix' | 'duplicate' | 'invalid'

export interface FeedbackRow extends Omit<
  FeedbackReport,
  'createdAt' | 'bounty' | 'closedAt' | 'repliedAt'
> {
  createdAt: string
  bounty: { amount: number; at: string } | null
  closedAt: string | null
  repliedAt: string | null
  sender: { userId: string; handle: string | null; displayName: string | null }
  /** A thank-you in the sender's language, with the issue's link once there is one. */
  replyDraft: string
}

/**
 * What the panel offers to send back, in the sender's native language — the
 * rule `localeFor` gives every server-worded text, since a reply is read like
 * a mail rather than like a screen.
 */
export function replyDraft(
  locale: Locale,
  report: Pick<FeedbackReport, 'kind' | 'issueUrl'>,
): string {
  const t = translator(locale)
  const lines = [t(`feedbackReply.${report.kind}`)]
  if (isFiledIssue(report.issueUrl)) lines.push(t('feedbackReply.issue', { url: report.issueUrl }))
  return lines.join('\n\n')
}

/**
 * Marks a report as answered. The status stays where it is: the panel's
 * `triaged` tab reads "Paid", and writing back is not paying.
 */
export async function markFeedbackReplied(db: Db, id: string): Promise<void> {
  await db
    .collection<FeedbackReport>(COLLECTIONS.feedback)
    .updateOne({ _id: id }, { $set: { repliedAt: new Date() } })
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
 * A reported Copilot answer, as a row in the same queue as bugs and ideas.
 *
 * The same queue because it is the same job — read it, decide, close it,
 * perhaps write back — and the account purge already sweeps `feedback` by
 * `userId`, so a report goes when its sender does. What it does not share is
 * the rest of `submitFeedback`: no issue (the tracker is public), no bounty
 * link (a token for every answer somebody disliked is a farm), and no mail —
 * the person's draft, when they sent it, lives in this row and nowhere else.
 */
export async function recordCopilotReport(
  db: Db,
  userId: string,
  report: CopilotReportRequest,
): Promise<string> {
  const id = randomUUID()
  await recordFeedback(db, {
    _id: id,
    userId,
    kind: 'copilot',
    body: report.answer,
    attachmentUrls: [],
    copilot: {
      action: report.action,
      ...(report.question !== undefined ? { question: report.question } : {}),
    },
  })
  return id
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
    .find(
      { _id: { $in: ids } },
      { projection: { handle: 1, displayName: 1, 'nativeLanguages.code': 1 } },
    )
    .toArray()
  const byId = new Map(profiles.map((profile) => [profile._id, profile]))

  return rows.map((row) => {
    const profile = byId.get(row.userId)
    const locale =
      matchLocale((profile?.nativeLanguages ?? []).map((language) => language.code)) ??
      DEFAULT_LOCALE
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      bounty: row.bounty ? { amount: row.bounty.amount, at: row.bounty.at.toISOString() } : null,
      closedAt: row.closedAt ? row.closedAt.toISOString() : null,
      repliedAt: row.repliedAt ? row.repliedAt.toISOString() : null,
      replyDraft: replyDraft(locale, row),
      sender: {
        userId: row.userId,
        handle: profile?.handle ?? null,
        displayName: profile?.displayName ?? null,
      },
    }
  })
}
