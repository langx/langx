import type { AdminActionName } from '@langx/shared'
import type { Db, ObjectId } from 'mongodb'
import type { FastifyBaseLogger } from 'fastify'
import { COLLECTIONS } from '../../db/collections'

/**
 * What an operator did, kept.
 *
 * The emailed flow left a trace by accident: the decision, the reasoning and
 * the person were all in a mail thread that nobody deletes. A panel replaces
 * that with nothing at all, so the trace has to be written on purpose or a
 * suspension becomes unexplainable a year later — which is exactly when
 * somebody asks.
 *
 * Append-only, no TTL, and **not purged when the subject deletes their
 * account**. What is stored about them is an opaque id; the row is the record
 * of a decision we made, not data we hold about a person.
 */
export interface AdminAction {
  _id: ObjectId
  adminId: string
  action: AdminActionName
  /** Who it was about, when it was about somebody. */
  subjectUserId?: string
  /** The report, feedback row or broadcast it concerned. */
  refId?: string
  /** Days, amounts, reasons — never a message body. */
  payload?: Record<string, unknown>
  at: Date
}

/**
 * Records an action **after** it succeeded, and never fails the route.
 *
 * Best-effort on purpose, and the reason is worth keeping in front of whoever
 * changes this: the repository functions underneath are shared with the
 * emailed flow, which has no admin to name. By the time this is called the
 * suspension is already written. An audit write that could throw would turn a
 * decision that landed into a 500 that invites the button being pressed again.
 */
export async function recordAdminAction(
  db: Db,
  log: FastifyBaseLogger,
  entry: Omit<AdminAction, '_id' | 'at'>,
): Promise<void> {
  try {
    await db.collection<AdminAction>(COLLECTIONS.adminActions).insertOne({
      ...entry,
      at: new Date(),
    } as AdminAction)
  } catch (error) {
    log.warn({ err: error, action: entry.action }, 'admin action not recorded')
  }
}

/**
 * What has been done to one account, newest first.
 *
 * Read by the user screen, because an audit log nobody reads is theatre —
 * the point of writing it is that the next question about this account has an
 * answer on the same screen as the account.
 */
export async function readAdminActions(
  db: Db,
  subjectUserId: string,
  limit = 20,
): Promise<AdminAction[]> {
  return db
    .collection<AdminAction>(COLLECTIONS.adminActions)
    .find({ subjectUserId })
    .sort({ at: -1 })
    .limit(limit)
    .toArray()
}
