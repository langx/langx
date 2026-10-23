/**
 * The name other people see: every word but the last, then the last word's
 * first letter and a dot. "Behic Sakar" is "Behic S." to anyone but Behic.
 *
 * Applied by the API to every name that leaves it for somebody other than its
 * owner, never by the client: an app that shortens what it was sent still
 * received the surname, and the 2.9 builds in the stores would keep showing it.
 * See `docs/decisions.md` → _Other people see a first name and an initial_.
 *
 * What it leaves alone, and why:
 *
 * - **One word** ("Cher"). There is no surname to shorten.
 * - **A name already ending in an initial** ("Behic S."), so the rule is
 *   idempotent and somebody who chose that form keeps it exactly.
 * - **Chinese, Japanese and Korean script.** These are written family name
 *   first and usually without a space, so "the last word" is either the whole
 *   name or the given name — shortening it would hide the wrong half.
 *
 * The initial is one grapheme, not one code point: "Ana 👩‍👩‍👧" keeps the whole
 * family emoji, and a decomposed "Ş" keeps its cedilla. `Intl.Segmenter` does
 * that where it exists (Node, which is where this runs); the fallback below
 * covers an engine without it, Hermes among them.
 */
export function shortDisplayName(name: string): string {
  const words = name.trim().split(/\s+/)
  const last = words.at(-1) ?? ''
  if (words.length < 2 || (FAMILY_NAME_FIRST?.test(name) ?? false)) return words.join(' ')
  const initial = firstGrapheme(last)
  if (last === `${initial}.`) return words.join(' ')
  return [...words.slice(0, -1), `${initial}.`].join(' ')
}

// Compiled inside a `try`, as in `singleEmoji.ts`: an engine without Unicode
// property escapes must shorten fewer names, not crash the bundle at import.
const FAMILY_NAME_FIRST = compile(
  '[\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}]',
)
const FIRST_CLUSTER = compile(
  '^(?:[\\u{1F1E6}-\\u{1F1FF}]{2}|.(?:[\\p{M}\\u{FE0E}\\u{FE0F}\\u{1F3FB}-\\u{1F3FF}\\u{E0020}-\\u{E007F}]|\\u{200D}.)*)',
)

function compile(source: string): RegExp | null {
  try {
    return new RegExp(source, 'u')
  } catch {
    return null
  }
}

function firstGrapheme(word: string): string {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word)
    const first = segments[Symbol.iterator]().next()
    if (!first.done) return first.value.segment
  }
  return FIRST_CLUSTER?.exec(word)?.[0] ?? Array.from(word)[0] ?? ''
}
