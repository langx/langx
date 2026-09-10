import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * The people who opened an account and never finished onboarding, and which of
 * two letters each of them should get.
 *
 * A `user` row is written the moment somebody signs in; `profiles` is written
 * when they finish the wizard. Between those two lies a real population — about
 * one signup in five at the time this was written — with an address, a name and
 * nothing else. They are invisible to `campaignRecipients`, which reads
 * `profiles`, and they are invisible to `audiencePlan`'s `consented` source,
 * because a profile is where consent is stored and they have none.
 *
 * That is the whole reason this module exists rather than a flag on one of
 * those: **nobody here has consented to anything**, so what goes out must be
 * the service message it claims to be — one letter, about the account they
 * opened, saying how to finish it. Not a campaign, and never a second one.
 */

/** Addresses the system minted for itself: guests, and the API's boot account. */
const SYNTHETIC_EMAIL = /\.langx\.invalid$/i

/**
 * The two letters, and the line between them is `requireEmailVerification`.
 *
 * `auth.ts` sets it, so an unconfirmed address cannot sign in at all — the
 * account is not half-built, it is unopened. Telling those people to "finish
 * setting up your profile" sends them at a wall the server puts up on purpose,
 * which is why they get their own letter about the step they are actually on.
 */
export type ReminderVariant =
  /** Confirmed address, no profile: the wizard is what is left. */
  | 'reminder'
  /** Unconfirmed address: they have never been let in, and must be first. */
  | 'confirm'

export interface ReminderRecipient {
  /** String form — the id `profiles` would be keyed by, and what the ledger claims. */
  userId: string
  email: string
  /** Whatever the provider or the sign-up form gave; absent for most. */
  name?: string
  variant: ReminderVariant
  signedUpAt: Date
}

interface UserRow {
  _id: unknown
  name?: string
  email?: string
  emailVerified?: boolean
  isAnonymous?: boolean
  precreatedFromV1?: unknown
  createdAt?: Date
}

export function reminderVariant(user: { emailVerified?: boolean }): ReminderVariant {
  return user.emailVerified === true ? 'reminder' : 'confirm'
}

/**
 * Whether this row is a person who signed up, as opposed to something the
 * system opened for itself or for somebody who never asked.
 *
 * The same three exclusions the new-member alert makes, for the same reasons:
 * a guest is a browsing session, a `precreatedFromV1` row is an account nobody
 * signed up for, and a `*.langx.invalid` address belongs to no mailbox at all.
 * Mailing any of the three would be mailing the machine.
 */
export function isReminderCandidate(user: UserRow): boolean {
  return (
    typeof user.email === 'string' &&
    user.email.length > 0 &&
    user.isAnonymous !== true &&
    user.precreatedFromV1 === undefined &&
    !SYNTHETIC_EMAIL.test(user.email)
  )
}

/**
 * Old enough to be a drop-off rather than somebody mid-form.
 *
 * Without a floor this would mail the person who is on the languages screen
 * right now, which is both useless and the fastest way to make a service
 * message read as spam. A day is the default because the wizard is five
 * screens and people put their phone down; the flag exists because the right
 * answer for a first manual run is not the right answer for a nightly one.
 */
export function isOldEnough(user: { createdAt?: Date }, now: Date, minAgeHours: number): boolean {
  if (!user.createdAt) return false
  return now.getTime() - user.createdAt.getTime() >= minAgeHours * 3600_000
}

export interface CohortOptions {
  now?: Date
  minAgeHours?: number
  limit?: number
}

/**
 * Every candidate, newest last, with the letter each one should get.
 *
 * Driven from `user` and then subtracting `profiles`, rather than the reverse:
 * the whole cohort is defined by the absence of a profile, and an absence
 * cannot be looked up. Two queries, and the `$in` carries string ids because
 * that is what `profiles._id` is — `authId` documents that boundary, and
 * crossing it the wrong way here would return everybody as un-onboarded.
 */
export async function reminderCohort(
  db: Db,
  options: CohortOptions = {},
): Promise<ReminderRecipient[]> {
  const now = options.now ?? new Date()
  const minAgeHours = options.minAgeHours ?? 24

  const users = await db
    .collection<UserRow>(COLLECTIONS.user)
    .find(
      {
        email: { $exists: true },
        isAnonymous: { $ne: true },
        precreatedFromV1: { $exists: false },
      },
      {
        projection: {
          email: 1,
          emailVerified: 1,
          name: 1,
          isAnonymous: 1,
          precreatedFromV1: 1,
          createdAt: 1,
        },
      },
    )
    .toArray()

  const eligible = users.filter(
    (user) => isReminderCandidate(user) && isOldEnough(user, now, minAgeHours),
  )
  if (eligible.length === 0) return []

  const ids = eligible.map((user) => String(user._id))
  const onboarded = new Set(
    (
      await db
        .collection<{ _id: string }>(COLLECTIONS.profiles)
        .find({ _id: { $in: ids } }, { projection: { _id: 1 } })
        .toArray()
    ).map((profile) => profile._id),
  )

  const recipients = eligible
    .filter((user) => !onboarded.has(String(user._id)))
    .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0))
    .map((user) => {
      const name = user.name?.trim()
      return {
        userId: String(user._id),
        email: user.email as string,
        ...(name ? { name } : {}),
        variant: reminderVariant(user),
        signedUpAt: user.createdAt as Date,
      }
    })

  return options.limit ? recipients.slice(0, options.limit) : recipients
}
