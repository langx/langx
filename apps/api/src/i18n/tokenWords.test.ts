import type { Catalog, Locale } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'

/**
 * What the token and the daily pool are called in what the server sends —
 * pushes and emails — held to the same words as the app. The app's catalogue
 * has the same checks in apps/mobile/src/i18n/tokenWords.test.ts; the two are
 * separate catalogues and a word fixed in one has been missed in the other.
 *
 * - es "bote", pt-BR "bolo" and fr "cagnotte" are what a lottery's prize pot
 *   is called. The pool is "fondo", "fundo" and "pot commun".
 * - Arabic calls the token رمز / رموز, not the loanword توكن.
 * - Russian, Spanish and Portuguese call it what token.langx.io calls it:
 *   токен, tokens. Both catalogues had grown a second word beside it —
 *   жетон, fichas — sometimes on the same screen.
 *
 * Letter lookarounds rather than `\b`, which treats "ã" as a word boundary.
 */
const NEVER: Partial<Record<Locale, { pattern: RegExp; old: string }[]>> = {
  es: [
    { pattern: /(?<!\p{L})botes?(?!\p{L})/iu, old: 'El bote de ayer' },
    { pattern: /(?<!\p{L})fichas?(?!\p{L})/iu, old: 'Tus fichas' },
  ],
  'pt-BR': [
    { pattern: /(?<!\p{L})bol(?:os?|ão|ões)(?!\p{L})/iu, old: 'O bolo de ontem' },
    { pattern: /(?<!\p{L})fichas?(?!\p{L})/iu, old: 'Suas fichas' },
  ],
  fr: [{ pattern: /cagnotte/iu, old: 'La cagnotte d’hier' }],
  ru: [{ pattern: /жетон/iu, old: 'Не хватает жетонов' }],
  ar: [{ pattern: /توكن/u, old: '+3 توكنات' }],
}

/** The nightly pool push names the pool, as the app's inbox row does. */
const POOL_WORD: Partial<Record<Locale, RegExp>> = {
  es: /^El fondo /,
  'pt-BR': /^O fundo /,
  fr: /^Le pot commun /,
}

function leaves(node: Catalog | string, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value as Catalog | string, prefix ? `${prefix}.${key}` : key),
  )
}

describe.each(Object.entries(NEVER))('the %s server catalogue', (locale, rules) => {
  it.each(rules)('recognises $old, the word it keeps out', (rule) => {
    expect(rule.pattern.test(rule.old)).toBe(true)
  })

  it.each(rules)('never uses the word in $old', (rule) => {
    const said = leaves(catalogs[locale as Locale]).filter(([, text]) => rule.pattern.test(text))
    expect(said).toEqual([])
  })
})

describe.each(Object.entries(POOL_WORD))('the pool push in %s', (locale, word) => {
  it('names the pool by its new name', () => {
    const titles = leaves(catalogs[locale as Locale]).filter(([path]) =>
      path.startsWith('push.wallet.poolTitle.'),
    )
    expect(titles.length).toBeGreaterThan(0)
    for (const [, title] of titles) expect(title).toMatch(word)
  })
})

/**
 * The case the token noun takes after an Arabic number. A missing category
 * falls back to `other`, so an entry written with only `one` and `other` sent
 * "5 رمزاً" where Arabic says "5 رموز" — the nightly pool push among them.
 * 2 takes the dual رمزان / رمزين, 3–10 the plural رموز and 11–99 the
 * accusative رمزًا.
 *
 * A plural counts tokens when a placeholder stands right before the noun, or
 * when the plural رموز stands on its own. Lines that name tokens without a
 * number ("ستحصلان كلاكما على رموز") are plain strings, not plurals, and have
 * no case to get wrong.
 */
const COUNTS_TOKENS = /\{\w+\}\s*رم(?:ز|وز)|رموز(?![\p{L}\p{M}])/u
const CASE = {
  two: /رمز(?:ان|ين)(?![\p{L}\p{M}])/u,
  few: /رموز(?![\p{L}\p{M}])/u,
  many: /رمز(?:ًا|اً)(?![\p{L}\p{M}])/u,
}
const CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])

function plurals(node: Catalog, prefix = ''): [string, Record<string, string>][] {
  return Object.entries(node).flatMap(([key, value]): [string, Record<string, string>][] => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') return []
    if (Object.keys(value).every((category) => CATEGORIES.has(category)))
      return [[path, value as Record<string, string>]]
    return plurals(value as Catalog, path)
  })
}

describe('Arabic token counts in the server catalogue', () => {
  const counted = plurals(catalogs.ar).filter(([, forms]) =>
    Object.values(forms).some((form) => COUNTS_TOKENS.test(form)),
  )

  it('finds the entries it checks, and refuses the shape it was written for', () => {
    expect(counted.map(([path]) => path)).toContain('push.wallet.poolTitle')
    expect(CASE.few.test('منحك توزيع الأمس {count} رمزاً')).toBe(false)
  })

  it('puts the noun in the case each number takes', () => {
    const wrong = counted.flatMap(([path, forms]) =>
      Object.entries(CASE)
        .filter(([category, pattern]) => !pattern.test(forms[category] ?? ''))
        .map(([category]) => `${path}.${category}: ${forms[category] ?? '(missing)'}`),
    )
    expect(wrong).toEqual([])
  })
})
