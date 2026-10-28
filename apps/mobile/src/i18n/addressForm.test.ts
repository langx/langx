import type { Catalog, Locale } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'

/**
 * Russian and French address the reader as «ты» and « tu », as the headers of
 * `messages/ru.ts` and `messages/fr.ts` say: peers teaching each other, not a
 * bank. Strings written later slipped back into «вы» and « vous » — the tour
 * said «вы» and then «Попробуй» — about one line in three in Russian.
 *
 * The plural is still right where the sentence means two people: the reader
 * and a partner ("you both wrote", "you won't see each other"). Those lines
 * say so in words, and only they may use it.
 */
const FORMAL: Partial<Record<Locale, { pattern: RegExp; plural: RegExp; old: string }>> = {
  ru: {
    pattern: /(?<!\p{L})(?:вы|вас|вам|вами|ваш\p{L}*)(?!\p{L})/iu,
    plural:
      /(?<!\p{L})(?:оба|обоих|друг друг\p{L}*|одного из вас|вы вместе|вы лучше узнаете|вы обменяетесь|вы переписывались)(?!\p{L})/iu,
    old: 'Поделитесь моментом из вашего дня',
  },
  fr: {
    // Not the "vous" of "rendez-vous", the word for a meeting.
    pattern: /(?<![\p{L}-])(?:vous|votre|vos)(?!\p{L})/iu,
    plural: /tous les deux|vous deux|l’un|vous vous/iu,
    old: 'LangX a besoin de votre autorisation',
  },
}

function leaves(node: Catalog | string, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value as Catalog | string, prefix ? `${prefix}.${key}` : key),
  )
}

describe.each(Object.entries(FORMAL))('the %s catalogue', (locale, rule) => {
  it('recognises the formal address', () => {
    expect(rule.pattern.test(rule.old)).toBe(true)
  })

  it('addresses one reader informally', () => {
    const formal = leaves(catalogs[locale as Locale])
      .filter(([, text]) => rule.pattern.test(text) && !rule.plural.test(text))
      .map(([path, text]) => `${path}: ${text}`)
    expect(formal).toEqual([])
  })
})
