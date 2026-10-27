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
 *
 * Letter lookarounds rather than `\b`, which treats "ã" as a word boundary.
 */
const NEVER: Partial<Record<Locale, { pattern: RegExp; old: string }>> = {
  es: { pattern: /(?<!\p{L})botes?(?!\p{L})/iu, old: 'El bote de ayer' },
  'pt-BR': { pattern: /(?<!\p{L})bol(?:os?|ão|ões)(?!\p{L})/iu, old: 'O bolo de ontem' },
  fr: { pattern: /cagnotte/iu, old: 'La cagnotte d’hier' },
  ar: { pattern: /توكن/u, old: '+3 توكنات' },
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

describe.each(Object.entries(NEVER))('the %s catalogue', (locale, rule) => {
  it('recognises the word it keeps out', () => {
    expect(rule.pattern.test(rule.old)).toBe(true)
  })

  it('never uses it', () => {
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
