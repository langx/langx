import {
  COSMETICS,
  GENDERS,
  INTEREST_SUGGESTIONS,
  LANGUAGE_LEVELS,
  NOTIFICATION_TYPES,
  PERIOD_TYPES,
  SUPPORTED_LOCALES,
  type Catalog,
  type Locale,
  type Message,
} from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'
import {
  accountAgeLabel,
  genderLabel,
  interestLabel,
  levelLabel,
  levelShortLabel,
  periodLabel,
} from './labels'
import { en } from './messages/en'
import { createTranslate } from './runtime'

/**
 * What the type system cannot check.
 *
 * `Localized<EnMessages>` guarantees every locale has every key. It cannot
 * guarantee that a translator kept the `{placeholders}` — and a dropped one is
 * the worst kind of bug here, because it does not throw: the sentence simply
 * arrives with the name, the count or the date missing, in a language nobody
 * on the team reads.
 */

function isPlural(value: Message | Catalog): boolean {
  return typeof value === 'object' && typeof (value as { other?: unknown }).other === 'string'
}

/** Every leaf string, keyed by its dotted path (plural forms get `key#category`). */
function leaves(catalog: Catalog, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out.set(path, value)
    else if (isPlural(value)) {
      for (const [category, form] of Object.entries(value)) {
        if (typeof form === 'string') out.set(`${path}#${category}`, form)
      }
    } else {
      for (const [inner, form] of leaves(value as Catalog, path)) out.set(inner, form)
    }
  }
  return out
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort()
}

/** A plural's forms may legitimately drop `{count}` — "yesterday", "one day" —
 *  so the union across a key's forms is what has to match English's. */
function placeholdersByKey(catalog: Catalog): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const [path, text] of leaves(catalog)) {
    const key = path.split('#')[0]!
    const set = out.get(key) ?? new Set<string>()
    for (const name of placeholders(text)) set.add(name)
    out.set(key, set)
  }
  return out
}

const english = placeholdersByKey(en)

describe.each(SUPPORTED_LOCALES.filter((l) => l !== 'en'))('%s', (locale: Locale) => {
  const translated = placeholdersByKey(catalogs[locale])

  it('has exactly English’s keys', () => {
    expect([...translated.keys()].sort()).toEqual([...english.keys()].sort())
  })

  it('keeps every placeholder English uses, and invents none', () => {
    const wrong: string[] = []
    for (const [key, expected] of english) {
      const actual = translated.get(key) ?? new Set<string>()
      const missing = [...expected].filter((name) => !actual.has(name))
      const extra = [...actual].filter((name) => !expected.has(name))
      if (missing.length || extra.length) {
        wrong.push(`${key}: missing ${missing.join(',') || '—'}, extra ${extra.join(',') || '—'}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('leaves no message empty', () => {
    const empty = [...leaves(catalogs[locale])]
      .filter(([, text]) => text.trim().length === 0)
      .map(([path]) => path)
    expect(empty).toEqual([])
  })

  it('never ships an untranslated copy of the whole catalogue', () => {
    // A locale wired to `en` as a placeholder is the failure this branch went
    // through twice; identical sentences here would mean it happened again.
    const mine = leaves(catalogs[locale])
    const same = [...leaves(en)].filter(([path, text]) => mine.get(path) === text)
    // Brand names, emoji labels and a few short words legitimately match.
    expect(same.length).toBeLessThan(60)
  })
})

/**
 * The keys the compiler does not check.
 *
 * `labels.ts` builds a handful of keys from enum values — `gender.${gender}`,
 * `level.short${Level}` — and every one of them needs an `as MessageKey` to
 * compile, which is a cast: it asserts the key exists rather than proving it.
 * Rename a value in `@langx/shared` and the app keeps building, falls through
 * English, and finally renders the key itself on screen.
 *
 * `translate` returns the key verbatim when it can find nothing, which is what
 * makes this checkable: a resolved message never equals its own key.
 */
describe('dynamically built keys', () => {
  const t = createTranslate('en')

  it('resolves one for every gender', () => {
    for (const gender of GENDERS) expect(genderLabel(t, gender)).not.toBe(`gender.${gender}`)
  })

  it('resolves one for every language level, long and short', () => {
    for (const level of LANGUAGE_LEVELS) {
      expect(levelLabel(t, level)).not.toBe(`level.${level}`)
      expect(levelShortLabel(t, level)).not.toContain('level.short')
    }
  })

  it('resolves one for every leaderboard period', () => {
    for (const period of PERIOD_TYPES) expect(periodLabel(t, period)).not.toBe(`period.${period}`)
  })

  it('resolves one for every suggested interest', () => {
    for (const interest of INTEREST_SUGGESTIONS) {
      expect(interestLabel(t, interest)).not.toBe(`interests.${interest}`)
    }
  })

  it('resolves one for every cosmetic in the catalogue', () => {
    // `frame.gold` → `cosmetics.frameGold`; the store row shows whatever comes
    // back, so a miss here is a SKU rendered as a dotted path in the shop.
    const shown = COSMETICS.map((item) => item.id)
    for (const id of shown) {
      const label = t(
        `cosmetics.${id.split('.')[0]}${id.split('.')[1]![0]!.toUpperCase()}${id.split('.')[1]!.slice(1)}` as never,
      )
      expect(label).not.toContain('cosmetics.')
    }
  })

  /*
   * `settings.tsx` builds these with an `as MessageKey` cast, which is what
   * makes them worth a test: adding a notification kind compiles either way,
   * and without this the missing label ships as a dotted path on a row nobody
   * looks at twice.
   */
  it('resolves a title and a body for every notification kind', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(t(`notifications.${type}` as never), type).not.toContain('notifications.')
      expect(t(`notifications.${type}Body` as never), type).not.toContain('notifications.')
    }
  })

  it('resolves one for every account-age unit the shared helper can return', () => {
    const now = new Date('2026-08-29T12:00:00Z')
    const days = (n: number) => new Date(now.getTime() - n * 86_400_000)
    // today, days, months, years — the four branches of `accountAge`.
    for (const age of [0, 5, 95, 900]) {
      expect(accountAgeLabel(t, days(age), now)).not.toContain('format.accountAge')
    }
  })
})
