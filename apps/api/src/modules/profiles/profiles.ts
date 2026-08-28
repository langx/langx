import {
  ERROR_CODES,
  PLAN_LIMITS,
  TIMEZONE_UPDATE_COOLDOWN_MS,
  effectivePlanTier,
  meetsMinimumAge,
  toGeoPoint,
  type GeoPoint,
  type LocationInput,
  type OnboardingProfileInput,
  type PaidPlanTier,
  type PlanTier,
  type UpdateProfileInput,
} from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { authId } from '../../lib/authId'
import { assertOwnBucket } from '../../lib/assertOwnBucket'
import { resolveHandleClaim } from '../handles/handleReservations'
import type { RevenueCatClient } from '../billing/revenueCatClient'
import { restoreByHash } from '../handles/legacyRestore'
import { grantSignupBonus } from '../tokens/signupBonus'

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
  /**
   * Where the user roughly is, opt-in, and **already coarsened** — every write
   * goes through `toGeoPoint`, which rounds to about a kilometre before this
   * field ever exists. There is no precise copy anywhere; see `location.ts`.
   *
   * Its presence is the consent record. Nothing else tracks whether location
   * sharing is on, because a second flag could disagree with the data, and the
   * disagreement that matters — flag off, coordinates still stored — is the
   * one nobody would notice.
   *
   * Never leaves the server except as a bucketed distance, and never appears
   * in `toPublicProfile`.
   */
  location?: GeoPoint
  /** When the point above was last refreshed. Shown to its owner so "share my location" is not a thing they turned on once and forgot. */
  locationUpdatedAt?: Date
  nativeLanguages: { code: string }[]
  learning: { code: string; level: string; priority: number }[]
  interests: string[]
  settings: {
    discoverable: boolean
    notifications: boolean
  }
  privacy: { incognito: boolean }
  entitlement: {
    tier: PlanTier
    expiresAt?: Date
    willRenew?: boolean
    store?: string
    updatedAt: Date
  }
  quota: { initiations: Date[]; translations: Date[]; media: Date[] }
  photos?: { url: string; createdAt: Date }[]
  streak: { current: number; longest: number; lastQualifiedDay: string | null }
  /** Banked streak freezes; one is spent automatically to bridge a single missed day. */
  streakFreezes?: number
  /** All-time token spent. Earned token lives in `tokenAggregates` and is never decremented. */
  tokenSpent?: number
  /** Cosmetic ids owned (see `COSMETICS`). */
  cosmetics?: string[]
  /** Set when token earning is suspended pending review (report/block). Clears by unsetting. */
  tokenFrozenAt?: Date
  stats: { lastActiveAt: Date; messagesSent: number }
  /**
   * Set once, when a v1 account was restored onto this one, and read by the
   * welcome-back screen — which is the only reason it is persisted at all.
   * `restoreByHash` already computes every number here for its return value;
   * that return value reaches whichever request happened to trigger the
   * restore, and a restore triggered by clicking an email link on a laptop has
   * no way of telling the phone what it found.
   *
   * `acknowledgedAt` is what stops the screen appearing twice.
   *
   * Deliberately absent from `toPublicProfile`: it is nobody else's business
   * that this account came from v1, or what it was given for coming back.
   */
  restoredFromV1?: {
    at: Date
    tokensCredited: number
    frozenStreak: number
    conversationsImported: number
    /** Lifetime tier handed out through RevenueCat for a top-percentile v1 balance; `null` for everyone else. */
    lifetimeGranted?: PaidPlanTier | null
    acknowledgedAt?: Date
    /** Latch: the frozen streak can be bought back exactly once. */
    streakRestoredAt?: Date
  }
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

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
  storagePublicBaseUrl?: string,
  /** Carries the v1 loyalty gift when this form finishes a deferred restore. */
  billing?: RevenueCatClient,
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
    },
    privacy: { incognito: false },
    entitlement: { tier: 'free', updatedAt: now },
    quota: { initiations: [], translations: [], media: [] },
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

  // The v1 restore used to live here, in a second copy of the same logic.
  // It now runs from `legacyRestore.ts` the moment the email is verified — by
  // any route — so a returning user never sees this form at all. What remains
  // here is the path for someone whose v1 record was too incomplete to build a
  // profile from: they fill in the gaps, and the restore completes afterwards.

  if (input.avatarUrl) {
    // Onboarding never calls `confirm`, so this is the only thing standing
    // between the form and a profile picture hosted anywhere at all.
    assertOwnBucket(storagePublicBaseUrl, input.avatarUrl)
    profile.avatarUrl = input.avatarUrl
  }

  try {
    await profiles.insertOne(profile)
  } catch (error) {
    if (isDuplicateKeyError(error, 'handle_unique')) {
      throw new ApiError(ERROR_CODES.HANDLE_TAKEN, `@${input.handle} is already taken`)
    }
    throw error
  }

  // Idempotent on the ledger's unique index, so it does not matter that the
  // restore below may reach for it again.
  await grantSignupBonus(db, userId, now)

  // Finishes a restore that could not run at verification time because the v1
  // record was missing something this form has just supplied. A no-op for
  // everyone else, and idempotent if it somehow already ran.
  if (legacyEmailHash) {
    await restoreByHash(db, userId, legacyEmailHash, billing)
    const restored = await profiles.findOne({ _id: userId })
    if (restored) return restored
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
  let timezoneUpdatedAt: Date | null = null

  // The streak runs on the user's local day, which makes an unrestricted
  // timezone field a "repair my broken streak" button. Rate-limited rather
  // than frozen: real travel still works, farming a second local day inside
  // one UTC day does not. A no-op write (same zone) is never blocked.
  if (input.timezone !== undefined && input.timezone !== current.timezone) {
    const last = current.timezoneUpdatedAt
    if (last && now.getTime() - new Date(last).getTime() < TIMEZONE_UPDATE_COOLDOWN_MS) {
      throw new ApiError(
        ERROR_CODES.RATE_LIMITED,
        'Timezone was changed recently; try again later',
        {
          retryAt: new Date(new Date(last).getTime() + TIMEZONE_UPDATE_COOLDOWN_MS).toISOString(),
        },
      )
    }
    timezoneUpdatedAt = now
  }

  const result = await profiles.findOneAndUpdate(
    { _id: userId },
    {
      $set: {
        ...definedUpdates,
        ...(timezoneUpdatedAt ? { timezoneUpdatedAt } : {}),
        updatedAt: now,
      },
    },
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
/**
 * Stores where the user is, coarsened.
 *
 * A plain `$set` rather than part of `PATCH /profiles/me`, and not in
 * `updateProfileSchema`, on purpose: this is the one field written by a
 * background capture rather than by a form the user is looking at, and folding
 * it into the general profile update would have meant every location refresh
 * ran the timezone cooldown, the language cross-check and the whole merge —
 * and, worse, that a client could park coordinates in a request whose visible
 * subject was something else entirely.
 */
export async function setLocation(db: Db, userId: string, input: LocationInput): Promise<Profile> {
  const now = new Date()
  const result = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOneAndUpdate(
      { _id: userId },
      { $set: { location: toGeoPoint(input), locationUpdatedAt: now, updatedAt: now } },
      { returnDocument: 'after' },
    )
  if (!result) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  return result
}

/**
 * Withdraws it. `$unset`, not a null or a flag — the field's absence is what
 * keeps the profile out of the 2dsphere index, and therefore out of everyone
 * else's nearby results. Anything short of removing it would leave the user
 * findable after they asked not to be.
 */
export async function clearLocation(db: Db, userId: string): Promise<Profile> {
  const result = await db.collection<Profile>(COLLECTIONS.profiles).findOneAndUpdate(
    { _id: userId },
    {
      $unset: { location: '', locationUpdatedAt: '' },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' },
  )
  if (!result) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  return result
}

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

export interface PublicProfile {
  _id: string
  handle: string
  displayName: string
  avatarUrl?: string
  photos: { url: string }[]
  bio?: string
  age: number
  gender: Profile['gender']
  country?: string
  city?: string
  nativeLanguages: { code: string }[]
  learning: { code: string; level: string; priority: number }[]
  interests: string[]
  streak: { current: number; longest: number }
  tier: PlanTier
  cosmetics: string[]
  isOnline: boolean
  lastActiveAt: Date
  /** Account creation, shown as an age — `formatAccountAge` does the wording. */
  createdAt: Date
  /**
   * Better Auth's flag, not one of ours: it lives on `user`, so it reaches
   * here through {@link isEmailVerified} rather than off the profile document.
   */
  emailVerified: boolean
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000

/**
 * What one user is allowed to see of another. Built by naming fields rather
 * than deleting them from the stored document: a field added to `Profile`
 * later — a new quota bucket, an internal flag — is then private by default
 * instead of leaking the first time someone forgets to add it to a blocklist.
 *
 * `birthYear` becomes an age, deliberately: it is what the UI shows, and the
 * exact year is more identifying than the product needs.
 *
 * `location` is absent for the same reason and more strongly: coordinates
 * never reach another user in any form. What nearby discovery returns is a
 * bucketed distance computed on the server, never a point.
 */
export function toPublicProfile(
  profile: Profile,
  emailVerified: boolean,
  now: Date = new Date(),
): PublicProfile {
  const lastActiveAt = profile.stats?.lastActiveAt ?? profile.createdAt
  const result: PublicProfile = {
    _id: profile._id,
    handle: profile.handle,
    displayName: profile.displayName ?? profile.handle,
    photos: (profile.photos ?? []).map((p) => ({ url: p.url })),
    age: new Date().getUTCFullYear() - profile.birthYear,
    gender: profile.gender,
    nativeLanguages: profile.nativeLanguages ?? [],
    learning: profile.learning ?? [],
    interests: profile.interests ?? [],
    streak: { current: profile.streak?.current ?? 0, longest: profile.streak?.longest ?? 0 },
    // `effectivePlanTier`, not the raw stored tier: a lapsed subscription
    // whose EXPIRATION webhook is late or lost would otherwise keep showing
    // everyone else a PRO badge the server already refuses to honour.
    tier: effectivePlanTier(profile.entitlement?.tier ?? 'free', profile.entitlement?.expiresAt),
    cosmetics: profile.cosmetics ?? [],
    isOnline: now.getTime() - new Date(lastActiveAt).getTime() < ONLINE_WINDOW_MS,
    lastActiveAt: new Date(lastActiveAt),
    createdAt: profile.createdAt,
    emailVerified,
  }
  if (profile.avatarUrl !== undefined) result.avatarUrl = profile.avatarUrl
  if (profile.bio !== undefined) result.bio = profile.bio
  if (profile.country !== undefined) result.country = profile.country
  if (profile.city !== undefined) result.city = profile.city
  return result
}

/**
 * Whether Better Auth considers this account's email verified.
 *
 * Its own routes carry the flag on the session, but that is the *viewer's*
 * session — a profile being looked at has none here, so the only way to the
 * value is the `user` document, through `authId` like every other crossing of
 * the two id worlds. A string `_id` matches nothing and would report every
 * profile unverified without erroring.
 */
export async function isEmailVerified(db: Db, userId: string): Promise<boolean> {
  const user = await db
    .collection(COLLECTIONS.user)
    .findOne({ _id: authId(userId) }, { projection: { emailVerified: 1 } })
  return user?.emailVerified === true
}

/** Looks up by `@handle` or by user id — the two things a deep link can carry. */
export async function findProfileByHandleOrId(db: Db, handleOrId: string): Promise<Profile | null> {
  const key = handleOrId.startsWith('@') ? handleOrId.slice(1) : handleOrId
  return db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ $or: [{ _id: key }, { handle: key }], deletedAt: { $exists: false } })
}

/**
 * Adds a photo to the gallery, capped at `PLAN_LIMITS.maxPhotos`.
 *
 * The cap is enforced in the update's own filter rather than by reading the
 * array first: two uploads finishing at once would otherwise both see room and
 * both append. Same reasoning as the quota decrement — let the write decide.
 */
export async function addPhoto(db: Db, userId: string, url: string): Promise<Profile> {
  const max = PLAN_LIMITS.free.maxPhotos
  const result = await db.collection<Profile>(COLLECTIONS.profiles).findOneAndUpdate(
    {
      _id: userId,
      $expr: { $lt: [{ $size: { $ifNull: ['$photos', []] } }, max] },
    },
    { $push: { photos: { url, createdAt: new Date() } }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' },
  )

  if (!result) {
    const existing = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
    if (!existing) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, `You can have at most ${max} photos`)
  }
  return result
}

export async function removePhoto(db: Db, userId: string, url: string): Promise<Profile> {
  const result = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOneAndUpdate(
      { _id: userId },
      { $pull: { photos: { url } }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' },
    )
  if (!result) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  return result
}
