import { afterEach, describe, expect, it } from 'vitest'
import { translate, type Catalog } from './i18n'
import { SUPPORTED_LOCALES, type Locale } from './locales'
import { pluralCategory } from './pluralRules'

describe('pluralCategory at the CLDR boundaries', () => {
  const cases: Record<Locale, [number, string][]> = {
    en: [
      [0, 'other'],
      [1, 'one'],
      [2, 'other'],
      [1.5, 'other'],
      [21, 'other'],
    ],
    de: [
      [0, 'other'],
      [1, 'one'],
      [2, 'other'],
      [1.5, 'other'],
    ],
    tr: [
      [0, 'other'],
      [1, 'one'],
      [2, 'other'],
      [1.5, 'other'],
    ],
    es: [
      [0, 'other'],
      [1, 'one'],
      [2, 'other'],
      [1_000_000, 'many'],
      [1_000_001, 'other'],
    ],
    fr: [
      [0, 'one'],
      [1, 'one'],
      [1.5, 'one'],
      [2, 'other'],
      [2_000_000, 'many'],
    ],
    'pt-BR': [
      [0, 'one'],
      [1, 'one'],
      [1.5, 'one'],
      [2, 'other'],
      [1_000_000, 'many'],
    ],
    ru: [
      [0, 'many'],
      [1, 'one'],
      [2, 'few'],
      [4, 'few'],
      [5, 'many'],
      [11, 'many'],
      [12, 'many'],
      [14, 'many'],
      [21, 'one'],
      [22, 'few'],
      [25, 'many'],
      [101, 'one'],
      [111, 'many'],
      [112, 'many'],
      [1.5, 'other'],
    ],
    ar: [
      [0, 'zero'],
      [1, 'one'],
      [2, 'two'],
      [3, 'few'],
      [10, 'few'],
      [11, 'many'],
      [99, 'many'],
      [100, 'other'],
      [101, 'other'],
      [102, 'other'],
      [103, 'few'],
      [111, 'many'],
      [1000, 'other'],
      [3.5, 'other'],
    ],
  }

  for (const locale of SUPPORTED_LOCALES) {
    it(locale, () => {
      for (const [count, expected] of cases[locale]) {
        expect([count, pluralCategory(locale, count)]).toEqual([count, expected])
      }
    })
  }

  it('reads a negative count by its magnitude and a non-number as other', () => {
    expect(pluralCategory('ru', -3)).toBe('few')
    expect(pluralCategory('ar', NaN)).toBe('other')
    expect(pluralCategory('en', Infinity)).toBe('other')
  })
})

describe('pluralCategory agrees with ICU', () => {
  // Node carries full ICU, so its `Intl.PluralRules` is the reference the
  // hand-written table is held to. A slip in one branch of one locale shows
  // up here as the first count where the two disagree.
  const counts = [
    ...Array.from({ length: 2001 }, (_, n) => n),
    ...[1e4, 1e5, 1e6, 2e6, 1e6 + 1, 1e7, 1e9],
    ...[0.1, 0.5, 1.1, 1.5, 2.25, 3.5, 10.5, 11.75, 21.5, 100.5, 1.0004],
  ]

  for (const locale of SUPPORTED_LOCALES) {
    it(locale, () => {
      const icu = new Intl.PluralRules(locale)
      const mismatches = counts
        .filter((count) => pluralCategory(locale, count) !== icu.select(count))
        .map((count) => `${count}: ${pluralCategory(locale, count)} ≠ ${icu.select(count)}`)
      expect(mismatches).toEqual([])
    })
  }
})

describe('translate without Intl.PluralRules', () => {
  // What Hermes looks like: `Intl` exists, `Intl.PluralRules` does not. Before
  // the table, this is the state in which every Arabic count read one/other.
  const original = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')!
  afterEach(() => {
    Object.defineProperty(Intl, 'PluralRules', original)
  })

  const catalog: Catalog = {
    replies: {
      zero: 'لا ردود',
      one: 'ردّ واحد',
      two: 'ردّان',
      few: '{count} ردود',
      many: '{count} ردًّا',
      other: '{count} ردّ',
    },
  }

  it('still picks all six Arabic forms', () => {
    Reflect.deleteProperty(Intl, 'PluralRules')
    expect(Intl.PluralRules).toBeUndefined()

    const t = (count: number) => translate(catalog, catalog, 'ar', 'replies', { count })
    expect(t(0)).toBe('لا ردود')
    expect(t(1)).toBe('ردّ واحد')
    expect(t(2)).toBe('ردّان')
    expect(t(7)).toBe('7 ردود')
    expect(t(11)).toBe('11 ردًّا')
    expect(t(100)).toBe('100 ردّ')
  })
})
