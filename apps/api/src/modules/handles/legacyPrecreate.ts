import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
import { recordTermsAcceptance } from '../account/terms'

/**
 * A v2 `user` opened on behalf of a v1 account, before its owner has come back.
 *
 * The staged v1 data (`legacyProfiles`, `handleReservations`) is keyed on a
 * *hash* of the email and there was, until this, no `user` row at all — so a
 * returning person who reached for "forgot password" got a "check your email"
 * screen and no email, because Better Auth had nobody to send it to. The only
 * working route back was to sign up again, which nobody guesses.
 *
 * Opening the row up front turns the two routes people actually try into the
 * two that work: a password reset finds the account and mails the link, and
 * Google or Apple links onto it. Signing up fresh with that address is now
 * refused as "already exists", which is what we want — the old profile is on
 * this row, and a second account would strand it.
 *
 * **`emailVerified` is `true` from the start, for every row.** Better Auth
 * refuses to link a social sign-in onto a local user whose address is
 * unverified (`accountLinking.requireLocalEmailVerified`, on by default and
 * rightly so — it is the takeover defence against a *password* account
 * squatting on someone else's address), so an unverified row would send every
 * returning Google user to an error. The defence is not needed here because
 * the row has no password: there is no credential to squat with, and nothing
 * can turn it into a session without proving the address once more — a reset
 * link delivered to it, or a provider that has already done the proving.
 * That holds whether or not v1 ever saw the address verified, which is why the
 * script does not filter on it.
 */
export interface PrecreatedFromV1 {
  at: Date
  /** The Appwrite user id, which is also `legacyProfiles._id`. */
  legacyUserId: string
}

export interface PrecreatedUserDoc {
  _id: ObjectId
  email: string
  name: string
  emailVerified: true
  createdAt: Date
  updatedAt: Date
  precreatedFromV1: PrecreatedFromV1
}

export interface PrecreateInput {
  email: string
  name: string
  legacyUserId: string
  at?: Date
}

/** Better Auth lowercases on lookup; storing anything else would never match. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function buildPrecreatedUser(input: PrecreateInput): PrecreatedUserDoc {
  const at = input.at ?? new Date()
  return {
    _id: new ObjectId(),
    email: normalizeEmail(input.email),
    name: input.name,
    emailVerified: true,
    createdAt: at,
    updatedAt: at,
    precreatedFromV1: { at, legacyUserId: input.legacyUserId },
  }
}

export type PrecreateOutcome = 'inserted' | 'exists'

/**
 * Writes the row, or leaves alone whatever is already there — a real sign-up
 * that beat the script to the address, or an earlier run. The unique index on
 * `user.email` is the real guard; the read before it just keeps the summary
 * honest without relying on a duplicate-key error for control flow.
 *
 * Writes to a Better Auth collection directly, which the codebase otherwise
 * avoids. There is no server-side "create a user with no credentials" in
 * Better Auth, and going through `signUpEmail` would mint a password nobody
 * knows and send a verification mail nobody asked for.
 */
export async function insertPrecreatedUser(
  db: Db,
  input: PrecreateInput,
): Promise<{ outcome: PrecreateOutcome; userId: string }> {
  const users = db.collection<PrecreatedUserDoc>(COLLECTIONS.user)
  const email = normalizeEmail(input.email)
  const existing = await users.findOne({ email }, { projection: { _id: 1 } })
  if (existing) return { outcome: 'exists', userId: String(existing._id) }

  const doc = buildPrecreatedUser({ ...input, email })
  try {
    await users.insertOne(doc)
  } catch (error) {
    if (isDuplicateKey(error)) {
      const raced = await users.findOne({ email }, { projection: { _id: 1 } })
      if (raced) return { outcome: 'exists', userId: String(raced._id) }
    }
    throw error
  }
  return { outcome: 'inserted', userId: String(doc._id) }
}

/**
 * What a pre-created account has never had done to it, done on its first
 * session.
 *
 * Every other route into an account passes through `user.create.after`, which
 * stamps the terms and restores a v1 profile. A pre-created row was written by
 * a script, so that hook never fired for it, and the reset or the social link
 * that brings its owner back creates no user either. The session is the one
 * event those routes share.
 *
 * Idempotent, because sessions are created on every sign-in: the terms stamp
 * is skipped once present, and the restore is a no-op once the staged profile
 * is marked taken. Returns whether this was a pre-created row at all, so the
 * common case — every ordinary sign-in — costs one indexed read and nothing
 * else.
 */
export async function settlePrecreatedUser(
  db: Db,
  userId: string,
  restore: (userId: string, email: string) => Promise<void>,
): Promise<boolean> {
  const user = await db
    .collection<{ _id: ObjectId; email: string; precreatedFromV1?: unknown; terms?: unknown }>(
      COLLECTIONS.user,
    )
    .findOne({ _id: authId(userId) }, { projection: { email: 1, precreatedFromV1: 1, terms: 1 } })
  if (!user?.precreatedFromV1) return false

  /*
   * The consent record, stamped on the first sign-in rather than by the script:
   * the script ran without them in the room, and a consent dated to a moment
   * nobody was present for is not one. This is the same standard the social
   * providers already meet — continuing past the sign-in screen is the act,
   * and the server stamps it at the moment the account becomes usable.
   */
  if (!user.terms) await recordTermsAcceptance(db, userId)
  await restore(userId, user.email)
  return true
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
}
