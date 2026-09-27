import { inAllCaps, isLetter, isUpper, withCase } from './casing'

/**
 * Cyrillic in Latin letters, one table per language.
 *
 * One scheme per language, chosen for someone *reading* it rather than for a
 * librarian round-tripping it — no diacritics a learner cannot type, except
 * where the language already has an official Latin alphabet of its own:
 *
 * - **Russian** — BGN/PCGN (1947) with its primes and dots dropped: `ь` and
 *   `ъ` are silent, `ё` is `yo`, and `е` is `ye` at the start of a word and
 *   after a vowel or a sign, which is where it is said that way.
 * - **Ukrainian** — the national standard (Cabinet of Ministers resolution
 *   55, 2010), the one on Ukrainian passports: `г` is `h`, `и` is `y`, and
 *   `є ї й ю я` have a word-initial and a medial form.
 * - **Belarusian** — BGN/PCGN with diacritics dropped, `ў` as `w`. The
 *   national 2007 system writes `č š ž ŭ`, which is exact and unreadable to
 *   the learner this is for.
 * - **Serbian** — Gaj's Latin alphabet, which Serbian itself is written in
 *   every day. The one table here with diacritics, because they are the
 *   language's own letters rather than a scholar's.
 * - **Bulgarian** — the Streamlined System (Transliteration Act, 2009), the
 *   one on Bulgarian road signs: `щ` is `sht`, `ъ` is `a`, and a word-final
 *   `-ия` is `-ia`.
 *
 * Linear in the text: each letter looks at most one letter either side.
 */
export const CYRILLIC_LANGS = ['ru', 'uk', 'be', 'sr', 'bg'] as const
export type CyrillicLang = (typeof CYRILLIC_LANGS)[number]

interface Context {
  /** The previous letter, lowercased — past an in-word apostrophe. */
  prev: string | undefined
  /** The next character, lowercased. */
  next: string | undefined
  /** Nothing but a non-letter before it. An apostrophe does not count. */
  wordStart: boolean
  /** Directly after an apostrophe inside a word (`з'ехаць`, `м'ясо`). */
  afterApostrophe: boolean
}

type Rule = string | ((ctx: Context) => string)

const RU_VOWELS = 'аеёиоуыэюя'
const BE_VOWELS = 'аеёіоуыэюя'

/** BGN/PCGN's `ye`: at the start, after a vowel, after a sign or apostrophe. */
function iotated(vowels: string, plain: string, iotatedForm: string): (ctx: Context) => string {
  return (ctx) =>
    ctx.wordStart ||
    ctx.afterApostrophe ||
    (ctx.prev !== undefined && (vowels.includes(ctx.prev) || ctx.prev === 'ъ' || ctx.prev === 'ь'))
      ? iotatedForm
      : plain
}

/** `ё` after a hushing consonant is an `o` sound: `шёл` is `shol`, not `shyol`. */
function yo(ctx: Context): string {
  return ctx.prev !== undefined && 'жчшщц'.includes(ctx.prev) ? 'o' : 'yo'
}

/** Ukraine's rule: a word-initial form, a medial form, nothing else. */
function initial(first: string, medial: string): (ctx: Context) => string {
  return (ctx) => (ctx.wordStart ? first : medial)
}

const RU: Record<string, Rule> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: iotated(RU_VOWELS, 'e', 'ye'),
  ё: yo,
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

const UK: Record<string, Rule> = {
  а: 'a',
  б: 'b',
  в: 'v',
  // `зг` is `zgh`, so it is not read as the `zh` of `ж`.
  г: (ctx) => (ctx.prev === 'з' ? 'gh' : 'h'),
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: initial('ye', 'ie'),
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: initial('yi', 'i'),
  й: initial('y', 'i'),
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: initial('yu', 'iu'),
  я: initial('ya', 'ia'),
}

const BE: Record<string, Rule> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: iotated(BE_VOWELS, 'e', 'ye'),
  ё: yo,
  ж: 'zh',
  з: 'z',
  і: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ў: 'w',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
}

