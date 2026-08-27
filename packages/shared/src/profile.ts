import { countryCodeSchema } from './countries'
import { birthYearSchema } from './age'
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

const MAX_LANGUAGES = 5
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
const nativeLanguagesSchema = z.array(nativeLanguageSchema).min(1).max(MAX_LANGUAGES)
const learningLanguagesSchema = z.array(learningLanguageSchema).min(1).max(MAX_LANGUAGES)

/**
 * Body of `POST /profiles` — onboarding. `birthYear` is validated here
 * server-side (see age.ts's doc comment on why this, not the client, is the
 * real gate) rather than at Better Auth sign-up, because OAuth accounts
 * (Google/Apple) never pass through a form that could collect it there.
 */
export const onboardingProfileSchema = z
  .object({
    handle: handleSchema,
    displayName: displayNameSchema,
    birthYear: birthYearSchema(),
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
export const updateProfileSchema = z
  .object({
    displayName: displayNameSchema,
    bio: bioSchema,
    gender: genderSchema,
    nativeLanguages: nativeLanguagesSchema,
    learning: learningLanguagesSchema,
    interests: interestsSchema,
    country: countryCodeSchema,
    city: z.string().trim().min(1).max(CITY_MAX_LENGTH),
    timezone: z.string().trim().min(1),
    settings: z.object({
      discoverable: z.boolean(),
      notifications: z.boolean(),
    }),
    privacy: z.object({ incognito: z.boolean() }),
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
