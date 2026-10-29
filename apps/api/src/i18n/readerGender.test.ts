import type { Catalog } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'

/**
 * French marks gender on a past participle or an adjective that agrees with
 * the person it describes. The server does not know the reader's gender any
 * more than the app does, so a push or an email about the reader is phrased
 * so that nothing agrees with them. Turning « vous » into « tu » brought out
 * three that « vous » had hidden — « Voir qui vous a consulté », « Vous avez
 * été silencieux », « la boutique où vous vous êtes abonné » — since a plural
 * « vous » reads as polite, but « tu » is one person with one gender.
 *
 * The same shapes as the app's check in apps/mobile/src/i18n/readerGender.test.ts:
 * a net for the known traps, not a grammar.
 */
const GENDERED: { pattern: RegExp; old: string }[] = [
  {
    // « tu es connecté », « tu as été silencieux », « tu ne seras pas débité »
    pattern:
      /(?<!\p{L})tu (?:ne |n’)?(?:es|étais|seras|serais|as été|avais été)(?: (?:pas|déjà|plus|toujours))? (?:\p{L}+(?:é|ée|eux|euse)|mise?|prête?|seule?|sûre?|fière?|humaine?|inscrite?|perdue?|contente?|certaine?|active?|nouveau|nouvelle|l’une?)(?!\p{L})/iu,
    old: 'Tu as été silencieux ce mois-ci',
  },
  // « tu t’es abonné »: a reflexive past agrees with « te ».
  { pattern: /(?<!\p{L})t’es(?!\p{L})/iu, old: 'la boutique où tu t’es abonné' },
  {
    // « Voir qui t’a consulté »: the participle agrees with the « te » before
    // it. « t’a écrit », « t’a versé » do not: there « te » is who it went to.
    pattern:
      /(?<!\p{L})t’(?:a|ont|avait|avaient|ait|aura) (?:invité|vu|suivi|appelé|aidé|bloqué|ajouté|choisi|accepté|signalé|mentionné|contacté|remercié|attendu|trouvé|reconnu|consulté)e?(?!\p{L})/iu,
    old: 'Voir qui t’a consulté',
  },
  {
    pattern:
      /(?<!\p{L})sois (?:le|un|seul|prêt|patient|sûr|certain|fier)(?!\p{L})|(?<!\p{L})toi seul(?!\p{L})|(?<!\p{L})être mis en relation/iu,
    old: 'Sois le premier à répondre.',
  },
  {
    pattern: /(?:^|[.!?…]\s+)(?:Bloqué|Coincé|Perdu|Pas sûr)(?!\p{L})(?! *$)/u,
    old: 'Bloqué sur une phrase ?',
  },
]

function leaves(node: Catalog | string, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value as Catalog | string, prefix ? `${prefix}.${key}` : key),
  )
}

describe('the French server catalogue', () => {
  const gendered = (text: string) => GENDERED.some((rule) => rule.pattern.test(text))

  it.each(GENDERED)('recognises $old', (rule) => {
    expect(rule.pattern.test(rule.old)).toBe(true)
  })

  it('leaves alone what does not describe the reader', () => {
    const fine = [
      'Le pot commun d’hier t’a versé 3 jetons',
      '{names} t’a écrit pendant ton absence.',
      'Ton cadeau horaire est prêt',
      'Les personnes ci-dessous ne sont pas restées silencieuses',
    ]
    expect(fine.filter(gendered)).toEqual([])
  })

  it('assumes no gender for the reader', () => {
    const found = leaves(catalogs.fr)
      .filter(([, text]) => gendered(text))
      .map(([path, text]) => `${path}: ${text}`)
    expect(found).toEqual([])
  })
})
