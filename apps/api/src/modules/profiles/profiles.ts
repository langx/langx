import {
  DEFAULT_NOTIFICATION_PREFS,
  ERROR_CODES,
  ageFromBirthDate,
  cityKey,
  PLAN_LIMITS,
  TIMEZONE_UPDATE_COOLDOWN_MS,
  effectivePlanTier,
  isOnlineAt,
  meetsMinimumAge,
  toGeoPoint,
  type FollowState,
  type GeoPoint,
  type LocationInput,
  type NotificationPrefs,
  type OnboardingProfileInput,
  type PaidPlanTier,
  type PlanTier,
  type UpdateProfileInput,
} from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { authId } from '../../lib/authId'
import { hidesOnlineStatus } from './presenceVisibility'
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
  birthDate: string
  gender: 'female' | 'male' | 'other' | 'undisclosed'
  country?: string
  city?: string
  /**
   * `city` folded for matching — see `cityKey`. Written alongside the display
   * value, never instead of it: how somebody spells their own city is theirs,
   * and only the discovery filter reads this.
   */
  cityKey?: string
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
    /**
     * The matrix, or the boolean it replaced on a profile written before it.
     * `notificationsAllowed` reads both; nothing else should read it directly.
     */
    notifications: NotificationPrefs | boolean
  }
  privacy: {
    incognito: boolean
    hideOnlineStatus?: boolean
    activityMapVisible?: boolean
    statsVisible?: boolean
  }
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
 * `birthDate` there. See age.ts.
 *
 * `country` arrives from the caller rather than from `input`: the route reads
 * it off the connection, and the body is only consulted when the edge could
 * not say. See `countryFromRequest`.
 */
export async function createProfile(
  db: Db,
  userId: string,
  legacyEmailHash: string | null,
  input: OnboardingProfileInput,
  storagePublicBaseUrl?: string,
  /** Carries the v1 loyalty gift when this form finishes a deferred restore. */
  billing?: RevenueCatClient,
  /** Two-letter code the edge read off the connection, when it could. */
  connectionCountry?: string,
): Promise<Profile> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)

  const existing = await profiles.findOne({ _id: userId })
  if (existing) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Profile already exists')
  }

  if (!meetsMinimumAge(input.birthDate)) {
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
    birthDate: input.birthDate,
    gender: input.gender,
    nativeLanguages: input.nativeLanguages,
    learning: input.learning,
    interests: input.interests ?? [],
    settings: {
      discoverable: true,
      notifications: DEFAULT_NOTIFICATION_PREFS,
    },
    privacy: {
      incognito: false,
      hideOnlineStatus: false,
      activityMapVisible: true,
      statsVisible: true,
    },
    entitlement: { tier: 'free', updatedAt: now },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: now, messagesSent: 0 },
    createdAt: now,
    updatedAt: now,
  }
  if (input.bio !== undefined) profile.bio = input.bio
  // The connection wins. Somebody's own answer is the fallback, for the cases
  // the edge cannot resolve — Tor, an unrouted range, a request that did not
  // come through Cloudflare at all.
  const country = connectionCountry ?? input.country
  if (country !== undefined) profile.country = country
  if (input.city !== undefined) {
    profile.city = input.city
    profile.cityKey = cityKey(input.city)
  }
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
/**
 * The device's answer to "which country are you in", from a location fix it
 * reverse-geocoded. Overwrites whatever the connection said at sign-up.
 *
 * A separate function from `updateProfile` because it is a separate decision:
 * `country` is deliberately not in `UpdateProfileInput`, and the only way to
 * change it is to prove a position to the operating system.
 */
