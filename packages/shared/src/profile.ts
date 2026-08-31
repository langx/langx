import { countryCodeSchema } from './countries'
import { PLAN_LIMITS } from './limits'
import { notificationPrefsSchema } from './notifications'
import { birthDateSchema } from './age'
import { languageLevelSchema } from './level'
import { handleSchema } from './handle'
import { languageCodeSchema } from './languages'
import { z } from 'zod'

export const GENDERS = ['female', 'male', 'other', 'undisclosed'] as const
export type Gender = (typeof GENDERS)[number]
export const genderSchema = z.enum(GENDERS)

const nativeLanguageSchema = z.object({ code: languageCodeSchema })

const learningLanguageSchema = z.object({
  code: languageCodeSchema,
  level: languageLevelSchema,
  /** Lower is more important; onboarding's first pick is priority 1. */
  priority: z.number().int().min(1),
})

/**
 * A learning language can't also be listed as native (why would you be
 * "learning" a language you already speak) — this is the one cross-field
 * rule the base object schemas below can't express, applied in
 * `onboardingProfileSchema` and `updateProfileSchema` via `.refine()`.
 */
function learningDoesNotOverlapNative(data: {
  nativeLanguages: { code: string }[]
  learning: { code: string }[]
}): boolean {
  const native = new Set(data.nativeLanguages.map((l) => l.code))
  return !data.learning.some((l) => native.has(l.code))
}

/**
 * The absolute ceilings, defined from the top tier so they cannot drift from
 * `PLAN_LIMITS`. Zod only enforces these — the per-tier limit needs the stored
 * profile and the viewer's tier, neither of which a boot-time schema has.
 */
export const MAX_LEARNING_LANGUAGES = PLAN_LIMITS.pro_plus.maxLearningLanguages
export const MAX_NATIVE_LANGUAGES = PLAN_LIMITS.pro_plus.maxNativeLanguages
export const CITY_MAX_LENGTH = 100
export const MAX_INTERESTS = 10

/**
 * What onboarding offers as chips. Free text is still accepted by
 * `interestsSchema` — this is a starting point, not a vocabulary.
 *
 * Chosen to be things two strangers can actually talk about across a language
 * barrier, which rules out most of what an interest picker usually contains:
 * nothing needs shared cultural reference, and every one of them survives being
 * discussed at B1.
 */
export const INTEREST_SUGGESTIONS = [
  'music',
  'films',
  'books',
  'cooking',
  'travel',
  'football',
  'fitness',
  'gaming',
  'art',
  'photography',
  'history',
  'science',
  'technology',
  'nature',
  'animals',
  'fashion',
  'business',
  'politics',
  'languages',
  'teaching',
] as const
export const BIO_MAX_LENGTH = 500
export const DISPLAY_NAME_MAX_LENGTH = 50

const displayNameSchema = z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH)
const bioSchema = z.string().trim().max(BIO_MAX_LENGTH)
const interestsSchema = z.array(z.string().trim().min(1).max(30)).max(MAX_INTERESTS)
const nativeLanguagesSchema = z.array(nativeLanguageSchema).min(1).max(MAX_NATIVE_LANGUAGES)
const learningLanguagesSchema = z.array(learningLanguageSchema).min(1).max(MAX_LEARNING_LANGUAGES)

/**
 * Body of `POST /profiles` — onboarding. `birthDate` is validated here
 * server-side (see age.ts's doc comment on why this, not the client, is the
 * real gate) rather than at Better Auth sign-up, because OAuth accounts
 * (Google/Apple) never pass through a form that could collect it there.
 *
 * `country` is still accepted, but it is a **fallback**: the server takes the
 * country from the connection instead, and only falls back to this when the
 * edge cannot say (Tor, an unknown range). See `countryFromRequest`.
 */
/**
 * What a guest supplies: the two language lists and nothing else.
 *
 * Deliberately not a subset of `onboardingProfileSchema`, which requires a
 * handle, a display name, a birth date and a gender. A guest supplies none of
 * those because a guest cannot be looked at — they browse, they do not appear.
 */
/**
 * How long a guest session is kept before it is swept away.
 *
 * Long enough that somebody who tries the app, closes it and comes back next
 * week still has their languages; short enough that the collection does not
 * fill with rows nobody will read again. Most guests never return, and the row
 * exists only so `discoverProfiles` has a viewer document.
 */
export const GUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const guestProfileSchema = z
  .object({
    nativeLanguages: nativeLanguagesSchema,
    learning: learningLanguagesSchema,
  })
  .refine(learningDoesNotOverlapNative, {
    message: 'A learning language cannot also be listed as native',
    path: ['learning'],
  })
export type GuestProfileInput = z.infer<typeof guestProfileSchema>

