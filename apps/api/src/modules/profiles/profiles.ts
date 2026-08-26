import {
  ERROR_CODES,
  meetsMinimumAge,
  type OnboardingProfileInput,
  type UpdateProfileInput,
} from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { resolveHandleClaim } from '../handles/handleReservations'

export interface Profile {
  _id: string
  handle: string
  displayName: string
  avatarUrl?: string
  bio?: string
  birthYear: number
  gender: 'female' | 'male' | 'other' | 'undisclosed'
  country?: string
  city?: string
  timezone?: string
  timezoneUpdatedAt?: Date
  location?: { type: 'Point'; coordinates: [number, number] }
  nativeLanguages: { code: string }[]
  learning: { code: string; level: string; priority: number }[]
  interests: string[]
  settings: {
    discoverable: boolean
    notifications: boolean
    ageRange: [number, number]
    distanceKm: number
  }
  privacy: { incognito: boolean }
  entitlement: {
    tier: 'free' | 'pro'
    expiresAt?: Date
    willRenew?: boolean
    store?: string
    updatedAt: Date
  }
  quota: { initiations: Date[]; translations: Date[] }
  streak: { current: number; longest: number; lastQualifiedDay: string | null }
  stats: { lastActiveAt: Date; messagesSent: number }
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const DEFAULT_AGE_RANGE: [number, number] = [18, 99]
const DEFAULT_DISTANCE_KM = 50

function isDuplicateKeyError(error: unknown, indexName: string): boolean {
  return (
    error instanceof MongoServerError && error.code === 11000 && !!error.message.includes(indexName)
  )
}

/**
 * Onboarding. The one hard gate: `meetsMinimumAge` runs here, server-side,
 * before anything is written — not at Better Auth sign-up, because Google/
 * Apple accounts never pass through a form that could have collected
 * `birthYear` there. See age.ts.
 */
export async function createProfile(
  db: Db,
  userId: string,
  legacyEmailHash: string | null,
  input: OnboardingProfileInput,
): Promise<Profile> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)

  const existing = await profiles.findOne({ _id: userId })
  if (existing) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Profile already exists')
  }

  if (!meetsMinimumAge(input.birthYear)) {
    throw new ApiError(ERROR_CODES.UNDERAGE, 'You must be 18 or older to use LangX')
  }

  if (legacyEmailHash) {
    const resolution = await resolveHandleClaim(db, input.handle, userId, legacyEmailHash)
    if (resolution.kind === 'reserved_for_other') {
      throw new ApiError(ERROR_CODES.HANDLE_RESERVED, `@${input.handle} is reserved`)
    }
  }

  const now = new Date()
  const profile: Profile = {
    _id: userId,
    handle: input.handle,
    displayName: input.displayName,
    birthYear: input.birthYear,
    gender: input.gender,
    nativeLanguages: input.nativeLanguages,
    learning: input.learning,
    interests: input.interests ?? [],
    settings: {
      discoverable: true,
      notifications: true,
      ageRange: DEFAULT_AGE_RANGE,
      distanceKm: DEFAULT_DISTANCE_KM,
    },
    privacy: { incognito: false },
    entitlement: { tier: 'free', updatedAt: now },
    quota: { initiations: [], translations: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: now, messagesSent: 0 },
    createdAt: now,
    updatedAt: now,
  }
  if (input.bio !== undefined) profile.bio = input.bio
  if (input.country !== undefined) profile.country = input.country
  if (input.city !== undefined) profile.city = input.city
  if (input.timezone !== undefined) {
    profile.timezone = input.timezone
    profile.timezoneUpdatedAt = now
  }

  try {
    await profiles.insertOne(profile)
  } catch (error) {
    if (isDuplicateKeyError(error, 'handle_unique')) {
      throw new ApiError(ERROR_CODES.HANDLE_TAKEN, `@${input.handle} is already taken`)
    }
    throw error
  }

  return profile
}

export async function getProfile(db: Db, userId: string): Promise<Profile | null> {
  return db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
}

/**
 * `learning`/`nativeLanguages` can each arrive alone in a partial update —
 * the shared zod schema only cross-checks overlap when both are present in
 * the same request (see profile.ts), so when just one changes this checks it
 * against whichever the request didn't touch, read from the stored profile.
 */
export async function updateProfile(
  db: Db,
  userId: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const current = await profiles.findOne({ _id: userId })
  if (!current) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')

  const nextNative = input.nativeLanguages ?? current.nativeLanguages
  const nextLearning = input.learning ?? current.learning
  const nativeCodes = new Set(nextNative.map((l) => l.code))
  if (nextLearning.some((l) => nativeCodes.has(l.code))) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'A learning language cannot also be listed as native',
    )
  }

  // zod's `.partial()` types every field as `T | undefined`, but an absent
  // key and a key explicitly set to `undefined` mean different things to
  // Mongo's `$set` (and to exactOptionalPropertyTypes) — filter before
  // merging so untouched fields stay untouched rather than being nulled out.
  const definedUpdates = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  )

  const now = new Date()
  const result = await profiles.findOneAndUpdate(
    { _id: userId },
    { $set: { ...definedUpdates, updatedAt: now } },
    { returnDocument: 'after' },
  )
  if (!result) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  return result
}

/**
 * Separate from `updateProfile` deliberately — `avatarUrl` isn't in
 * `updateProfileSchema` at all, it's only ever set through the upload-url →
 * upload → confirm sequence (routes/media.ts), which is what lets the route
 * verify the URL actually points into our own bucket before trusting it.
 */
export async function setAvatarUrl(db: Db, userId: string, avatarUrl: string): Promise<Profile> {
  const result = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOneAndUpdate(
      { _id: userId },
      { $set: { avatarUrl, updatedAt: new Date() } },
      { returnDocument: 'after' },
    )
  if (!result) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  return result
}
