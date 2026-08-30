/**
 * A city name reduced to something two people typing the same place will
 * agree on.
 *
 * `city` is free text — no picker, no geocode — so the same place arrives as
 * "İstanbul", "Istanbul", "istanbul" and " ISTANBUL ". Matching the raw field
 * would make the filter answer for whoever happened to type it the same way
 * as the searcher, which is worse than not having the filter: it returns a
 * short list rather than an empty one, so it looks like it worked.
 *
 * The stored key is written alongside the display value, never instead of it —
 * how somebody writes their own city is theirs to keep.
 */

/**
 * Turkish dotted/dotless i, before anything else touches the string.
 *
 * `'İ'.toLowerCase()` is `'i̇'` — an `i` plus a combining dot above — and
 * `'I'.toLowerCase()` is `'i'`, so İstanbul and Istanbul only meet if the dot
 * is removed as a diacritic and `ı` is mapped onto `i` by hand. Doing this
 * before `toLowerCase` keeps it independent of the runtime's locale, which is
 * the server's, not the user's.
 */
const TURKISH: Record<string, string> = { İ: 'I', I: 'I', ı: 'i', i: 'i' }

export function cityKey(city: string): string {
  return (
    [...city.trim()]
      .map((ch) => TURKISH[ch] ?? ch)
      .join('')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      // Punctuation and spacing vary more than spelling does: "St. Petersburg",
      // "St Petersburg" and "Saint-Petersburg" are one place typed three ways.
      .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
      .trim()
  )
}
