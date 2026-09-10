import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { claimOnce } from './ledger'

const HOUR_MS = 60 * 60 * 1000

/**
 * How long to wait before asking again. A day: long enough that somebody who
 * simply put their phone down has had the evening to come back, short enough
 * that the account is still a thing they remember starting.
 */
export const VERIFY_REMINDER_AFTER_HOURS = 24

/**
 * And the far end. A week-old unverified account is not somebody who missed
 * the mail; it is somebody who changed their mind, or an address that was
 * never theirs. Either way a second letter is the last one.
 */
export const VERIFY_REMINDER_MAX_AGE_HOURS = 24 * 7

interface UserRow {
  _id: unknown
  email?: string
  emailVerified?: boolean
  isAnonymous?: boolean
  createdAt?: Date
  precreatedFromV1?: unknown
}

/**
 * One more attempt at the mail that gets lost most often.
 *
 * The verification link is the first thing this domain ever writes to a new
 * address, which is precisely when a spam folder is most willing to take it —
 * and an account that never verifies can do nothing at all: onboarding is
 * behind `requireVerifiedEmail`.
 *
 * **Exactly once per account**, claimed in the ledger before the send. Not
 * once per day: an unverified account that hears from us daily is a
 * complaint, and the complaint lands on the domain every *other* mail leaves
 * from.
 *
 * Sends nothing to a guest (their address resolves nowhere), nothing to a
 * pre-created v1 row (those are verified by the script and their owner has a
 * different letter waiting), and nothing to an account older than
 * `VERIFY_REMINDER_MAX_AGE_HOURS`, so switching this on does not write to
 * every abandoned sign-up this app has ever had.
 */
export async function runVerifyReminderPass(
  db: Db,
  resend: (email: string) => Promise<void>,
  now: Date = new Date(),
): Promise<{ sent: number; failed?: number }> {
  const users = await db
    .collection<UserRow>(COLLECTIONS.user)
    .find(
      {
        emailVerified: { $ne: true },
        isAnonymous: { $ne: true },
        precreatedFromV1: { $exists: false },
        createdAt: {
          $lte: new Date(now.getTime() - VERIFY_REMINDER_AFTER_HOURS * HOUR_MS),
          $gte: new Date(now.getTime() - VERIFY_REMINDER_MAX_AGE_HOURS * HOUR_MS),
        },
      },
      { projection: { email: 1 } },
    )
    .toArray()

  let sent = 0
  let failed = 0
  for (const user of users) {
    if (!user.email) continue
    /*
     * Claimed *before* the send, and read again by `sendVerificationEmail` in
     * `auth.ts` — which is how the second letter knows to word itself as a
     * reminder rather than repeating the first one verbatim. The claim is
     * also what makes this exactly once: an unverified account that hears
     * from us daily is a complaint, and the complaint lands on the domain
     * every other mail leaves from.
     */
    if (!(await claimOnce(db, 'verifyReminder', String(user._id), 'once'))) continue
    try {
      // Better Auth mints and sends the link; this pass only decides who and
      // when. A second link is not a second account — the first still works
      // until it expires.
      await resend(user.email)
      sent++
    } catch {
      // The claim stays. A link that failed to send is not worth trying again
      // tomorrow, and the app can always ask for one.
      failed++
    }
  }

  return failed > 0 ? { sent, failed } : { sent }
}
