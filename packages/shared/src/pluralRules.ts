import type { PluralCategory } from './i18n'
import type { Locale } from './locales'

/**
 * CLDR plural rules for the eight interface locales, written out by hand.
 *
 * Hermes does not ship `Intl.PluralRules` — not on iOS, not on Android. Its
 * `Intl` covers `Collator`, `DateTimeFormat` and `NumberFormat` and nothing
 * else, so on a device `new Intl.PluralRules('ru')` throws and every count
 * read `one` or `other`: "7 تعليق", "5 ответ". Web and Node have full ICU,
 * which is why the tests and the browser never saw it.
 *
 * The table is used everywhere rather than only when `Intl` is missing, so the
 * phone, the web build, the API's emails and vitest all take the same path.
 * An `Intl`-first design would leave the path the phone runs as the one no
 * test exercises. `pluralRules.test.ts` checks this table against Node's ICU
 * over thousands of values, so a transcription slip fails CI instead of
 * reaching a Russian screen.
 *
 * Source: https://www.unicode.org/cldr/charts/47/supplemental/language_plural_rules.html
 */

/**
 * The CLDR operands a rule can read. Only the ones these eight locales use:
 * `n` absolute value, `i` its integer digits, `v` the number of visible
 * fraction digits.
 */
interface Operands {
  n: number
  i: number
  v: number
}

/**
 * `Record<Locale, …>` so adding a ninth locale is a compile error until its
 * rule is written — a missing rule would silently read English grammar.
 */
const RULES: Record<Locale, (o: Operands) => PluralCategory> = {
  en: ({ i, v }) => (i === 1 && v === 0 ? 'one' : 'other'),
  de: ({ i, v }) => (i === 1 && v === 0 ? 'one' : 'other'),
  tr: ({ n }) => (n === 1 ? 'one' : 'other'),
  // Spanish, French and Portuguese gained a `many` for exact millions in
  // CLDR 42 ("1 millón de…"). No catalogue fills it today, so it falls back
  // to `other`, but reporting it keeps this table equal to ICU's.
  es: ({ n, i, v }) => (n === 1 ? 'one' : isMillions(i, v) ? 'many' : 'other'),
  fr: ({ i, v }) => (i === 0 || i === 1 ? 'one' : isMillions(i, v) ? 'many' : 'other'),
  // Brazilian, not European: `pt-PT` has English's rule, `pt` counts 0 and
  // 1.5 as `one`.
  'pt-BR': ({ i, v }) => (i === 0 || i === 1 ? 'one' : isMillions(i, v) ? 'many' : 'other'),
  ru: ({ i, v }) => {
    if (v !== 0) return 'other'
    const mod10 = i % 10
    const mod100 = i % 100
    if (mod10 === 1 && mod100 !== 11) return 'one'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'
    return 'many'
  },
  ar: ({ n }) => {
    if (n === 0) return 'zero'
    if (n === 1) return 'one'
    if (n === 2) return 'two'
    // CLDR's `n % 100 = 3..10` is a range of integers, so 3.5 matches
    // neither band and reads `other`.
    if (!Number.isInteger(n)) return 'other'
    const mod100 = n % 100
    if (mod100 >= 3 && mod100 <= 10) return 'few'
    if (mod100 >= 11) return 'many'
    return 'other'
  },
}

function isMillions(i: number, v: number): boolean {
  return v === 0 && i !== 0 && i % 1_000_000 === 0
}

/**
 * `v` counts fraction digits as the number would be displayed. Intl's
 * default display keeps at most three, so 1.0004 is shown — and pluralised —
 * as "1". Rounding the same way keeps the table equal to `Intl` there.
 */
function operands(count: number): Operands {
  const n = Math.round(Math.abs(count) * 1000) / 1000
  const fraction = String(n).split('.')[1] ?? ''
  return { n, i: Math.trunc(n), v: fraction.length }
}

/** The CLDR plural category `count` falls into in `locale`. */
export function pluralCategory(locale: Locale, count: number): PluralCategory {
  if (!Number.isFinite(count)) return 'other'
  return RULES[locale](operands(count))
}
