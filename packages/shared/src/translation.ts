import { z } from 'zod'
import { MAX_MESSAGE_LENGTH } from './chat'
import { languageCodeSchema } from './languages'

export const translateRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  targetLang: languageCodeSchema,
  /** Omit to let the provider auto-detect. */
  sourceLang: languageCodeSchema.optional(),
})
export type TranslateRequestInput = z.infer<typeof translateRequestSchema>

export const translateResponseSchema = z.object({
  translatedText: z.string(),
  sourceLang: z.string(),
  /** Served from `translationCache` — a cache hit never costs quota, see the plan's Faz 6 acceptance criterion. */
  cached: z.boolean(),
})
export type TranslateResponse = z.infer<typeof translateResponseSchema>
