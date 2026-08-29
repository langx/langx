import { DEFAULT_LOCALE, type Locale } from './locales'

/**
 * The message catalogue's shape, and the engine that reads one.
 *
 * Lives in `@langx/shared` because both sides need it: the app words its
 * screens with it, and the API words push notifications and emails with it.
 * Neither wants a second plural implementation, and Russian and Arabic are
 * exactly the languages where two implementations quietly disagree.
 *
 * No React and no catalogue here — only the rules.
 *
 * The whole design goal here is that a missing Turkish string is a **typecheck
 * failure**, not a silent English word in the middle of a Turkish screen.
 * Per-key runtime fallback is the usual answer and it is the wrong one for
 * this app: a user reading a language they are still learning cannot tell an
 * untranslated string from one they simply do not know yet.
 */

/**
 * A message whose wording depends on a count.
 *
 * The keys are CLDR plural categories, which differ per language — English has
 * `one` and `other`, Russian adds `few` and `many`, Arabic uses all six. Only
 * `other` is required, because every language has it and it is what selection
 * falls back to.
 */
export interface Plural {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other: string
}

/**
 * The CLDR category names, as a type and as a runtime set.
 *
 * A plural is recognised structurally, and `other: string` alone is not enough
 * to recognise it by: the gender group has an `other` — it is one of the four
 * options someone can pick — and was being read as a plural with three stray
 * keys. A plural is an object whose keys are *all* categories.
 */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

const PLURAL_CATEGORIES = new Set<string>(['zero', 'one', 'two', 'few', 'many', 'other'])

type IsPlural<T> = [keyof T] extends [PluralCategory]
  ? T extends { other: string }
    ? true
    : false
  : false

export type Message = string | Plural

/** A catalogue is a tree of messages; nesting groups them by screen. */
export interface Catalog {
  [key: string]: Message | Catalog
}

/**
 * Maps English's catalogue onto what another locale must provide: the same
 * keys, the same nesting, and a plural wherever English has one — but *not*
 * the same plural categories, since those belong to the target language.
 *
 * This is why `en.ts` is imported as a value and every other locale is
 * annotated with `Messages`: TypeScript then reports a missing key, a typo in
 * one, and a plain string where a plural is expected.
 */
export type Localized<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : IsPlural<T[K]> extends true
      ? Plural
      : Localized<T[K]>
}

/**
 * Every addressable key, as a dotted path — `'chat.emptyState.title'`.
 *
 * Making this a union rather than `string` is what turns a renamed key into a
 * compile error at all 40 call sites instead of a blank space on one screen
 * nobody opened before release.
 */
export type Paths<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : IsPlural<T[K]> extends true
      ? K
      : `${K}.${Paths<T[K]>}`
}[keyof T & string]

/** Values substituted into `{placeholders}`. */
export type MessageParams = Record<string, string | number>

/**
 * `Intl.PluralRules` is not free to construct and `t` is called dozens of
 * times per render, so the eight we can ever need are built once.
 */
const pluralRules = new Map<string, Intl.PluralRules | null>()

function rulesFor(locale: Locale): Intl.PluralRules | null {
  const cached = pluralRules.get(locale)
  if (cached !== undefined) return cached

  let rules: Intl.PluralRules | null
  try {
    rules = new Intl.PluralRules(locale)
  } catch {
    // Hermes ships full ICU on both platforms today, but a stripped build or
    // an old web engine can leave `Intl` partial. Losing the plural rules for
    // a locale should cost that locale its grammar, not the whole screen.
    rules = null
  }
  pluralRules.set(locale, rules)
  return rules
}

function isPlural(value: Message | Catalog): value is Plural {
  if (typeof value !== 'object' || typeof (value as Plural).other !== 'string') return false
  return Object.keys(value).every((key) => PLURAL_CATEGORIES.has(key))
}

/** Walks a dotted path. Returns `undefined` for anything that is not a leaf. */
function lookup(catalog: Catalog, key: string): Message | undefined {
  let node: Message | Catalog | undefined = catalog
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined
    node = (node as Catalog)[part]
  }
  if (node === undefined) return undefined
  return typeof node === 'string' || isPlural(node) ? node : undefined
}

/**
 * Picks the wording for a count.
 *
 * The chosen category can be absent — a translator who filled `one` and
 * `other` for a language that also uses `few` leaves a hole — so `other` is
 * the fallback. It is the one category every language defines, which is why
 * the `Plural` type requires it and nothing else.
 */
function selectPlural(plural: Plural, locale: Locale, count: number): string {
  const rules = rulesFor(locale)
  const category = rules ? rules.select(count) : count === 1 ? 'one' : 'other'
  return plural[category] ?? plural.other
}

/**
 * Substitutes `{name}` placeholders.
 *
 * A placeholder with no matching parameter is **left in the text on purpose**.
 * Replacing it with an empty string produces a sentence with a hole in it that
 * reads like a translation problem and gets reported as one; leaving `{name}`
 * visible names the bug for whoever sees it. Neither is good, and only one is
 * diagnosable.
 */
function interpolate(text: string, params?: MessageParams): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

/**
 * Resolves one key against one catalogue.
 *
 * `fallback` is English, and it exists for a case the type system cannot
 * cover: `expo-updates` can hand a running app a JS bundle whose catalogues
 * are newer than the screen calling into them. Within a single build the
 * fallback is unreachable — `Localized<typeof en>` makes a missing key a
 * compile error — and the last resort returns the key itself, which is ugly
 * and greppable rather than blank and invisible.
 */
export function translate(
  catalog: Catalog,
  fallback: Catalog,
  locale: Locale,
  key: string,
  params?: MessageParams,
): string {
  const message = lookup(catalog, key) ?? lookup(fallback, key)
  if (message === undefined) return key

  if (typeof message === 'string') return interpolate(message, params)

  const count = params?.count
  if (typeof count !== 'number') {
    // A plural asked for without a count cannot be selected. `other` is the
    // form that reads least wrongly on its own.
    return interpolate(message.other, params)
  }
  const localeForRules = lookup(catalog, key) === undefined ? DEFAULT_LOCALE : locale
  return interpolate(selectPlural(message, localeForRules, count), params)
}
