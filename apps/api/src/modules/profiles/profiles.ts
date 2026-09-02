import {
  DEFAULT_NOTIFICATION_PREFS,
  ERROR_CODES,
  ageFromBirthDate,
  PLAN_LIMITS,
  type DiscloseGenderInput,
  type GuestProfileInput,
  TIMEZONE_UPDATE_COOLDOWN_MS,
  effectivePlanTier,
  isOnlineAt,
  findCosmetic,
  meetsMinimumAge,
  newHandleSchema,
  toGeoPoint,
  type FollowState,
  type GeoPoint,
  type LocationInput,
  type Equipped,
  type NotificationPrefs,
  type StoredNotificationPrefs,
  type OnboardingProfileInput,
  type PaidPlanTier,
  type PlanTier,
  type UpdateProfileInput,
} from '@langx/shared'
import { MongoServerError, type Db, type UpdateFilter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { nearestCity } from '../cities/cities'
import { effectiveTier } from './entitlement'
import { ApiError } from '../../lib/ApiError'
import { hidesOnlineStatus } from './presenceVisibility'
import { assertOwnBucket } from '../../lib/assertOwnBucket'
import { resolveHandleClaim } from '../handles/handleReservations'
import type { RevenueCatClient } from '../billing/revenueCatClient'
import { restoreByHash } from '../handles/legacyRestore'
import { attachReferral } from '../referrals/referrals'
import { grantSignupBonus } from '../tokens/signupBonus'

export interface Profile {
  _id: string
  /**
   * A browsing session with no account behind it.
   *
   * The row exists because `discoverProfiles` needs a viewer document — it
   * reads the viewer's languages, tier, location and blocks to build the whole
   * mutual-fit match — and for no other reason. It is **not** an analytics
   * record: it can say a guest existed and which languages they picked, and
   * cannot say where in welcome → languages → discover → sign-up they stopped,
   * which is the only question worth asking about a funnel. That is PostHog's
   * job when it lands.
   */
  guest?: true
  handle: string
  displayName: string
  avatarUrl?: string
  bio?: string
  birthDate: string
  gender: 'female' | 'male' | 'other' | 'undisclosed'
  country?: string
  /**
   * Worked out from `location`, never sent by a client — there is no longer
   * anywhere to type one. `cityId` is what the discovery filter matches on;
   * the name and country are denormalised beside it so drawing a profile does
   * not need a second lookup.
   *
   * All three go when the location does: somebody who withdrew their location
   * did not leave the city it was worked out from behind.
   */
  cityId?: string
  cityName?: string
  cityCountryCode?: string
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
     * Three shapes at once: today's boolean per kind, the push/email matrix it
     * replaced, and the single boolean v1 wrote. `notificationsAllowed` reads
     * all three; nothing else should read this field directly.
     */
    notifications: StoredNotificationPrefs | NotificationPrefs | boolean
  }
  privacy: {
    incognito: boolean
    hideOnlineStatus?: boolean
    activityMapVisible?: boolean
    statsVisible?: boolean
    hideCity?: boolean
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
  streak: {
    current: number
    longest: number
    /**
     * The last day the streak was credited, by *anything* — a message, a
     * correction, a recording, or simply opening the app.
     */
    lastQualifiedDay: string | null
    /**
     * The last day a **meaningful action** happened, which is a narrower thing
     * and the one the milestone bonus is paid for. Absent on profiles written
     * before check-ins existed; the reader treats that as "unknown", never as
     * "never".
     */
    lastActionDay?: string | null
  }
  /** Banked streak freezes; one is spent automatically to bridge a single missed day. */
  streakFreezes?: number
  /** All-time token spent. Earned token lives in `tokenAggregates` and is never decremented. */
  tokenSpent?: number
  /** Cosmetic ids owned (see `COSMETICS`). */
  cosmetics?: string[]
  /**
   * Which of them is worn. Ownership is a set; this is the choice, and without
   * it a second frame is a purchase that changes nothing.
   */
  equipped?: Equipped
  /**
   * When each paid tier's welcome pack was handed over.
   *
   * Per tier, not a single flag: upgrading pro → pro_plus grants the
   * difference, and a single boolean could not tell "already had pro's" from
   * "already had pro_plus's".
   */
  welcomePackAt?: Partial<Record<'pro' | 'pro_plus', Date>>
  /** Set when token earning is suspended pending review (report/block). Clears by unsetting. */
  tokenFrozenAt?: Date
  stats: { lastActiveAt: Date; messagesSent: number }
  /**
   * Who invited this account, if anybody. Written once by `attachReferral`
   * during onboarding and never again — there is no endpoint that can set or
   * change it.
   *
   * A pointer, not a counter, so it cannot drift; the relationship itself
   * lives in `referrals`, keyed by this user. It is duplicated here for one
   * reason: `awardForSend` runs on every message in the app and needs a free
   * way to answer "is this person even referred". It already reads the
   * sender's profile, so for the overwhelming majority — invited by nobody —
   * the referral check costs a property access on a document already in
   * memory.
   *
   * Deliberately absent from `toPublicProfile` and `getSharedProfile`.
   */
  referredBy?: string
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

  /**
   * Onboarding is always the free tier — an entitlement arrives from
   * RevenueCat afterwards, never before the profile exists. So the cap here is
   * simply the free row, and there is no stored profile to grandfather against.
   */
  assertLanguageCap(
    'learningLanguages',
    input.learning.length,
    0,
    PLAN_LIMITS.free.maxLearningLanguages,
  )
  assertLanguageCap(
    'nativeLanguages',
    input.nativeLanguages.length,
    0,
    PLAN_LIMITS.free.maxNativeLanguages,
  )

  let claimingOwnLegacyHandle = false
  if (legacyEmailHash) {
    const resolution = await resolveHandleClaim(db, input.handle, userId, legacyEmailHash)
    if (resolution.kind === 'reserved_for_other') {
      throw new ApiError(ERROR_CODES.HANDLE_RESERVED, `@${input.handle} is reserved`)
    }
    claimingOwnLegacyHandle = resolution.kind === 'claimed'
  }

  /*
   * The floor and the reserved list, checked here rather than in the schema.
   *
   * A handle is a public address now — `/<handle>` — so a new one must be at
   * least `HANDLE_MIN_LENGTH` and must not be a route name. But v1 handles
   * were written under neither rule, and somebody taking back a handle *that
   * is reserved for them* is not making a new claim. Only this function can
   * tell those two apart, which is why `onboardingProfileSchema` stays
   * permissive and the rule lives here.
   */
  if (!claimingOwnLegacyHandle) {
    const claim = newHandleSchema.safeParse(input.handle)
    if (!claim.success) {
      throw new ApiError(
        ERROR_CODES.VALIDATION_FAILED,
        claim.error.issues[0]?.message ?? 'That username cannot be used',
      )
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

  /*
   * Who invited them, if anybody said so. Wrapped the way `auth.ts` wraps the
   * legacy restore, and for the same reason: the account is real and the
   * profile is already written, so a failure here must not fail onboarding.
   * `attachReferral` is silent about every *expected* failure by itself; this
   * catch is for the unexpected ones.
   *
   * Nothing is paid here. See `settleReferral` — the award waits until this
   * person has written to somebody.
   */
  if (input.referredByHandle) {
    try {
      await attachReferral(db, userId, input.referredByHandle, input.referredBySource ?? 'manual')
    } catch (error) {
      console.error('[referral] attach failed', { userId, error })
    }
  }

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

/**
 * Discloses a gender that onboarding left as `undisclosed`. Once.
 *
 * `gender` is not editable — see `updateProfileSchema`, which excludes it
 * alongside `birthDate` because both decide whose discovery results you turn
 * up in. This is the single exception, and it is one-way: `undisclosed` is the
 * only value it will write over, so nobody can cycle through genders and step
 * in and out of other people's searches. Going the other way is not offered
 * either — `discloseGenderSchema` has no `undisclosed` member.
 *
 * It exists because the alternative is a trap. `onlyMyGender` is inert for an
 * undisclosed viewer by design, and that filter is free now, so locking the
 * field outright would leave everybody who skipped the question at onboarding
 * permanently unable to use it — while the app kept telling them, in eight
 * languages, to add their gender to their profile.
 *
 * The condition lives in the filter rather than in a preceding read, for the
 * reason every other guard in this codebase does: two taps that race would
 * both pass a check-then-write, and the second would overwrite the first.
 */
export async function discloseGender(
  db: Db,
  userId: string,
  gender: DiscloseGenderInput['gender'],
): Promise<Profile> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const updated = await profiles.findOneAndUpdate(
    { _id: userId, gender: 'undisclosed' },
    { $set: { gender, updatedAt: new Date() } },
    { returnDocument: 'after' },
  )
  if (updated) return updated

  // The filter matched nothing, which is two different situations. Separating
  // them costs one read on a path that only runs when the write already
  // failed, and the difference matters: one is a client bug, the other is a
  // second tap on a button that should no longer be on screen.
  const existing = await profiles.findOne({ _id: userId })
  if (!existing) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Gender has already been set')
}

/**
 * Refuses a write that would put somebody further over their tier's language
 * limit than they already are.
 *
 * The `> was` clause is the whole of the grandfathering, and it is not a
 * nicety. A migrated v1 user with five learning languages is over a free
 * tier's limit of one by definition — without it, every write they make
 * carries an over-limit array and is refused, so they could never change a
 * level, reorder their priorities, or even *remove* a language. The limit
 * would read as "your profile is frozen".
 *
 * Nothing is ever stripped, and discovery keeps matching on whatever is
 * stored. This only stops the list growing.
 */
function assertLanguageCap(
  limit: 'learningLanguages' | 'nativeLanguages',
  next: number,
  was: number,
  max: number,
): void {
  if (next <= max || next <= was) return
  throw new ApiError(ERROR_CODES.UPGRADE_REQUIRED, `Your plan allows ${max}`, { limit, max })
}

/**
 * The profile a guest browses with: two languages and nothing else.
 *
 * Written by its own function rather than through `createProfile`, and the
 * differences are all deliberate. No signup bonus — a guest has not signed up,
 * and paying one here would pay it twice when they do. `discoverable: false`,
 * so a guest can never appear in somebody else's discovery. And a synthetic
 * handle: `handle_unique` is not sparse, so the row needs one, and
 * `guest:<userId>` can never collide with a real username because
 * `HANDLE_PATTERN` allows no colon and caps length at twenty. Which also means
 * no route and no `/<handle>` link can ever resolve to it.
 */
export async function createGuestProfile(
  db: Db,
  userId: string,
  input: GuestProfileInput,
  connectionCountry?: string,
): Promise<Profile> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const existing = await profiles.findOne({ _id: userId })
  if (existing) return existing

  const now = new Date()
  const profile: Profile = {
    _id: userId,
    guest: true,
    handle: `guest:${userId}`,
    displayName: '',
    // Never rendered and never compared: a guest has no profile of their own
    // and cannot be looked at. It is here because the type requires it, and a
    // date rather than an empty string so nothing downstream has to guard.
    birthDate: '1900-01-01',
    gender: 'undisclosed',
    nativeLanguages: input.nativeLanguages,
    learning: input.learning,
    interests: [],
    settings: { discoverable: false, notifications: DEFAULT_NOTIFICATION_PREFS },
    privacy: {
      incognito: false,
      hideOnlineStatus: false,
      activityMapVisible: false,
      statsVisible: false,
    },
    entitlement: { tier: 'free', updatedAt: now },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: now, messagesSent: 0 },
    createdAt: now,
    updatedAt: now,
  }
  if (connectionCountry) profile.country = connectionCountry

  await profiles.insertOne(profile)
  return profile
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

  /**
   * The per-tier language cap, here rather than in the schema for the same
   * reason the overlap check is: a route schema is registered at boot and has
   * neither the stored profile nor the viewer's tier.
   */
  const tier = effectiveTier(current)
  assertLanguageCap(
    'learningLanguages',
    nextLearning.length,
    current.learning.length,
    PLAN_LIMITS[tier].maxLearningLanguages,
  )
  assertLanguageCap(
    'nativeLanguages',
    nextNative.length,
    current.nativeLanguages.length,
    PLAN_LIMITS[tier].maxNativeLanguages,
  )

  // zod's `.partial()` types every field as `T | undefined`, but an absent
  // key and a key explicitly set to `undefined` mean different things to
  // Mongo's `$set` (and to exactOptionalPropertyTypes) — filter before
  // merging so untouched fields stay untouched rather than being nulled out.
  const definedUpdates = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  )

  /*
   * You may only wear what you own, and only in the slot it belongs to.
   *
   * Checked here rather than in the schema because the schema cannot see the
   * profile: `equipped.frame` is a valid string either way, and the thing that
   * makes it valid or not is a field on the document being updated. An
   * explicit `null` clears a slot, which is how "wear nothing" is expressed.
   */
  if (input.equipped) {
    const owned = current.cosmetics ?? []
    for (const [kind, id] of Object.entries(input.equipped)) {
      if (id === null || id === undefined) continue
      const cosmetic = findCosmetic(id)
      if (!cosmetic || cosmetic.kind !== kind || !owned.includes(id)) {
        throw new ApiError(ERROR_CODES.VALIDATION_FAILED, `You do not own ${id}`)
      }
    }
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
  const { privacy, settings, equipped, ...rest } = definedUpdates as {
    privacy?: Record<string, boolean>
    settings?: { discoverable?: boolean; notifications?: Record<string, boolean> }
    equipped?: Record<string, string | null>
  }
  const privacyPaths = Object.fromEntries(
    Object.entries(privacy ?? {}).map(([key, value]) => [`privacy.${key}`, value]),
  )

  /**
   * `settings` is written the same way, and for a sharper version of the same
   * reason: its `notifications` used to be one boolean that a screen always
   * sent whole, and is now one switch per kind. `$set: { settings }` from a
   * screen toggling one of them would wipe the other three.
   *
   * The dotted path also does the migration, one switch at a time. Setting
   * `settings.notifications.messages` to a boolean over a profile still
   * holding `{push, email}` there replaces that sub-document with the boolean
   * — Mongo permits the type change — so a profile converts itself the first
   * time its owner touches a switch, and `notificationsAllowed` covers the
   * ones nobody ever touches.
   */
  const settingsPaths: Record<string, unknown> = {}
  if (settings?.discoverable !== undefined)
    settingsPaths['settings.discoverable'] = settings.discoverable
  for (const [type, value] of Object.entries(settings?.notifications ?? {})) {
    settingsPaths[`settings.notifications.${type}`] = value
  }

  /*
   * `equipped` too, and it needs an `$unset` as well: the two slots are set
   * independently, so writing the object whole would clear a title when
   * somebody changes their frame. `null` is how the client says "wear
   * nothing", and it has to remove the key rather than store a null — every
   * reader checks for a *missing* slot.
   */
  const equippedPaths: Record<string, string> = {}
  const equippedUnset: Record<string, ''> = {}
  for (const [kind, id] of Object.entries(equipped ?? {})) {
    if (id === null) equippedUnset[`equipped.${kind}`] = ''
    else equippedPaths[`equipped.${kind}`] = id
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
        ...equippedPaths,
        ...(timezoneUpdatedAt ? { timezoneUpdatedAt } : {}),
        updatedAt: now,
      },
      ...(Object.keys(equippedUnset).length > 0 ? { $unset: equippedUnset } : {}),
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
  const point = toGeoPoint(input)

  /*
   * The city is worked out here rather than asked for. It used to be a text
   * field in two forms, which meant it was blank for most people, stale for
   * the rest, and never shown anywhere — while the coordinate that could
   * answer the same question exactly was already being stored for distance.
   *
   * `null` is a real answer: the sea, or anywhere further than
   * `CITY_MATCH_MAX_METRES` from a city on the list. Written as an `$unset` so
   * a stale city cannot outlive the coordinate that produced it.
   */
  const city = await nearestCity(db, point.coordinates)
  const always = { location: point, locationUpdatedAt: now, updatedAt: now }
  // One operator or the other, never both on the same field: Mongo refuses an
  // update that `$set`s and `$unset`s the same path.
  const update: UpdateFilter<Profile> = city
    ? {
        $set: {
          ...always,
          cityId: city._id,
          cityName: city.name,
          cityCountryCode: city.countryCode,
        },
      }
    : { $set: always, $unset: { cityId: '', cityName: '', cityCountryCode: '' } }

  const result = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOneAndUpdate({ _id: userId }, update, { returnDocument: 'after' })
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
      // The city goes with it. It was only ever a reading of this coordinate,
      // and leaving it would name the place of somebody who withdrew the
      // location that named it.
      $unset: {
        location: '',
        locationUpdatedAt: '',
        cityId: '',
        cityName: '',
        cityCountryCode: '',
      },
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
  equipped?: Equipped
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
    ...(profile.equipped ? { equipped: profile.equipped } : {}),
    isOnline: hidden ? false : isOnlineAt(lastActiveAt, now),
    createdAt: profile.createdAt,
    emailVerified,
    follow,
  }
  if (!hidden) result.lastActiveAt = new Date(lastActiveAt)
  if (profile.avatarUrl !== undefined) result.avatarUrl = profile.avatarUrl
  if (profile.bio !== undefined) result.bio = profile.bio
  if (profile.country !== undefined) result.country = profile.country
  // Behind its own switch, unlike `country`. The country is coarse and was
  // half-declared anyway; the city is neither, and nobody typed it.
  if (profile.cityName !== undefined && profile.privacy?.hideCity !== true) {
    result.city = profile.cityName
  }
  if (conversationId !== undefined) result.conversationId = conversationId
  return result
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
