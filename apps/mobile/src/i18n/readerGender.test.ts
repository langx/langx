import type { Catalog } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'

/**
 * French marks gender on a past participle or an adjective that agrees with
 * the person it describes: « connecté » / « connectée », « le premier » /
 * « la première », « {name} t’a invité » / « invitée ». The app does not know
 * the reader's gender, so a line about the reader is phrased so that nothing
 * agrees with them — an infinitive, a noun (« la première personne »), a verb
 * with « on » (« on te met en relation »), or a word that is the same either
 * way. Every one of these shapes was in the catalogue, in the masculine.
 *
 * Only the shapes that slipped in are looked for; this is a net for the known
 * traps, not a grammar. Lines about the partner, or about both people, are
 * not the reader's and are left alone. The server's catalogue has the same
 * check in apps/api/src/i18n/readerGender.test.ts.
 */
const GENDERED: { pattern: RegExp; old: string }[] = [
  {
    // « tu es connecté », « tu seras mis en relation », « tu ne seras pas débité »
    pattern:
      /(?<!\p{L})tu (?:ne |n’)?(?:es|étais|seras|serais|as été|avais été)(?: (?:pas|déjà|plus|toujours))? (?:\p{L}+(?:é|ée|eux|euse)|mise?|prête?|seule?|sûre?|fière?|humaine?|inscrite?|perdue?|contente?|certaine?|active?|nouveau|nouvelle|l’une?)(?!\p{L})/iu,
    old: 'Voir où tu es connecté.',
  },
  // « tu t’es abonné »: a reflexive past agrees with « te ».
  { pattern: /(?<!\p{L})t’es(?!\p{L})/iu, old: 'la boutique où tu t’es abonné' },
  {
    // « {name} t’a invité », « Qui t’a vu »: the participle agrees with the
    // « te » before it. « t’a écrit », « t’a versé » do not: there « te » is
    // who it went to, not who was invited.
    pattern:
      /(?<!\p{L})t’(?:a|ont|avait|avaient|ait|aura) (?:invité|vu|suivi|appelé|aidé|bloqué|ajouté|choisi|accepté|signalé|mentionné|contacté|remercié|attendu|trouvé|reconnu|consulté)e?(?!\p{L})/iu,
    old: '{name} t’a invité.',
  },
  {
    pattern:
      /(?<!\p{L})sois (?:le|un|seul|prêt|patient|sûr|certain|fier)(?!\p{L})|(?<!\p{L})toi seul(?!\p{L})|(?<!\p{L})être mis en relation/iu,
    old: 'Sois le premier à réagir.',
  },
  // « Bloqué sur une phrase ? »: an adjective standing for « tu es ».
  {
    pattern: /(?:^|[.!?…]\s+)(?:Bloqué|Coincé|Perdu|Pas sûr)(?!\p{L})(?! *$)/u,
    old: 'Perdu dans un message ?',
  },
]

function leaves(node: Catalog | string, prefix = ''): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]]
  return Object.entries(node).flatMap(([key, value]) =>
    leaves(value as Catalog | string, prefix ? `${prefix}.${key}` : key),
  )
}

describe('the French catalogue', () => {
  const all = leaves(catalogs.fr)
  const gendered = (text: string) => GENDERED.some((rule) => rule.pattern.test(text))

  it.each(GENDERED)('recognises $old', (rule) => {
    expect(rule.pattern.test(rule.old)).toBe(true)
  })

  it('leaves alone what does not describe the reader', () => {
    const fine = [
      'Ton profil ne peut pas être mis en avant.',
      'Le pot commun d’hier t’a versé 3 jetons',
      'Tu es plutôt du matin ou du soir ?',
      'Tu es Pro',
      'Sois la première personne à réagir.',
      // A sticker's name, not a sentence about the reader.
      'Perdu',
    ]
    expect(fine.filter(gendered)).toEqual([])
  })

  it('assumes no gender for the reader', () => {
    const found = all.filter(([, text]) => gendered(text)).map(([path, text]) => `${path}: ${text}`)
    expect(found).toEqual([])
  })
})
