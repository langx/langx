import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ONBOARDING_LETTERS } from '../../email/onboardingReminderLetters'
import type { NotificationEmailContext } from '../../email/notify'
import { unsubscribeHeaders } from '../../email/notify'
import { EMAIL_BATCH_SIZE, type EmailMessage } from '../../email/sender'
import { signUnsubscribeToken, unsubscribeUrl } from '../../email/unsubscribeToken'
import { UNSUBSCRIBE_PLACEHOLDER } from './campaign'
import { claimOnce } from './ledger'
import { suppressedAmong } from './suppressions'

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

/** The other end of the same measurement — see `CohortOptions.maxAgeHours`. */
export function isOlderThan(user: { createdAt?: Date }, now: Date, maxAgeHours: number): boolean {
  if (!user.createdAt) return true
  return now.getTime() - user.createdAt.getTime() > maxAgeHours * 3600_000
}

export interface CohortOptions {
  now?: Date
  minAgeHours?: number
  /**
   * The far end, and why the scheduled pass has one where a manual run does
   * not. Left out the cohort is every drop-off there has ever been, which is
   * right for the one catch-up run somebody decides to make and wrong for a
   * timer: switching a timer on would mail years of abandoned sign-ups in its
   * first tick. `verifyReminder` draws the same line for the same reason.
   */
  maxAgeHours?: number
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

  const maxAgeHours = options.maxAgeHours
  const eligible = users.filter(
    (user) =>
      isReminderCandidate(user) &&
      isOldEnough(user, now, minAgeHours) &&
      (maxAgeHours === undefined || !isOlderThan(user, now, maxAgeHours)),
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

/**
 * How long to wait before writing. A day, the same floor the manual run used
 * and for the same reason: the wizard is five screens and people put their
 * phone down. Mailing somebody who is on the languages screen right now is
 * both useless and the fastest way to make a service message read as spam.
 */
export const ONBOARDING_REMINDER_AFTER_HOURS = 24

/**
 * And the far end. A week-old sign-up with no profile is not somebody who got
 * distracted; a letter then is a letter about an account they have forgotten
 * opening. The bound is also what makes switching this on safe — without it,
 * the first tick would write to every abandoned sign-up this app has ever had.
 */
export const ONBOARDING_REMINDER_MAX_AGE_HOURS = 24 * 7

/**
 * What one tick will send at most.
 *
 * Inside a 24 h–7 day window a normal day's drop-offs are a handful, so this
 * is not a ramp and not a budget — it is the ceiling that keeps a surprise
 * (an import, a bot sign-up run, a week the timer was off) from leaving as one
 * burst. Whoever is left is still inside the window on the next tick.
 */
export const ONBOARDING_REMINDER_PER_TICK = 50

/**
 * The scheduled half of the letter `send-onboarding-reminder.ts` sends by hand.
 *
 * The script stays, and stays unbounded: it is how a backlog gets caught up,
 * which is a decision somebody makes once. This is the standing arrangement —
 * the same cohort, the same two letters, the same ledger claim, bounded at both
 * ends so it only ever writes to people who dropped off this week.
 *
 * It cannot use `sendNotificationEmail`: that helper answers `no-profile` and
 * refuses, which is correct for everything else on this timer and is the exact
 * condition every recipient here meets. So the send is assembled the way the
 * script assembles it — claim, sign an unsubscribe token, substitute it into
 * both bodies, batch.
 *
 * Suppressions *are* honoured, which the script does not do: a one-off run is
 * somebody watching, and a timer is not. Somebody who bounced or complained
 * must not be written to again by a machine.
 */
export async function runOnboardingReminderPass(
  db: Db,
  email: NotificationEmailContext,
  now: Date = new Date(),
): Promise<{ sent: number; skipped?: number }> {
  const cohort = await reminderCohort(db, {
    now,
    minAgeHours: ONBOARDING_REMINDER_AFTER_HOURS,
    maxAgeHours: ONBOARDING_REMINDER_MAX_AGE_HOURS,
    limit: ONBOARDING_REMINDER_PER_TICK,
  })
  if (cohort.length === 0) return { sent: 0 }

  const suppressed = await suppressedAmong(
    db,
    cohort.map((person) => person.email),
  )
  const writable = cohort.filter((person) => !suppressed.has(person.email.toLowerCase()))

  let sent = 0
  let skipped = cohort.length - writable.length
  for (let index = 0; index < writable.length; index += EMAIL_BATCH_SIZE) {
    const batch = writable.slice(index, index + EMAIL_BATCH_SIZE)

    // Claimed before the send, one at a time, exactly as the script does and
    // for the reason `ledger.ts` gives: a send that then fails is one letter
    // nobody got, where a send that succeeded after an unrecorded claim is a
    // second letter to somebody who never asked for the first.
    const claimed: ReminderRecipient[] = []
    for (const person of batch) {
      if (await claimOnce(db, 'onboardingReminder', person.userId, 'once')) claimed.push(person)
      else skipped++
    }
    if (claimed.length === 0) continue

    const messages: EmailMessage[] = claimed.map((person) => {
      const letter = ONBOARDING_LETTERS[person.variant]
      const url = unsubscribeUrl(
        email.apiBaseUrl,
        signUnsubscribeToken(email.unsubscribeSecret, person.userId, 'all'),
      )
      return {
        to: person.email,
        subject: letter.subject,
        html: letter.html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, url),
        text: letter.text.replaceAll(UNSUBSCRIBE_PLACEHOLDER, url),
        headers: unsubscribeHeaders(url),
      }
    })

    if (email.sender.sendBatch) await email.sender.sendBatch(messages)
    else for (const message of messages) await email.sender.send(message)
    sent += messages.length
  }

  return skipped > 0 ? { sent, skipped } : { sent }
}
