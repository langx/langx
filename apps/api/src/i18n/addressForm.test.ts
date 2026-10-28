import type { Catalog, Locale } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'

/**
 * What the server sends — pushes and emails — addresses the reader the way the
 * app does: French « tu ». The app's catalogue has said « tu » throughout for a
 * while; the server's said « vous » on most lines and « tu » on the newer ones
 * (the report rewards, suspensions, gifts), so one person was spoken to both
 * ways, and a push could say « vous » about a chat that says « tu ».
 *
 * The plural is still right where the sentence means two people: the reader
 * and someone they invited ("you both earn tokens"). Those lines say so in
 * words, and only they may use it.
 *
 * A pronoun is not the only sign. An imperative carries none — « Touchez »,
 * « Ouvrez » — so the plural imperative is looked for too, where an imperative
 * stands: at the start of a sentence or clause. A word with the same ending
 * after a preposition (« chez ») does not match.
 *
 * The app's catalogue has the same check in apps/mobile/src/i18n/addressForm.test.ts.
 */
const FORMAL: Partial<
  Record<
    Locale,
    { pattern: RegExp; imperative: RegExp; plural: RegExp; old: string[]; informal: string[] }
  >
> = {
  fr: {
    // Not the "vous" of "rendez-vous", the word for a meeting — but the one of
    // "Connectez-vous", which the hyphen would otherwise hide.
    pattern:
      /(?<![\p{L}-])(?:vous|votre|vos|vôtres?)(?!\p{L})|(?<!\p{L})(?!rendez)\p{L}+ez-vous(?!\p{L})/iu,
    imperative: /(?:^|[.,!?…:;—«(]\s*)(?!(?:chez|assez|nez)(?!\p{L}))\p{L}+ez(?![\p{L}-])/iu,
    plural: /tous les deux|vous deux|l’un|vous vous/iu,
    old: [
      'Touchez pour voir qui.',
      'Connectez-vous à LangX',
      'Le mois en chiffres, le vôtre et celui de tous',
    ],
    informal: ['Touche pour voir qui.', 'Connecte-toi à LangX', 'Rendez-vous demain'],
  },
}

/**
 * Lines another change is rewording in every locale, which keep « vous » until
 * it lands: the sign-in link's lifetime moves into config, and the feed digest
 * counts its replies. That change owns them. Each is checked to still need its
 * place here, so the list empties itself once they speak like the rest.
 */
const WAITING: Partial<Record<Locale, string[]>> = {
  fr: [
    'email.magicLinkBody',
    'email.magicLinkText',
    'email.existingLinkBody',
    'email.existingLinkText',
    'email.feedDigestSubject',
    'email.feedDigestBody',
  ],
}

function leaves(node: Catalog | string, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value as Catalog | string, prefix ? `${prefix}.${key}` : key),
  )
}

/** A plural's forms are leaves under its key: `email.feedDigestBody.one`. */
const under = (key: string) => (path: string) => path === key || path.startsWith(`${key}.`)

describe.each(Object.entries(FORMAL))('the %s server catalogue', (locale, rule) => {
  const formal = (text: string) => rule.pattern.test(text) || rule.imperative.test(text)
  const waiting = WAITING[locale as Locale] ?? []
  const all = leaves(catalogs[locale as Locale])

  it('recognises the formal address', () => {
    expect(rule.old.filter((text) => !formal(text))).toEqual([])
    expect(rule.informal.filter(formal)).toEqual([])
  })

  it('addresses one reader informally', () => {
    const found = all
      .filter(([path]) => !waiting.some((key) => under(key)(path)))
      .filter(([, text]) => formal(text) && !rule.plural.test(text))
      .map(([path, text]) => `${path}: ${text}`)
    expect(found).toEqual([])
  })

  it.each(waiting)('%s still waits for its own change', (key) => {
    expect(all.some(([path, text]) => under(key)(path) && formal(text))).toBe(true)
  })
})
