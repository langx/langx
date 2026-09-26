/**
 * Which messages can be shown in Latin letters ("how it reads").
 *
 * Google Cloud Translation v3 `romanizeText` (Preview, priced as ordinary
 * NMT characters) romanizes only these languages as of September 2026 — not
 * Chinese, Korean, Greek, Hebrew or Thai. Each is keyed to the scripts it is
 * written in, so the client can decide from the text alone whether the menu
 * row would work: a Han-only sentence is most likely Chinese, which Google
 * refuses, so Han is deliberately absent and Japanese is recognised by kana.
 */
export const ROMANIZATION_SCRIPTS = {
  am: ['Ethiopic'],
  ar: ['Arabic'],
  be: ['Cyrillic'],
  bn: ['Bengali'],
  hi: ['Devanagari'],
  ja: ['Hiragana', 'Katakana'],
  my: ['Myanmar'],
  ru: ['Cyrillic'],
  sr: ['Cyrillic'],
  uk: ['Cyrillic'],
} as const satisfies Record<string, readonly string[]>

export const ROMANIZATION_LANGUAGES = Object.keys(ROMANIZATION_SCRIPTS)

const SCRIPTS = [...new Set(Object.values(ROMANIZATION_SCRIPTS).flat())]

/**
 * Compiled inside a `try`, as `singleEmoji.ts` does: Hermes may lack Unicode
 * property escapes, and an engine without them must hide the feature rather
 * than crash the bundle at import. The lookahead keeps it to letters, so an
 * Arabic-Indic digit or comma alone does not count.
 */
const ROMANIZABLE_LETTER = ((): RegExp | null => {
  try {
    return new RegExp(`(?=\\p{L})[${SCRIPTS.map((s) => `\\p{Script=${s}}`).join('')}]`, 'u')
  } catch {
    return null
  }
})()

/** Whether the text has letters in a script Google can romanize. */
export function needsRomanization(text: string): boolean {
  return ROMANIZABLE_LETTER !== null && ROMANIZABLE_LETTER.test(text)
}
