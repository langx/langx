import { getLanguage } from '@langx/shared'

/**
 * The exchanges shown on the welcome screen, in each language's own script.
 *
 * The first pair starts with the reader's own language, because "Türkçe ↔
 * English" says what this app is in a way that "Spanish ↔ Japanese" does not
 * — it says it *to them*. The rest are fixed, chosen to look unlike each other
 * at a glance: different scripts, different directions, no two from the same
 * family.
 *
 * Pure, and separated from the screen, because the one rule here is easy to
 * get wrong and invisible when you do: a language must never be paired with
 * itself. An English reader would otherwise be greeted by "English ↔ English".
 */
const FALLBACK_FIRST = 'es'
const REST: readonly (readonly [string, string])[] = [
  ['ja', 'fr'],
  ['ar', 'pt'],
]

export interface LanguagePair {
  /** Native names, ready to draw. */
  left: string
  right: string
}

function named(code: string): string | undefined {
  return getLanguage(code)?.nativeName
}

export function welcomePairs(locale: string): LanguagePair[] {
  // `pt-BR` is a locale; the language under it is `pt`.
  const own = locale.split('-')[0] ?? 'en'
  const partner = own === 'en' ? FALLBACK_FIRST : 'en'

  const pairs: LanguagePair[] = []
  const first = { left: named(own), right: named(partner) }
  if (first.left && first.right && own !== partner) {
    pairs.push({ left: first.left, right: first.right })
  }

  for (const [left, right] of REST) {
    // Never show the reader's own language twice, and never pair one with
    // itself — a Japanese reader gets the Arabic row and not "日本語 ↔ 日本語".
    if (left === own || right === own || left === right) continue
    const l = named(left)
    const r = named(right)
    if (l && r) pairs.push({ left: l, right: r })
  }
  return pairs
}