export const onboardingProfileSchema = z
  .object({
    /**
     * The *reading* schema, deliberately. The floor and the reserved list are
     * enforced in `createProfile`, which is the only place that can see
     * whether this handle is reserved *for this person* — a returning v1 user
     * claiming `ada` or `admin` back is the case a schema cannot tell apart
     * from a stranger taking it.
     */
    handle: handleSchema,
    displayName: displayNameSchema,
    birthDate: birthDateSchema(),
    gender: genderSchema,
    nativeLanguages: nativeLanguagesSchema,
    learning: learningLanguagesSchema,
    bio: bioSchema.optional(),
    interests: interestsSchema.optional(),
    country: countryCodeSchema.optional(),
    city: z.string().trim().min(1).max(CITY_MAX_LENGTH).optional(),
    timezone: z.string().trim().min(1).optional(),
    /**
     * Uploaded during onboarding, when there is no profile yet to `confirm`
     * against. The server still checks it points into our own bucket before
     * writing it — see `assertOwnBucket`; without that, this field would be a
     * way to point a profile at any host on the internet.
     */
    avatarUrl: z.url().optional(),
  })
  .refine(learningDoesNotOverlapNative, {
    message: 'A learning language cannot also be listed as native',
    path: ['learning'],
  })

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>

/**
 * Body of `PATCH /profiles/me`. Deliberately excludes `handle` (no rename —
 * changing it would break shared `/user/[handle]` links) and every
 * server-owned field (`entitlement`, `quota`, `streak`, `stats`, `avatarUrl`
 * — the last is set only via the upload-url confirm step, not free-form).
 */
/**
 * Body of `PATCH /profiles/me/country`. Its own route and its own schema
 * because a country is not a field somebody types: it comes from the
 * connection at sign-up, and afterwards only from a location fix the device
 * reverse-geocoded. Nothing else may set it.
 */
export const countryFromLocationSchema = z.object({
  country: countryCodeSchema,
  /** Only one source is accepted; naming it keeps the route honest. */
  source: z.literal('location'),
})
export type CountryFromLocationInput = z.infer<typeof countryFromLocationSchema>

export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema,
    bio: bioSchema,
    gender: genderSchema,
    nativeLanguages: nativeLanguagesSchema,
    learning: learningLanguagesSchema,
    interests: interestsSchema,
    city: z.string().trim().min(1).max(CITY_MAX_LENGTH),
    timezone: z.string().trim().min(1),
    /**
     * Which owned cosmetic to wear. A slot set to `null` clears it.
     *
     * Ownership is *not* checked here — a schema cannot see the profile — so
     * `updateProfile` refuses an id the caller does not own.
     */
    equipped: z.object({ frame: z.string().nullable(), title: z.string().nullable() }).partial(),
    settings: z
      .object({
        discoverable: z.boolean(),
        /**
         * Four kinds, two channels. `.partial()` here as well, so a screen
         * flipping one switch does not have to restate the other seven — the
         * repository writes dotted paths for the same reason `privacy` does.
         */
        notifications: notificationPrefsSchema,
      })
      .partial(),
    /**
     * `.partial()` on the inner object as well as the outer one. With two
     * keys and both required, every existing client sending
     * `{ privacy: { incognito } }` would start failing validation the moment
     * the second key landed. See `updateProfile` — a partial `privacy` also
     * has to be written as dotted paths, or the `$set` drops the other flag.
     */
    privacy: z
      .object({
        incognito: z.boolean(),
        hideOnlineStatus: z.boolean(),
        /**
         * The activity map on a public profile. Default on, because the streak
         * it is drawn from is already public — and free, unlike the two above:
         * this one is not a Pro feature, it is a preference.
         */
        activityMapVisible: z.boolean(),
        /**
         * The numbers above the map — streak, corrections, tokens — and the
         * week's chart. Default on for the same reason: they are a record of
         * teaching people, which is the thing this app is for. Off is for
         * anyone who would rather not be measured in public.
         */
        statsVisible: z.boolean(),
      })
      .partial(),
  })
  .partial()
  .refine(
    // Only checkable when both arrays are present in this same request — if
    // just one is being updated, the repository cross-checks it against the
    // profile already on file instead.
    (data) =>
      data.nativeLanguages === undefined ||
      data.learning === undefined ||
      learningDoesNotOverlapNative({
        nativeLanguages: data.nativeLanguages,
        learning: data.learning,
      }),
    { message: 'A learning language cannot also be listed as native', path: ['learning'] },
  )

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

/** Formats accepted for avatar uploads — matches what `expo-image-picker` commonly emits. */
export const AVATAR_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const avatarContentTypeSchema = z.enum(AVATAR_CONTENT_TYPES)

export const avatarConfirmSchema = z.object({ avatarUrl: z.url() })

/** `POST /me/photos` — confirm an upload and add it to the gallery. */
export const photoAddSchema = z.object({ url: z.url() })
export type PhotoAddInput = z.infer<typeof photoAddSchema>

/** `DELETE /me/photos` — remove one by its URL, which is what the client already holds. */
export const photoRemoveSchema = z.object({ url: z.url() })
export type PhotoRemoveInput = z.infer<typeof photoRemoveSchema>

/**
 * The profile behind a shared link, read without a session. A strict subset of
 * what a signed-in member sees — see `getSharedProfile` for what is left out
 * and why.
 */
export const sharedProfileSchema = z.object({
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  bio: z.string().optional(),
  country: z.string().optional(),
  nativeLanguages: z.array(z.object({ code: z.string() })),
  learning: z.array(z.object({ code: z.string(), level: languageLevelSchema })),
})
export type SharedProfile = z.infer<typeof sharedProfileSchema>
