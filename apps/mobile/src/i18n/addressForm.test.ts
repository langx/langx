import type { Catalog, Locale } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'
import { NATIVE_KEYS } from './nativeKeys'

/**
 * Russian and French address the reader as «ты» and « tu », as the headers of
 * `messages/ru.ts` and `messages/fr.ts` say: peers teaching each other, not a
 * bank. Strings written later slipped back into «вы» and « vous » — the tour
 * said «вы» and then «Попробуй» — about one line in three in Russian.
 *
 * The plural is still right where the sentence means two people: the reader
 * and a partner ("you both wrote", "you won't see each other"). Those lines
 * say so in words, and only they may use it.
 *
 * The keys in `NATIVE_KEYS` wait for the next native build. The generator
 * copies them into the widget, watch, Wear and notification resources, and
 * those files are part of the runtime fingerprint: changing them in an update
 * would give the update a runtime no installed binary has, and stop every
 * update after it from reaching the 3.1 builds. They keep «вы» / « vous »
 * until a build ships them.
 *
 * A pronoun is not the only sign. An imperative carries none — «Нажмите»,
 * « Appuyez » — so the plural imperative is looked for too, where an
 * imperative stands: at the start of a sentence or clause. A noun with the
 * same ending («на сайте», « chez ») always follows a preposition, never
 * punctuation, so it does not match.
 */
const NATIVE: ReadonlySet<string> = new Set(NATIVE_KEYS)
const FORMAL: Partial<
  Record<
    Locale,
    { pattern: RegExp; imperative: RegExp; plural: RegExp; old: string[]; informal: string[] }
  >
> = {
  ru: {
    pattern: /(?<!\p{L})(?:вы|вас|вам|вами|ваш\p{L}*)(?!\p{L})/iu,
    imperative: /(?:^|[.,!?…:;—«(]\s*)\p{L}+(?:йте|ьте|ите)(?!\p{L})/iu,
    plural:
      /(?<!\p{L})(?:оба|обоих|друг друг\p{L}*|одного из вас|вы вместе|вы лучше узнаете|вы обменяетесь|вы переписывались)(?!\p{L})/iu,
    old: ['Поделитесь моментом из вашего дня', 'Нажмите, чтобы ответить', 'Готово. Откройте чат'],
    informal: ['Нажми, чтобы ответить', 'Ссылка на сайте', 'Серия в зените'],
  },
  fr: {
    // Not the "vous" of "rendez-vous", the word for a meeting.
    pattern: /(?<![\p{L}-])(?:vous|votre|vos)(?!\p{L})/iu,
    imperative: /(?:^|[.,!?…:;—«(]\s*)(?!(?:chez|assez|nez)(?!\p{L}))\p{L}+ez(?![\p{L}-])/iu,
    plural: /tous les deux|vous deux|l’un|vous vous/iu,
    old: [
      'LangX a besoin de votre autorisation',
      'Appuyez pour répondre',
      'C’est prêt : ouvrez le chat',
    ],
    informal: ['Appuie pour répondre', 'Chez toi, il est 9 h', 'Rendez-vous demain'],
  },
}

function leaves(node: Catalog | string, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value as Catalog | string, prefix ? `${prefix}.${key}` : key),
  )
}

describe.each(Object.entries(FORMAL))('the %s catalogue', (locale, rule) => {
  const formal = (text: string) => rule.pattern.test(text) || rule.imperative.test(text)

  it('recognises the formal address', () => {
    expect(rule.old.filter((text) => !formal(text))).toEqual([])
    expect(rule.informal.filter(formal)).toEqual([])
  })

  it('addresses one reader informally', () => {
    const found = leaves(catalogs[locale as Locale])
      .filter(([path, text]) => !NATIVE.has(path) && formal(text) && !rule.plural.test(text))
      .map(([path, text]) => `${path}: ${text}`)
    expect(found).toEqual([])
  })
})
