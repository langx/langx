import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { emailFor } from '../profiles/emailFor'

/**
 * Why an address is off the list for good.
 *
 * `unsubscribed` is a person with no profile to hold the preference — a
 * pre-created v1 row whose owner pressed the link. `bounced` and `complained`
 * come from Resend: the first means the mailbox does not exist, the second
 * that its owner marked us as spam, and mailing either again is the thing
 * that gets a domain blocked for everybody else.
 */
export type SuppressionReason = 'unsubscribed' | 'bounced' | 'complained'

export interface EmailSuppression {
  /** The address, lower-cased — the one key every writer has. */
  _id: string
  /** Known when the unsubscribe route wrote the row; a webhook only has the address. */
  userId?: string
  reason: SuppressionReason
  at: Date
}

/**
 * Addresses no mail may go to, whatever the preference says.
 *
 * Keyed by address rather than user id because two of the three writers do
 * not have a user id: the unsubscribe route acts for somebody with no profile
 * (that is the case it exists for — `setEmailNotifications` finds nothing to
 * switch off and used to return `false` silently, so a v1 row's "stop" went
 * nowhere), and a Resend webhook knows only who the mail was addressed to.
 *
 * Read before every send, service mail included: a bounced address is a dead
 * one, and the streak reminder does not need to prove that again tomorrow.
 * Not read by `notificationsAllowed`, which answers a different question —
 * what the person chose — and is pure on purpose.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function suppressEmail(
  db: Db,
  input: { email: string; reason: SuppressionReason; userId?: string },
  at: Date = new Date(),
): Promise<void> {
  await db.collection<EmailSuppression>(COLLECTIONS.emailSuppressions).updateOne(
    { _id: normaliseEmail(input.email) },
    {
      // First reason wins: a complaint after a bounce changes nothing, and an
      // unsubscribe recorded first is the one the person can point to.
      $setOnInsert: {
        reason: input.reason,
        at,
        ...(input.userId ? { userId: input.userId } : {}),
      },
    },
    { upsert: true },
  )
}

export async function isEmailSuppressed(db: Db, email: string): Promise<boolean> {
  const row = await db
    .collection<EmailSuppression>(COLLECTIONS.emailSuppressions)
    .findOne({ _id: normaliseEmail(email) }, { projection: { _id: 1 } })
  return row !== null
}

/** The same question for an account, via its current address. */
export async function isUserSuppressed(db: Db, userId: string): Promise<boolean> {
  const address = await emailFor(db, userId)
  return address ? isEmailSuppressed(db, address.email) : false
}

/** Which of these addresses are suppressed — one query for a whole audience. */
export async function suppressedAmong(db: Db, emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set()
  const rows = await db
    .collection<EmailSuppression>(COLLECTIONS.emailSuppressions)
    .find({ _id: { $in: emails.map(normaliseEmail) } }, { projection: { _id: 1 } })
    .toArray()
  return new Set(rows.map((row) => row._id))
}
