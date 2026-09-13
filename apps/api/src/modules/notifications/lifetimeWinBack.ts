import { lifetimeGrantFor, LOYALTY_LIFETIME_GRANTS, type PaidPlanTier } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { LegacyProfile } from '../handles/legacyProfiles'
import type { Profile } from '../profiles/profiles'
import { audienceAction, chosenName } from './audience'
import { suppressedAmong } from './suppressions'

/** The lowest v1 balance that earns anything, so the scan can start there. */
const LOWEST_RUNG = Math.min(...LOYALTY_LIFETIME_GRANTS.map((rung) => rung.minLegacyTokenBalance))

export interface LifetimeWinBackContact {
  userId: string
  email: string
  name?: string
  /** What is waiting for them, named in the letter. */
  tier: PaidPlanTier
  /** What they finished v1 with — the reason it is waiting. */
  legacyTokens: number
  /**
   * Whether they have onboarded — which here means "signed up again without
   * claiming the v1 account", since restoring would have taken them off this
   * list entirely. Carried so `--exclude-returned` means something against
   * this source too, and so the letter can be written in their language.
   */
  hasProfile: boolean
}

export interface LifetimeWinBackAudience {
  contacts: LifetimeWinBackContact[]
  skipped: { unverified: number; noConsent: number; suppressed: number; noAccount: number }
}

interface UserRow {
  _id: unknown
  email?: string
  name?: string
  emailVerified?: boolean
  precreatedFromV1?: { legacyUserId?: string }
}

/**
 * The people a lifetime tier is waiting for who do not know it.
 *
 * A rung is earned by a v1 balance and handed over by the restore — so
 * somebody who has not come back has earned something they have never been
 * told about and cannot find out about, since the only place it is ever said
 * is the welcome-back screen they have not seen. That is what this letter is
 * for, and it is why the audience is its own reader rather than a `--source
 * v1` run with a filter: the body names a tier and a number, so a recipient
 * this cannot name both for must not be in it.
 *
 * Consent is `audienceAction` under `v1`, the same rule the rest of the
 * win-back sequence rests on — v1's sign-up took it, and a refusal recorded
 * since is still a refusal. Whoever has restored is gone from the list at the
 * source: `restoredBy` on the staged record is the fact, and it is the same
 * fact that means the gift has already been handed over and announced.
 *
 * Three queries whatever the size of the list. Around a hundred people today,
 * against 98 staged wallets at the Fluent rung and 10 at Polyglot.
 */
export async function lifetimeWinBackAudience(db: Db): Promise<LifetimeWinBackAudience> {
  const staged = await db
    .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
    .find(
      { legacyTokenBalance: { $gte: LOWEST_RUNG }, restoredBy: { $exists: false } },
      { projection: { legacyTokenBalance: 1 } },
    )
    .toArray()

  const earned = new Map<string, { tier: PaidPlanTier; legacyTokens: number }>()
  for (const row of staged) {
    const rung = lifetimeGrantFor(row.legacyTokenBalance)
    if (!rung) continue
    earned.set(String(row._id), {
      tier: rung.tier,
      legacyTokens: row.legacyTokenBalance as number,
    })
  }

  const skipped = { unverified: 0, noConsent: 0, suppressed: 0, noAccount: 0 }
  if (earned.size === 0) return { contacts: [], skipped }

  const users = await db
    .collection<UserRow>(COLLECTIONS.user)
    .find(
      { 'precreatedFromV1.legacyUserId': { $in: [...earned.keys()] } },
      { projection: { email: 1, name: 1, emailVerified: 1, precreatedFromV1: 1 } },
    )
    .toArray()
  skipped.noAccount = earned.size - users.length

  const ids = users.map((user) => String(user._id))
  const profiles = new Map(
    (
      await db
        .collection<Profile>(COLLECTIONS.profiles)
        .find({ _id: { $in: ids } }, { projection: { settings: 1, deletedAt: 1, displayName: 1 } })
        .toArray()
    ).map((profile) => [profile._id, profile]),
  )

  const suppressed = await suppressedAmong(
    db,
    users.flatMap((user) => (user.email ? [user.email] : [])),
  )

  const contacts: LifetimeWinBackContact[] = []
  for (const user of users) {
    const email = user.email
    const rung = earned.get(user.precreatedFromV1?.legacyUserId ?? '')
    if (!email || !rung) continue
    // The same rule as every other sender here: an address nobody proved is
    // an address that may belong to someone else.
    if (user.emailVerified !== true) {
      skipped.unverified++
      continue
    }
    if (suppressed.has(email.toLowerCase())) {
      skipped.suppressed++
      continue
    }
    const userId = String(user._id)
    const profile = profiles.get(userId)
    const action = audienceAction('v1', {
      deleted: Boolean(profile?.deletedAt),
      fromV1: true,
      prefs: profile?.settings?.notifications,
    })
    if (action !== 'subscribe') {
      skipped.noConsent++
      continue
    }
    /*
     * The profile's own name first, because somebody typed it; the v1 row's
     * only if it is a name rather than `langx_6430` or an Apple relay
     * address — `chosenName` is where that distinction lives.
     */
    const name = profile?.displayName ?? chosenName(user.name)
    contacts.push({
      userId,
      email,
      ...(name ? { name } : {}),
      tier: rung.tier,
      legacyTokens: rung.legacyTokens,
      hasProfile: profile !== undefined,
    })
  }

  return { contacts, skipped }
}
