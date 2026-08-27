import { birthYearSchema } from './age'
import { cefrLevelSchema } from './cefr'
import { handleSchema } from './handle'
import { languageCodeSchema } from './languages'
import { z } from 'zod'

export const GENDERS = ['female', 'male', 'other', 'undisclosed'] as const
export type Gender = (typeof GENDERS)[number]
export const genderSchema = z.enum(GENDERS)

const nativeLanguageSchema = z.object({ code: languageCodeSchema })

const learningLanguageSchema = z.object({
  code: languageCodeSchema,
  level: cefrLevelSchema,
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
const MAX_INTERESTS = 10
const BIO_MAX_LENGTH = 500
const DISPLAY_NAME_MAX_LENGTH = 50

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
    country: z.string().trim().min(1).max(2).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    timezone: z.string().trim().min(1).optional(),
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
    country: z.string().trim().min(1).max(2),
    city: z.string().trim().min(1).max(100),
    timezone: z.string().trim().min(1),
    settings: z.object({
      discoverable: z.boolean(),
      notifications: z.boolean(),
      ageRange: z.tuple([z.number().int().min(18), z.number().int().min(18)]),
      distanceKm: z.number().int().positive(),
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
