import { z } from 'zod'

/**
 * The languages the **interface** is available in.
 *
 * Not to be confused with `languages.ts`, which is the full ISO 639-1 set of
 * languages people can speak, teach and learn. That list has hundreds of
 * entries and is data; this one has eight and is a promise — every string in
 * the app exists in every locale here, and CI fails if one does not.
 *
 * Adding a locale is therefore a deliberate act with a translation cost
 * attached, which is the point: a half-filled locale that falls back to
 * English per-string is worse than not offering the language at all, because
 * the user cannot tell which half they are reading.
 *
 * `pt-BR` rather than `pt` because the two diverge in exactly the register
 * this app writes in — second person, imperatives, the word for "you" — and
 * Brazil is where the users are. `resolveLocale` sends European Portuguese
 * here anyway; a near-match beats English.
 */
export const SUPPORTED_LOCALES = ['en', 'tr', 'es', 'ru', 'ar', 'fr', 'de', 'pt-BR'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

/**
 * The fallback, and the source of truth for the message catalogue: every other
 * locale's catalogue is typed against English's, so a key that exists here and
 * nowhere else is a compile error rather than a silent gap.
 */
export const DEFAULT_LOCALE: Locale = 'en'

export const localeSchema = z.enum(SUPPORTED_LOCALES)

/**
 * Written right to left. Kept as a list rather than asked of `Intl` at runtime
 * because the answer has to be available before any React tree renders — the
 * native side needs `I18nManager.forceRTL` at startup — and because a
 * hard-coded set of eight is not a thing that can drift.
 */
export const RTL_LOCALES: readonly Locale[] = ['ar']

export function isRtlLocale(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale)
}

/**
 * What each language calls itself, for the picker.
 *
 * Endonyms, not English names: someone looking for their own language scans
 * for the word they would write, and "Türkçe" is findable to a Turkish speaker
 * currently staring at an English UI in a way "Turkish" is not.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
  es: 'Español',
  ru: 'Русский',
  ar: 'العربية',
  fr: 'Français',
  de: 'Deutsch',
  'pt-BR': 'Português (Brasil)',
}

function isSupported(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/** The part of a BCP 47 tag before the first subtag: `pt-BR` → `pt`. */
function baseLanguage(tag: string): string {
  return tag.split('-')[0]!.toLowerCase()
}

/**
 * Picks the best supported locale for an ordered list of BCP 47 tags — a
 * device's language preferences, or an `Accept-Language` header already sorted
 * by quality.
 *
 * Each candidate is tried in turn, exactly first and then by base language, so
 * a device set to `['pt-PT', 'en-US']` gets Brazilian Portuguese rather than
 * English: the whole point of the ordering is that the user prefers the first
 * one they can have. Only when a candidate matches nothing at all does the
 * next get a turn.
 *
 * Anything unparseable — an empty string, a stray `undefined` from a platform
 * API — is skipped rather than defaulted on, so one bad entry in a list cannot
 * cost the user the good entry behind it.
 */
export function resolveLocale(candidates: readonly (string | null | undefined)[]): Locale {
  for (const candidate of candidates) {
    if (!candidate) continue
    const tag = candidate.trim()
    if (!tag) continue

    // Exact, case-insensitively: platforms disagree on `pt-br` vs `pt-BR`.
    const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === tag.toLowerCase())
    if (exact) return exact

    const base = baseLanguage(tag)
    if (isSupported(base)) return base

    // `pt-PT` → the only `pt-*` we ship. Regional variants of a language we
    // support are always closer than the English fallback.
    const regional = SUPPORTED_LOCALES.find((l) => baseLanguage(l) === base)
    if (regional) return regional
  }
  return DEFAULT_LOCALE
}
