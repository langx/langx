import type { CefrLevel, Gender } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * One v1 profile, already mapped into v2's vocabulary by the Faz 11 ETL.
 *
 * Deliberately a *staging* record rather than a real `profiles` document. v1's
 * Appwrite password hashes cannot be migrated, so every returning user signs
 * up again and receives a brand new user id — there is nothing to key a real
 * profile on until that happens. This sits here until they claim their handle,
 * at which point onboarding restores it.
 */
export interface LegacyProfile {
  /** The Appwrite document id, which in v1 equals the Auth user id. */
  _id: string
  handle: string
  legacyEmailHash: string
  displayName?: string
  bio?: string
  birthYear?: number
  gender?: Gender
  country?: string
  countryCode?: string
  nativeLanguages: { code: string }[]
  learning: { code: string; level: CefrLevel; priority: number }[]
  /** Migrated to our own bucket by the ETL; absent when media was skipped. */
  avatarUrl?: string
  photos: { url: string }[]
  legacyStreak?: number
  lastSeenAt?: Date
  migratedAt: Date
  /** Set once a v2 user has taken this data, so it is only restored once. */
  restoredBy?: string
  restoredAt?: Date
}

/**
 * What onboarding pre-fills for a returning user, keyed on the same email hash
 * the handle reservation uses — so a person who proves they own the old email
 * gets the old profile, and nobody else can.
 */
export async function findLegacyProfile(
  db: Db,
  legacyEmailHash: string,
): Promise<LegacyProfile | null> {
  return db
    .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
    .findOne({ legacyEmailHash, restoredBy: { $exists: false } })
}

/**
 * Marks a staged profile as taken. Conditional on `restoredBy` still being
 * absent, so two concurrent onboarding attempts for the same legacy account
 * cannot both claim it — the same "let the write decide" pattern the quota and
 * ledger use.
 */
export async function markRestored(db: Db, legacyId: string, userId: string): Promise<boolean> {
  const result = await db
    .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
    .updateOne(
      { _id: legacyId, restoredBy: { $exists: false } },
      { $set: { restoredBy: userId, restoredAt: new Date() } },
    )
  return result.modifiedCount > 0
}
