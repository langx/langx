import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * The link in the "delete your account" email: minted, spent once, and gone.
 *
 * **Stored, not signed.** `unsubscribeToken.ts` is an HMAC that never expires,
 * on purpose — it is followed months after the app was deleted by somebody who
 * cannot sign in. Neither property is wanted here: a link that ends an account
 * has to stop working, and has to stop working *the first time it is used*, so
 * a forwarded mail or a mailbox someone else later reads cannot delete an
 * account a second time. Only a stored row can say "already spent".
 *
 * **Only the hash is kept.** The row is then worth nothing to anyone reading
 * the database, including us: it can confirm a link somebody already has, and
 * cannot produce one.
 */
export interface DeletionToken {
  _id: string
  userId: string
  tokenHash: string
  createdAt: Date
  expiresAt: Date
}

/** Long enough that guessing is not a strategy; short enough to survive a mail client. */
const TOKEN_BYTES = 32

/**
 * How long the link lives.
 *
 * An hour would be safer and would also strand anyone who reads their mail in
 * the evening. A day is the shape of the actual task — decide, open the mail,
 * confirm — and the grace period behind it is 30 days either way.
 */
export const DELETION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Mints a link for this user, replacing any live one.
 *
 * One per user, enforced by a unique index rather than by remembering to
 * delete: asking twice must not leave two spendable links behind.
 */
export async function mintDeletionToken(db: Db, userId: string, now = new Date()): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  await db.collection<DeletionToken>(COLLECTIONS.deletionTokens).replaceOne(
    { _id: userId },
    {
      userId,
      tokenHash: hash(token),
      createdAt: now,
      expiresAt: new Date(now.getTime() + DELETION_TOKEN_TTL_MS),
    },
    { upsert: true },
  )
  return token
}

/**
 * Whose token this is, or `null`.
 *
 * Does **not** spend it: the GET only asks, and a page that asked would
 * otherwise have burnt the token before the reader answered. `burnDeletionToken`
 * is the POST's job.
 *
 * The expiry is checked here as well as by the TTL index, because a TTL monitor
 * runs roughly once a minute and "roughly" is not a property to lean on.
 */
export async function verifyDeletionToken(
  db: Db,
  token: string | undefined,
  now = new Date(),
): Promise<string | null> {
  if (!token) return null
  const row = await db
    .collection<DeletionToken>(COLLECTIONS.deletionTokens)
    .findOne({ tokenHash: hash(token) })
  if (!row) return null
  if (row.expiresAt.getTime() <= now.getTime()) return null
  // Constant-time, though the value compared is already a hash of the input:
  // the cost is nothing and the habit is worth more than the reasoning.
  const found = Buffer.from(row.tokenHash)
  const given = Buffer.from(hash(token))
  return found.length === given.length && timingSafeEqual(found, given) ? row.userId : null
}

/** Spends it. Answers whether it was still there to spend. */
export async function burnDeletionToken(db: Db, token: string): Promise<boolean> {
  const result = await db
    .collection<DeletionToken>(COLLECTIONS.deletionTokens)
    .deleteOne({ tokenHash: hash(token) })
  return result.deletedCount > 0
}

/** Where the email's button points; the page there only *asks*. */
export function deletionConfirmUrl(apiBaseUrl: string, token: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/account/delete/confirm?token=${encodeURIComponent(token)}`
}
