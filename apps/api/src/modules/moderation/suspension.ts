import {
  ERROR_CODES,
  SUSPENSION_FOREVER,
  type ReportReason,
  type SuspensionStatus,
} from '@langx/shared'
import type { Db, Document, ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Report } from './blocks'
import type { Profile } from '../profiles/profiles'

/**
 * Suspension, which is one field and one comparison.
 *
 * There is no cron and nothing to sweep: a suspension is over when
 * `suspension.until` is in the past, and every read works that out for itself.
 * A permanent one stores `SUSPENSION_FOREVER` so that same comparison covers
 * it — see the note on that constant for why permanence is a date here rather
 * than a flag.
 *
 * Decisions arrive from the signed link in the report email
 * (`email/reviewToken.ts`), never from a route with a session behind it: there
 * is no moderation console, and this does not build one.
 */

/** The suspension a profile is under right now, or none. */
export function isSuspended(
  profile: Pick<Profile, 'suspension'> | null | undefined,
  now: Date = new Date(),
): boolean {
  const until = profile?.suspension?.until
  return until !== undefined && new Date(until).getTime() > now.getTime()
}

/**
 * The same question as a Mongo fragment, for the reads that must not return a
 * suspended account at all — discovery, the boosted strip, handle search and
 * the signed-out shared link.
 *
 * `$not: { $gt: now }` rather than `$lte: now`, because a field that is not
 * there has to pass: almost every profile has never been suspended and must
 * not need anything written to be visible. `$lte` matches nothing when the
 * field is missing; `$not` of a match matches it.
 */
export function notSuspended(now: Date = new Date()): Document {
  return { 'suspension.until': { $not: { $gt: now } } }
}

export interface SuspendInput {
  userId: string
  /** Days from now, or permanent — one or the other, never both. */
  days?: number
  permanent?: boolean
  reason: string
  reportId?: ObjectId
}

/**
 * Suspends an account and closes the report that led to it.
 *
 * `$set` of the whole sub-document, deliberately: a second decision replaces
 * the first, appeal included. That is the same thing the review page shows —
 * what is in force — rather than a history nothing would ever read, and it
 * means shortening a suspension does not leave a stale appeal behind that
 * would refuse the person a new one.
 */
export async function suspendUser(db: Db, input: SuspendInput): Promise<Date> {
  const now = new Date()
  const permanent = input.permanent === true
  const until = permanent
    ? new Date(SUSPENSION_FOREVER)
    : new Date(now.getTime() + (input.days ?? 0) * 24 * 60 * 60 * 1000)

  await db.collection<Profile>(COLLECTIONS.profiles).updateOne(
    { _id: input.userId },
    {
      $set: {
        suspension: {
          at: now,
          until,
          permanent,
          reason: input.reason,
          ...(input.reportId ? { reportId: input.reportId } : {}),
        },
      },
    },
  )

  if (input.reportId) {
    await db
      .collection<Report>(COLLECTIONS.reports)
      .updateOne({ _id: input.reportId }, { $set: { status: 'actioned' } })
  }
  return until
}

export async function dismissReport(db: Db, reportId: ObjectId): Promise<void> {
  await db
    .collection<Report>(COLLECTIONS.reports)
    .updateOne({ _id: reportId }, { $set: { status: 'dismissed' } })
}

/** Moves the end date in, leaving everything else — the reason, the appeal — as it was. */
export async function shortenSuspension(db: Db, userId: string, days: number): Promise<Date> {
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne(
      { _id: userId },
      { $set: { 'suspension.until': until, 'suspension.permanent': false } },
    )
  return until
}

/**
 * Lifts it entirely, by removing the record.
 *
 * `$unset` rather than a past date: the person is not "suspended until
 * yesterday", they are not suspended, and leaving the sub-document behind
 * would keep an appeal on file that refuses them a second one if this ever
 * happens again.
 */
export async function liftSuspension(db: Db, userId: string): Promise<void> {
  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne({ _id: userId }, { $unset: { suspension: '' } })
}

/**
 * Stores the one appeal.
 *
 * One per suspension, temporary and permanent alike. The filter is what
 * enforces it — not a read followed by a write — so two taps that race cannot
 * both land, and the second is told why rather than silently overwriting the
 * first.
 */
export async function submitAppeal(db: Db, userId: string, text: string): Promise<Date> {
  const at = new Date()
  const result = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne(
      { _id: userId, suspension: { $exists: true }, 'suspension.appeal': { $exists: false } },
      { $set: { 'suspension.appeal': { at, text } } },
    )
  if (result.matchedCount === 0) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You have already appealed this suspension')
  }
  return at
}

/** What the suspended person is told about their own suspension. */
export function suspensionStatus(
  profile: Pick<Profile, 'suspension'> | null | undefined,
  now: Date = new Date(),
): SuspensionStatus {
  const suspension = profile?.suspension
  if (!suspension || !isSuspended(profile, now)) {
    return { suspended: false, until: null, permanent: false, reason: null, appealedAt: null }
  }
  return {
    suspended: true,
    // The sentinel is ours, not theirs: permanent says `null` and the app
    // words it, rather than shipping a date no screen should ever print.
    until: suspension.permanent ? null : new Date(suspension.until).toISOString(),
    permanent: suspension.permanent,
    reason: (suspension.reason as ReportReason) || null,
    appealedAt: suspension.appeal ? new Date(suspension.appeal.at).toISOString() : null,
  }
}