export async function setCountryFromLocation(
  db: Db,
  userId: string,
  country: string,
): Promise<Profile> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const updated = await profiles.findOneAndUpdate(
    { _id: userId },
    { $set: { country, updatedAt: new Date() } },
    { returnDocument: 'after' },
  )
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  return updated
}

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

  /*
   * `cityKey` is derived, never sent. Deriving it here rather than trusting a
   * client keeps the stored key and the query's key the product of one
   * function — if they ever disagreed the filter would quietly answer for
   * nobody, which is the failure mode that looks like an empty city.
   */
  if (typeof definedUpdates.city === 'string') {
    definedUpdates.cityKey = cityKey(definedUpdates.city)
  }

  /**
   * `privacy` is written key by key, not as a sub-document.
   *
   * `$set: { privacy: {...} }` replaces the whole thing, so a request naming
   * one flag silently clears the other. That was latent while `privacy` had a
   * single field and is a live bug the moment it has two: a client toggling
   * incognito would turn the caller's online status back on without asking.
   * `settings` above is safe only because both its keys are always sent
   * together; this one is not.
   */
  const { privacy, settings, ...rest } = definedUpdates as {
    privacy?: Record<string, boolean>
    settings?: { discoverable?: boolean; notifications?: Record<string, Record<string, boolean>> }
  }
  const privacyPaths = Object.fromEntries(
    Object.entries(privacy ?? {}).map(([key, value]) => [`privacy.${key}`, value]),
  )

  /**
   * `settings` is now written the same way, and for a sharper version of the
   * same reason: its `notifications` used to be one boolean that a screen
   * always sent whole, and is now a matrix of eight. `$set: { settings }` from
   * a screen toggling one of them would wipe the other seven — and on a
   * profile still holding the old boolean it would also silently replace one
   * shape with another.
   */
  const settingsPaths: Record<string, unknown> = {}
  if (settings?.discoverable !== undefined)
    settingsPaths['settings.discoverable'] = settings.discoverable
  for (const [type, channels] of Object.entries(settings?.notifications ?? {})) {
    for (const [channel, value] of Object.entries(channels)) {
      settingsPaths[`settings.notifications.${type}.${channel}`] = value
    }
  }

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
        ...rest,
        ...privacyPaths,
        ...settingsPaths,
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
  /**
   * Absent when the profile hides its online status. Sending a fresh
   * timestamp alongside `isOnline: false` would let any client recompute the
   * truth in one subtraction, which makes the setting theatre.
   */
  lastActiveAt?: Date
  /** Account creation, shown as an age — `formatAccountAge` does the wording. */
  createdAt: Date
  /**
   * The conversation the viewer already has with this person, when there is
   * one. Per-viewer, like `follow`, and computed by the route for the same
   * reason: the profile screen otherwise offers a "send a message" box that
   * cannot work — `startConversation` refuses a second conversation — and the
   * way through is a link to the one that exists.
   */
  conversationId?: string
  /**
   * Better Auth's flag, not one of ours: it lives on `user`, so it reaches
   * here through {@link isEmailVerified} rather than off the profile document.
   */
  emailVerified: boolean
  /**
   * Nested rather than three flat fields, so "built by naming fields rather
   * than deleting them" stays legible one line at a time.
   */
  follow: FollowState
}

/**
 * What one user is allowed to see of another. Built by naming fields rather
 * than deleting them from the stored document: a field added to `Profile`
 * later — a new quota bucket, an internal flag — is then private by default
 * instead of leaking the first time someone forgets to add it to a blocklist.
 *
 * `birthDate` becomes an age, deliberately, and this is now the field that
 * matters most: the day and month are collected (for birthdays) and must never
 * leave the account that owns them. Only `GET /profiles/me` sees the date.
 *
 * `location` is absent for the same reason and more strongly: coordinates
 * never reach another user in any form. What nearby discovery returns is a
 * bucketed distance computed on the server, never a point.
 */
export function toPublicProfile(
  profile: Profile,
  emailVerified: boolean,
  /**
   * Computed by the route, like `emailVerified` and for the same reason: this
   * function is pure and synchronous, and making it async to fetch two counts
   * would put a database round trip inside a field allow-list.
   *
   * Required rather than defaulted, so no call site can quietly ship
   * `{ followers: 0 }` for a profile with a thousand.
   */
  follow: FollowState,
  now: Date = new Date(),
  /** Set when the viewer and this person already have a thread. */
  conversationId?: string,
): PublicProfile {
  const lastActiveAt = profile.stats?.lastActiveAt ?? profile.createdAt
  const hidden = hidesOnlineStatus(profile)
  const result: PublicProfile = {
    _id: profile._id,
    handle: profile.handle,
    displayName: profile.displayName ?? profile.handle,
    photos: (profile.photos ?? []).map((p) => ({ url: p.url })),
    age: ageFromBirthDate(profile.birthDate, now),
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
    isOnline: hidden ? false : isOnlineAt(lastActiveAt, now),
    createdAt: profile.createdAt,
    emailVerified,
    follow,
  }
  if (!hidden) result.lastActiveAt = new Date(lastActiveAt)
  if (profile.avatarUrl !== undefined) result.avatarUrl = profile.avatarUrl
  if (profile.bio !== undefined) result.bio = profile.bio
  if (profile.country !== undefined) result.country = profile.country
  if (profile.city !== undefined) result.city = profile.city
  if (conversationId !== undefined) result.conversationId = conversationId
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
