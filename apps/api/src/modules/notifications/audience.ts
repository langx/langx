import { notificationsAllowed, notificationsUntouched, promotionsRefused } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { suppressedAmong } from './suppressions'

/**
 * Which addresses belong on a Resend audience, decided here rather than there.
 *
 * `campaign.ts` argues against keeping a list outside this database, and that
 * argument stands: consent lives in `profiles.settings.notifications` and
 * nowhere else. What this module builds is a **projection** of that state, not
 * a second copy of it — every run recomputes the whole answer from Mongo and
 * pushes it, so a switch turned off or an account deleted reaches the audience
 * on the next sync instead of drifting apart from it silently.
 *
 * The remaining gap is the other direction: somebody who unsubscribes from
 * inside a Resend broadcast is unsubscribed *there*, and this database will
 * not know until a webhook writes it back. Until that exists, the sync must
 * not resubscribe anybody it did not just read as consenting — which is why
 * `subscribe` is only ever set for a live opt-in, never as a repair.
 */

/** Where the consent being projected was given. */
export type AudienceSource =
  /** `promotions.email` is true in this database. The only self-evident case. */
  | 'consented'
  /**
   * The pre-created v1 rows and nobody else — a population rather than a
   * consent, which is what the win-back letters are addressed to.
   */
  | 'v1'
  /** Both, plus everybody else with a verified address. Widest, and the least defensible. */
  | 'all'

export type ContactAction =
  /** On the list, mailable. */
  | 'subscribe'
  /** On the list, suppressed — a refusal is worth keeping so a later sync cannot undo it. */
  | 'unsubscribe'
  /** Off the list entirely: the account is gone, so the address should be too. */
  | 'remove'

export interface AudienceContact {
  userId: string
  email: string
  /**
   * For a broadcast that greets somebody: the display name, whole, or the
   * name the v1 pre-creation wrote on the `user` row when there is no profile.
   */
  name?: string
  /** Whether the account has onboarded — what a "still waiting" follow-up excludes. */
  hasProfile: boolean
  action: ContactAction
}

export interface AudiencePlan {
  contacts: AudienceContact[]
  skipped: { unverified: number; guest: number; noConsent: number }
}

/** Anonymous accounts hold an address at a domain that resolves nowhere. */
const GUEST_DOMAIN = '@guest.langx.invalid'

interface UserRow {
  _id: unknown
  email?: string
  name?: string
  emailVerified?: boolean
  isAnonymous?: boolean
  precreatedFromV1?: unknown
}

/**
 * Whether this account's consent covers marketing, under the given source.
 *
 * Exported for its test: the three stored shapes of `notifications` and the
 * three sources are nine cases, and the one that matters — a v1 account that
 * has since said no — is the one a table gets wrong.
 */
export function audienceAction(
  source: AudienceSource,
  account: {
    deleted: boolean
    fromV1: boolean
    prefs: Profile['settings']['notifications'] | undefined
  },
): ContactAction | null {
  if (account.deleted) return 'remove'
  if (notificationsAllowed(account.prefs, 'promotions', 'email')) return 'subscribe'
  /*
   * A refusal, but only a real one. `createProfile` writes the defaults out in
   * full, so every account carries `promotions.email: false` from its first
   * day — reading that as "no" would have this cancel the consent it was
   * built to carry, and it would do it silently, one returning v1 user at a
   * time as each of them finished onboarding.
   */
  if (promotionsRefused(account.prefs, 'email') && !notificationsUntouched(account.prefs)) {
    return 'unsubscribe'
  }
  // Nobody has answered in v2. Whether that silence is enough depends entirely
  // on where else the person said yes, which is what `source` names.
  if (source === 'all') return 'subscribe'
  if (source === 'v1' && account.fromV1) return 'subscribe'
  return null
}

/**
 * Reads every mailable account and says what should happen to it.
 *
 * Driven from `user` rather than from `profiles`, unlike `campaignRecipients`:
 * a pre-created v1 row has an address and no profile at all, and it is
 * precisely those rows this exists for. Profiles are fetched once by `$in`
 * afterwards, so the whole plan costs two queries rather than one per person.
 */
export async function audiencePlan(
  db: Db,
  source: AudienceSource,
  options: { limit?: number } = {},
): Promise<AudiencePlan> {
  const users = await db
    .collection<UserRow>(COLLECTIONS.user)
    .find(
      { email: { $exists: true } },
      { projection: { email: 1, name: 1, emailVerified: 1, isAnonymous: 1, precreatedFromV1: 1 } },
    )
    .toArray()

  const ids = users.map((user) => String(user._id))
  const profiles = new Map(
    (
      await db
        .collection<Profile>(COLLECTIONS.profiles)
        .find({ _id: { $in: ids } }, { projection: { settings: 1, deletedAt: 1, displayName: 1 } })
        .toArray()
    ).map((profile) => [profile._id, profile]),
  )

  // One query for the whole list. A suppressed address goes up as
  // `unsubscribe`, never as `remove`: Resend keeps the suppression, and a
  // bounce or complaint is exactly the thing a later sync must not undo.
  const suppressed = await suppressedAmong(
    db,
    users.flatMap((user) => (user.email ? [user.email] : [])),
  )

  const contacts: AudienceContact[] = []
  const skipped = { unverified: 0, guest: 0, noConsent: 0 }

  for (const user of users) {
    const email = user.email
    if (!email) continue
    if (user.isAnonymous === true || email.endsWith(GUEST_DOMAIN)) {
      skipped.guest++
      continue
    }
    // The same rule as every other sender here: an address nobody proved is an
    // address that may belong to someone else.
    if (user.emailVerified !== true) {
      skipped.unverified++
      continue
    }

    const userId = String(user._id)
    const fromV1 = user.precreatedFromV1 !== undefined && user.precreatedFromV1 !== null
    /*
     * `--source v1` names *who*, not what they consented to, and that
     * distinction stopped being free when promotional email became opt-out:
     * `audienceAction` now answers `subscribe` for anybody whose switch
     * allows it, which is everybody untouched — so without this line a
     * campaign asking for v1 accounts was handed every verified address in
     * the database. Caught by a dry run of the launch mail, which offered to
     * tell twenty-five people who signed up last week that their streak was
     * waiting for them.
     */
    if (source === 'v1' && !fromV1) {
      skipped.noConsent++
      continue
    }
    const profile = profiles.get(userId)
    const decided = audienceAction(source, {
      deleted: profile?.deletedAt !== undefined,
      fromV1,
      prefs: profile?.settings?.notifications,
    })
    const action =
      decided === 'subscribe' && suppressed.has(email.toLowerCase()) ? 'unsubscribe' : decided
    if (action === null) {
      skipped.noConsent++
      continue
    }

    const name = profile?.displayName || user.name
    contacts.push({
      userId,
      email,
      ...(name ? { name } : {}),
      hasProfile: profile !== undefined,
      action,
    })
    if (options.limit && contacts.length >= options.limit) break
  }

  return { contacts, skipped }
}
