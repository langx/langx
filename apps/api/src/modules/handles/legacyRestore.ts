import {
  TOKEN_RULES,
  convertLegacyTokens,
  lifetimeGrantFor,
  meetsMinimumAge,
  type PaidPlanTier,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { RevenueCatClient } from '../billing/revenueCatClient'
import { awardTokens } from '../tokens/ledger'
import { grantSignupBonus } from '../tokens/signupBonus'
import type { Profile } from '../profiles/profiles'
import { resolveHandleClaim } from './handleReservations'
import { hashLegacyEmail } from './legacyEmailHash'
import { importLegacyConversations } from './legacyConversations'
import { findLegacyProfile, markRestored, type LegacyProfile } from './legacyProfiles'

export type RestoreOutcome =
  /** No v1 account behind this email. The overwhelmingly common case. */
  | { kind: 'no-legacy-account' }
  /** Someone already took this record — including a previous run for this same user. */
  | { kind: 'already-restored' }
  /** The v1 data was too incomplete to build a profile from; onboarding pre-fills it instead. */
  | { kind: 'needs-onboarding'; missing: string[] }
  | {
      kind: 'restored'
      handle: string
      tokensCredited: number
      frozenStreak: number
      /** Threads whose other side had also returned, so they came back too. */
      conversationsImported: number
      /**
       * The lifetime tier gifted for a top-percentile v1 balance, or `null`
       * for the great majority who earn none. See `LOYALTY_LIFETIME_GRANTS`.
       */
      lifetimeGranted: PaidPlanTier | null
    }

/**
 * The single rule: **the moment a v2 account's email is verified, by any
 * route, a matching v1 profile comes back.**
 *
 * Three sign-ins reach this — the email link, Google/Apple (where the provider
 * has already proven the address), and the legacy-password bridge — and they
 * all call this one function rather than each carrying their own copy of the
 * logic. Previously the restore lived inside onboarding, which meant a
 * returning user had to fill in a form describing a profile we already had.
 *
 * Idempotent, and that is load-bearing: `markRestored` is a conditional update,
 * so of any number of concurrent verifications exactly one wins and the rest
 * see `already-restored`. Every token award additionally carries a `refId`, so
 * even a restore replayed against a wiped flag cannot pay twice.
 */
export async function restoreLegacyProfile(
  db: Db,
  userId: string,
  email: string,
  salt: string | undefined,
  billing?: RevenueCatClient,
): Promise<RestoreOutcome> {
  if (!salt) return { kind: 'no-legacy-account' }
  return restoreByHash(db, userId, hashLegacyEmail(email, salt), billing)
}

/**
 * The same restore, for callers that already hold the hash — onboarding, which
 * computed it to check the handle claim, and would otherwise need the raw
 * email again just to hash it a second time.
 */
export async function restoreByHash(
  db: Db,
  userId: string,
  legacyEmailHash: string,
  /**
   * Optional so that every caller which does not sell anything — and every
   * test that only cares about the profile coming back — can leave it out.
   * Without it the loyalty gift is simply not attempted, exactly as if no
   * RevenueCat key were configured.
   */
  billing?: RevenueCatClient,
): Promise<RestoreOutcome> {
  const legacy = await findLegacyProfile(db, legacyEmailHash)
  if (!legacy) return { kind: 'no-legacy-account' }

  const missing = missingForProfile(legacy)
  if (missing.length > 0) {
    // Leave the record staged. Onboarding will pre-fill from it and the
    // restore happens there instead, so nothing is lost — the user just has a
    // form to finish.
    return { kind: 'needs-onboarding', missing }
  }

  // Claim the record before doing anything else. Everything after this point
  // is safe to be the only writer of.
  if (!(await markRestored(db, legacy._id, userId))) return { kind: 'already-restored' }

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const existing = await profiles.findOne({ _id: userId })
  const now = new Date()

  if (!existing) {
    // The handle has to be claimed through the reservation, not just written:
    // that is what stops a v1 handle being taken by someone else in the gap.
    const resolution = await resolveHandleClaim(db, legacy.handle, userId, legacyEmailHash)
    if (resolution.kind === 'reserved_for_other') {
      // Should not happen — the reservation and the profile share an email
      // hash — but writing the handle anyway would hand it to the wrong person.
      return { kind: 'needs-onboarding', missing: ['handle'] }
    }
    await profiles.insertOne(buildProfile(userId, legacy, now))
    // This is the other place a profile comes into existence — a restored user
    // never sees the onboarding form, so the starting grant has to happen here
    // too. Idempotent, so the overlap with `createProfile` costs nothing.
    await grantSignupBonus(db, userId, now)
  } else {
    // They onboarded first and are only now proving the email. Restore the
    // parts the form never asked for.
    const update: Record<string, unknown> = { updatedAt: now }
    if (legacy.avatarUrl && !existing.avatarUrl) update.avatarUrl = legacy.avatarUrl
    if (legacy.photos.length > 0 && (existing.photos ?? []).length === 0) {
      update.photos = legacy.photos.map((photo) => ({ url: photo.url, createdAt: now }))
    }
    if (legacy.frozenStreak && legacy.frozenStreak > existing.streak.longest) {
      update['streak.longest'] = legacy.frozenStreak
    }
    await profiles.updateOne({ _id: userId }, { $set: update })
  }

  const tokensCredited = await creditLegacyEconomy(db, userId, legacy, now)
  const conversations = await tryImportConversations(db, userId, legacy._id)
  const lifetimeGranted = await tryGrantLifetime(billing, userId, legacy)

  /**
   * Written once, after both numbers are known, and for both branches above —
   * a single `$set` rather than a copy in each, since either branch has by now
   * put a profile there to write to.
   *
   * It is persisted because the return value below only reaches whichever
   * request happened to trigger the restore, and that is often not the device
   * the user is holding: an email link clicked on a laptop restores the
   * account, and the phone has no way of learning what was found. The
   * welcome-back screen reads this instead.
   */
  await profiles.updateOne(
    { _id: userId },
    {
      $set: {
        restoredFromV1: {
          at: now,
          tokensCredited,
          frozenStreak: legacy.frozenStreak ?? 0,
          conversationsImported: conversations,
          lifetimeGranted,
        },
      },
    },
  )

  return {
    kind: 'restored',
    handle: legacy.handle,
    tokensCredited,
    frozenStreak: legacy.frozenStreak ?? 0,
    conversationsImported: conversations,
    lifetimeGranted,
  }
}

/**
 * The v1 loyalty gift — lifetime Pro+ or Pro, by v1 token balance
 * (`LOYALTY_LIFETIME_GRANTS`).
 *
 * Failure is swallowed for the same reason the conversation import's is —
 * everything above has already been written, and reporting a restore that
 * *did* happen as a failure is worse than a missing gift. It is also the
 * house rule: optional services degrade, they do not crash. Someone missed
 * here can be granted from the dashboard later; RevenueCat is the record
 * either way, so nothing is lost but the automation.
 *
 * The first entitlement is the one that decides the tier, so it is awaited
 * alone: if it fails there is no gift to report. The rest are belt-and-braces
 * (Pro+ also grants `pro`, mirroring the products) and a failure among them
 * leaves a recipient who is still correctly Pro+ by precedence — worth
 * logging, not worth withholding the news over.
 *
 * Safe to replay: a promotional grant is an upsert on RevenueCat's side, and
 * `markRestored` already makes a second restore for the same account a no-op.
 */
async function tryGrantLifetime(
  billing: RevenueCatClient | undefined,
  userId: string,
  legacy: LegacyProfile,
): Promise<PaidPlanTier | null> {
  if (!billing) return null
  const rung = lifetimeGrantFor(legacy.legacyTokenBalance)
  if (!rung) return null

  const [primary, ...rest] = rung.entitlements
  if (!primary) return null

  try {
    await billing.grantLifetimeEntitlement(userId, primary)
  } catch (error) {
    console.error('[legacy-restore] lifetime grant failed', { userId, error })
    return null
  }

  for (const entitlement of rest) {
    try {
      await billing.grantLifetimeEntitlement(userId, entitlement)
    } catch (error) {
      console.error('[legacy-restore] secondary lifetime grant failed', {
        userId,
        entitlement,
        error,
      })
    }
  }

  return rung.tier
}

/**
 * Chat history is restored here rather than by each of the three callers, for
 * the reason the rest of this module exists: one rule, one place. It is the
 * last step and its failure is swallowed, because everything above it has
 * already been written — the profile, the handle, the tokens — and throwing
 * now would report a restore that in fact happened as a failure. The
 * `sweepLegacyImports` timer retries whatever is dropped here.
 */
async function tryImportConversations(db: Db, userId: string, legacyId: string): Promise<number> {
  try {
    const result = await importLegacyConversations(db, userId, legacyId)
    return result.conversationsImported
  } catch (error) {
    console.error('[legacy-restore] conversation import failed', { userId, error })
    return 0
  }
}

/** Fields a profile cannot be built without. `birthYear` is the age gate. */
function missingForProfile(legacy: LegacyProfile): string[] {
  const missing: string[] = []
  if (!legacy.handle) missing.push('handle')
  if (!legacy.displayName) missing.push('displayName')
  if (legacy.birthYear === undefined) missing.push('birthYear')
  else if (!meetsMinimumAge(legacy.birthYear)) missing.push('birthYear')
  if (legacy.nativeLanguages.length === 0) missing.push('nativeLanguages')
  if (legacy.learning.length === 0) missing.push('learning')
  return missing
}

function buildProfile(userId: string, legacy: LegacyProfile, now: Date): Profile {
  const profile: Profile = {
    _id: userId,
    handle: legacy.handle,
    displayName: legacy.displayName ?? legacy.handle,
    birthYear: legacy.birthYear!,
    gender: legacy.gender ?? 'undisclosed',
    nativeLanguages: legacy.nativeLanguages,
    learning: legacy.learning,
    interests: [],
    settings: { discoverable: true, notifications: true },
    privacy: { incognito: false },
    entitlement: { tier: 'free', updatedAt: now },
    quota: { initiations: [], translations: [], media: [] },
    /**
     * The streak's *length* comes back but not its currency. `current` starts
     * at zero and `lastQualifiedDay` stays null, so what they built in v1 is a
     * record rather than a live streak — restoring the day would hand back
     * something nobody earned here. `frozenStreak` is what they can buy back.
     */
    streak: { current: 0, longest: legacy.frozenStreak ?? 0, lastQualifiedDay: null },
    stats: { lastActiveAt: now, messagesSent: 0 },
    createdAt: now,
    updatedAt: now,
  }
  if (legacy.bio) profile.bio = legacy.bio
  if (legacy.countryCode) profile.country = legacy.countryCode
  if (legacy.avatarUrl) profile.avatarUrl = legacy.avatarUrl
  if (legacy.photos.length > 0) {
    profile.photos = legacy.photos.map((photo) => ({ url: photo.url, createdAt: now }))
  }
  return profile
}

/**
 * The v1 economy, credited once.
 *
 * Both awards carry a `refId` derived from the Appwrite id, so the ledger's
 * unique index refuses a second payment even if this ran twice — the same
 * defence the daily pool uses, and the reason a replayed restore is harmless.
 */
async function creditLegacyEconomy(
  db: Db,
  userId: string,
  legacy: LegacyProfile,
  at: Date,
): Promise<number> {
  const converted = convertLegacyTokens(legacy.legacyTokenBalance ?? 0)

  const [conversion] = await Promise.all([
    awardTokens(db, {
      userId,
      kind: 'legacyTokenConversion',
      amount: converted,
      refId: legacy._id,
      at,
    }),
    awardTokens(db, {
      userId,
      kind: 'welcomeBack',
      amount: TOKEN_RULES.welcomeBackBonus,
      refId: legacy._id,
      at,
    }),
  ])

  return conversion.amount
}
