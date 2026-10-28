import type { Catalog, Locale } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'

/**
 * What the token and the daily pool are called, on every line of the app —
 * not only on the token page, which `lib/tokenPage.test.ts` holds to the
 * messaging brief.
 *
 * - es "bote", pt-BR "bolo" and fr "cagnotte" are what a lottery's prize pot
 *   is called. The pool is "fondo", "fundo" and "pot commun", and the wallet
 *   and the notifications have to say so as much as the token page does.
 * - Arabic calls the token رمز / رموز, as token.langx.io does. The loanword
 *   توكن had spread through Echo, chat, invites and the hourly gift.
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

/** The pool's own name on its screen, in the three languages that changed it. */
const POOL_WORD: Partial<Record<Locale, RegExp>> = {
  es: /^Fondo /,
  'pt-BR': /^Fundo /,
  fr: /^Pot commun /,
}

function leaves(node: Catalog | string, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value as Catalog | string, prefix ? `${prefix}.${key}` : key),
  )
}

describe.each(Object.entries(NEVER))('the %s catalogue', (locale, rules) => {
  it.each(rules)('recognises $old, the word it keeps out', (rule) => {
    expect(rule.pattern.test(rule.old)).toBe(true)
  })

  it.each(rules)('never uses the word in $old', (rule) => {
    const said = leaves(catalogs[locale as Locale]).filter(([, text]) => rule.pattern.test(text))
    expect(said).toEqual([])
  })
})

describe.each(Object.entries(POOL_WORD))('the pool in %s', (locale, word) => {
  it('is called by its new name on the pool screen', () => {
    const tokens = catalogs[locale as Locale].tokens as Catalog
    expect(tokens.poolTitle).toMatch(word)
  })
})

/**
 * The case the token noun takes after an Arabic number. A missing category
 * falls back to `other`, the singular رمز, which is right only for 0 and 100+:
 * 2 takes the dual رمزان / رمزين, 3–10 the plural رموز and 11–99 the accusative
 * رمزًا. When توكن became رمز, six `two` forms kept the singular after the
 * number ("+2 رمز"), on the hourly gift's reveal among them.
 *
 * An entry counts tokens when a placeholder stands right before the noun, or
 * when the plural رموز stands on its own. "تمنح رموزًا" (pays tokens) counts
 * sessions or people, not tokens, and is left alone, as is "رموز QR" (QR
 * codes) in a sentence that counts days. The server's catalogue has the same
 * check in apps/api/src/i18n/tokenWords.test.ts.
 */
const COUNTS_TOKENS = /\{\w+\}\s*رم(?:ز|وز)|رموز(?![\p{L}\p{M}])(?!\s*QR)/u
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

describe('Arabic token counts', () => {
  const counted = plurals(catalogs.ar).filter(([, forms]) =>
    Object.values(forms).some((form) => COUNTS_TOKENS.test(form)),
  )

  it('finds the entries it checks, and refuses the shape it was written for', () => {
    expect(counted.map(([path]) => path)).toContain('gift.tokensUnit')
    expect(counted.length).toBeGreaterThan(20)
    expect(CASE.two.test('+{count} رمز')).toBe(false)
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
