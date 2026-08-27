import { isLanguageCode, type CefrLevel, type Gender } from '@langx/shared'

/**
 * Translating v1's Appwrite documents into v2's vocabulary.
 *
 * Lives here rather than inside the migration script because it is the part
 * with judgement in it — every rule below is a decision about someone's real
 * profile, and decisions deserve tests. The script is then just I/O.
 *
 * Every mapping was derived from the *live* v1 data (scripts/inspect-v1.ts),
 * not from v1's source: a legacy collection keeps fields the code stopped
 * writing and loses fields the code still writes.
 */

/**
 * v1 stored a numeric proficiency; v2 speaks CEFR. Observed live: `-1` marks a
 * mother tongue and learning languages use 0–3.
 *
 * Mapped conservatively — the top of v1's scale becomes B2, not C2. An
 * inflated level produces confident bad matches, and a user who really is C1
 * fixes it in one tap; someone wrongly labelled C2 has to notice first.
 */
export const LEVEL_TO_CEFR: Record<number, CefrLevel> = {
  0: 'A1',
  1: 'A2',
  2: 'B1',
  3: 'B2',
}

const GENDERS = new Set<Gender>(['female', 'male', 'other', 'undisclosed'])

export interface V1Language {
  code?: unknown
  level?: unknown
  motherLanguage?: unknown
}

export interface MappedLanguages {
  nativeLanguages: { code: string }[]
  learning: { code: string; level: CefrLevel; priority: number }[]
}

/** The live data is mostly lowercase but not entirely — one "Male" per 500. */
export function toGender(value: unknown): Gender | undefined {
  if (typeof value !== 'string') return undefined
  const normalised = value.trim().toLowerCase()
  return GENDERS.has(normalised as Gender) ? (normalised as Gender) : undefined
}

export function toBirthYear(value: unknown, now: Date = new Date()): number | undefined {
  if (typeof value !== 'string') return undefined
  const year = new Date(value).getUTCFullYear()
  return Number.isFinite(year) && year > 1900 && year < now.getUTCFullYear() ? year : undefined
}

export function mapLanguages(value: unknown): MappedLanguages {
  const nativeLanguages: { code: string }[] = []
  const learning: { code: string; level: CefrLevel; priority: number }[] = []
  if (!Array.isArray(value)) return { nativeLanguages, learning }

  const seenNative = new Set<string>()
  const seenLearning = new Set<string>()

  for (const raw of value as V1Language[]) {
    const code = typeof raw.code === 'string' ? raw.code.toLowerCase() : ''
    // v1's list was not constrained to ISO 639-1. Anything v2 cannot represent
    // is dropped rather than stored as a code discovery could never match.
    if (!isLanguageCode(code)) continue

    if (raw.motherLanguage === true || raw.level === -1) {
      if (!seenNative.has(code)) {
        seenNative.add(code)
        nativeLanguages.push({ code })
      }
      continue
    }
    if (seenLearning.has(code)) continue
    seenLearning.add(code)
    const level = LEVEL_TO_CEFR[typeof raw.level === 'number' ? raw.level : 0] ?? 'A1'
    learning.push({ code, level, priority: learning.length + 1 })
  }

  // v2 refuses a language listed as both native and learning, and so does the
  // onboarding schema this data eventually flows through.
  const filtered = learning.filter((l) => !seenNative.has(l.code))
  return {
    nativeLanguages,
    // Priorities must stay contiguous after the filter.
    learning: filtered.map((l, index) => ({ ...l, priority: index + 1 })),
  }
}

/** A profile with only one side of the language pair can never be matched. */
export function isMatchable(languages: MappedLanguages): boolean {
  return languages.nativeLanguages.length > 0 && languages.learning.length > 0
}
