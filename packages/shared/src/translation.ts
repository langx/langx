import { z } from 'zod'
import { MAX_MESSAGE_LENGTH } from './chat'
import { isTranslatableLanguage, languageCodeSchema } from './languages'

/**
 * A language with no written form — a signed one — cannot be a translation
 * target or source. Refused here, before the quota is spent, rather than by
 * the provider afterwards. See `SIGNED_LANGUAGE_CODES`.
 */
const translatableLanguageSchema = languageCodeSchema.refine(isTranslatableLanguage, {
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
