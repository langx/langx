import { z } from 'zod'
import { MAX_MESSAGE_LENGTH } from './chat'
import { isTranslatableLanguage, languageCodeSchema } from './languages'

/**
 * A language with no written form — a signed one — cannot be a translation
 * target or source. Refused here, before the quota is spent, rather than by
 * the provider afterwards. See `SIGNED_LANGUAGE_CODES`.
 */
export const translatableLanguageSchema = languageCodeSchema.refine(isTranslatableLanguage, {
  message: 'This language has no written form to translate to',
})

export const translateRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  targetLang: translatableLanguageSchema,
  /** Omit to let the provider auto-detect. */
  sourceLang: translatableLanguageSchema.optional(),
})
export type TranslateRequestInput = z.infer<typeof translateRequestSchema>

export const translateResponseSchema = z.object({
  translatedText: z.string(),
  sourceLang: z.string(),
  /** Served from `translationCache` — a cache hit never costs quota, see the plan's Faz 6 acceptance criterion. */
  cached: z.boolean(),
})
export type TranslateResponse = z.infer<typeof translateResponseSchema>

/**
 * Which language a translated message is shown in.
 *
 * The person's own choice from Settings if it is still one of their native
 * languages and still translatable; otherwise their first native language
 * that is. Native languages only — translating into what someone is
 * *learning* would defeat the purpose — and the choice is re-checked against
 * the current list rather than trusted, because languages can be edited after
 * it was made. `undefined` means there is nothing to translate into (every
 * native language is signed), and the Translate action stays hidden.
 */
export function translateTargetFor(profile: {
  nativeLanguages: { code: string }[]
  settings?: { translateTo?: string | null } | undefined
}): string | undefined {
  const chosen = profile.settings?.translateTo
  const candidates = profile.nativeLanguages.map((l) => l.code).filter(isTranslatableLanguage)
  if (chosen && candidates.includes(chosen)) return chosen
  return candidates[0]
}

/** The languages the Settings row offers: the native ones with a written form. */
export function translateTargetOptions(profile: { nativeLanguages: { code: string }[] }): string[] {
  return profile.nativeLanguages.map((l) => l.code).filter(isTranslatableLanguage)
}