const SR: Record<string, Rule> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  ђ: 'đ',
  е: 'e',
  ж: 'ž',
  з: 'z',
  и: 'i',
  ј: 'j',
  к: 'k',
  л: 'l',
  љ: 'lj',
  м: 'm',
  н: 'n',
  њ: 'nj',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  ћ: 'ć',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'č',
  џ: 'dž',
  ш: 'š',
}

const BG: Record<string, Rule> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sht',
  ъ: 'a',
  ь: 'y',
  ю: 'yu',
  // The Act's one exception: `България` ends in `-ia`, not `-iya`.
  я: (ctx) => (ctx.prev === 'и' && !isLetter(ctx.next) ? 'a' : 'ya'),
}

const TABLES: Record<CyrillicLang, Record<string, Rule>> = {
  ru: RU,
  uk: UK,
  be: BE,
  sr: SR,
  bg: BG,
}

export function isCyrillic(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return code >= 0x0400 && code <= 0x052f
}

const APOSTROPHES = "'’ʼ"

/** Whether every Cyrillic letter in the text has an entry in that table. */
export function coversCyrillic(text: string, lang: CyrillicLang): boolean {
  const table = TABLES[lang]
  for (const ch of text) {
    if (isCyrillic(ch) && isLetter(ch) && table[ch.toLowerCase()] === undefined) return false
  }
  return true
}

/**
 * Which of the five a Cyrillic text is written in, from the letters only one
 * of them has. `undefined` when it has letters none of the five has — Kazakh,
 * Mongolian, Macedonian — which get no reading rather than a wrong one.
 *
 * Bulgarian has no letter of its own, but it lacks `ы э ё`, and its `ъ` is a
 * vowel that sits between consonants, where Russian's never does.
 */
export function detectCyrillicLang(text: string): CyrillicLang | undefined {
  const lower = text.toLowerCase()
  const has = (letters: string) => [...letters].some((l) => lower.includes(l))
  let lang: CyrillicLang
  if (has('ђћџјљњ')) lang = 'sr'
  else if (has('ў')) lang = 'be'
  else if (has('ґєї')) lang = 'uk'
  else if (has('і')) lang = has('ыэ') ? 'be' : 'uk'
  else if (has('ыэё')) lang = 'ru'
  else if (/ъ[^еёюя]/u.test(lower)) lang = 'bg'
  else lang = 'ru'
  return coversCyrillic(text, lang) ? lang : undefined
}

/**
 * Transliterates the Cyrillic in `text` by `lang`'s table; everything else
 * — Latin, digits, punctuation, emoji, other scripts — passes through as is.
 */
export function romanizeCyrillic(text: string, lang: CyrillicLang): string {
  const table = TABLES[lang]
  const chars = [...text]
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!
    const lower = ch.toLowerCase()
    const rule = isCyrillic(ch) ? table[lower] : undefined
    if (rule === undefined) {
      // An apostrophe inside a Ukrainian or Belarusian word marks a hard
      // consonant, which Latin letters show without it.
      if (
        (lang === 'uk' || lang === 'be') &&
        APOSTROPHES.includes(ch) &&
        isCyrillic(chars[i - 1] ?? ' ') &&
        isCyrillic(chars[i + 1] ?? ' ')
      ) {
        continue
      }
      out += ch
      continue
    }
    let prevRaw = chars[i - 1]
    const afterApostrophe =
      prevRaw !== undefined && APOSTROPHES.includes(prevRaw) && isLetter(chars[i - 2])
    if (afterApostrophe) prevRaw = chars[i - 2]
    const latin =
      typeof rule === 'string'
        ? rule
        : rule({
            prev: isLetter(prevRaw) ? prevRaw!.toLowerCase() : undefined,
            next: chars[i + 1]?.toLowerCase(),
            wordStart: !isLetter(prevRaw),
            afterApostrophe,
          })
    out += withCase(latin, isUpper(ch), inAllCaps(chars, i))
  }
  return out
}
