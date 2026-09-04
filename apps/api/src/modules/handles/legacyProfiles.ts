import { PLAN_LIMITS, type LanguageLevel, type Gender } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

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
  birthDate?: string
  gender?: Gender
  country?: string
  countryCode?: string
  nativeLanguages: { code: string }[]
  learning: { code: string; level: LanguageLevel; priority: number }[]
  /** Migrated to our own bucket by the ETL; absent when media was skipped. */
  avatarUrl?: string
  photos: { url: string }[]
  /** The user's *current* streak at their last v1 activity — what they can buy back. */
  frozenStreak?: number
  /** v1 token balance, converted at `TOKEN_RULES.legacyTokenDivisor` on restore. */
  legacyTokenBalance?: number
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

/**
 * Puts a staged record's pictures onto a profile that already exists, filling
 * gaps and never overwriting.
 *
 * The rule was `legacyRestore`'s, inline, and the media backfill needed the
 * identical one — two copies of "only where they have none" is exactly the
 * kind of pair that drifts until one of them starts overwriting a picture
 * somebody chose themselves. So it lives here, is tested, and both callers use
 * it.
 *
 * The gallery is capped at `PLAN_LIMITS.free.maxPhotos`. The restore path used
 * to write the array wholesale and could seat a returning user above the limit
 * the rest of the app enforces — a number that is config everywhere else has
 * no business being unbounded on one path.
 *
 * Returns what it actually wrote, because a backfill that cannot say how many
 * profiles it changed is a backfill nobody can check.
 */
export async function applyLegacyMedia(
  db: Db,
  userId: string,
  legacy: Pick<LegacyProfile, 'avatarUrl' | 'photos'>,
  at: Date,
): Promise<{ avatar: boolean; photos: number }> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const existing = await profiles.findOne({ _id: userId })
  if (!existing) return { avatar: false, photos: 0 }

  const update: Record<string, unknown> = {}
  const avatar = Boolean(legacy.avatarUrl) && !existing.avatarUrl
  if (avatar) update.avatarUrl = legacy.avatarUrl

  const photos =
    legacy.photos.length > 0 && (existing.photos ?? []).length === 0
      ? legacy.photos.slice(0, PLAN_LIMITS.free.maxPhotos)
      : []
  if (photos.length > 0) {
    update.photos = photos.map((photo) => ({ url: photo.url, createdAt: at }))
  }

  if (Object.keys(update).length === 0) return { avatar: false, photos: 0 }
  update.updatedAt = at
  await profiles.updateOne({ _id: userId }, { $set: update })
  return { avatar, photos: photos.length }
}
