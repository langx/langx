import { BADGES, V3_BADGE_KINDS, type Locale } from '@langx/shared'
import { describe, expect, it } from 'vitest'
// The app's catalogues, read straight from the workspace: the server's badge
// names are a copy of them, and nothing else would notice the two drifting.
import { ar as appAr } from '../../../mobile/src/i18n/messages/ar'
import { de as appDe } from '../../../mobile/src/i18n/messages/de'
import { en as appEn } from '../../../mobile/src/i18n/messages/en'
import { es as appEs } from '../../../mobile/src/i18n/messages/es'
import { fr as appFr } from '../../../mobile/src/i18n/messages/fr'
import { ptBR as appPtBR } from '../../../mobile/src/i18n/messages/pt-BR'
import { ru as appRu } from '../../../mobile/src/i18n/messages/ru'
import { tr as appTr } from '../../../mobile/src/i18n/messages/tr'
import { badgeName } from './badgeName'
import { catalogs } from './catalogs'

const APP = {
  en: appEn,
  tr: appTr,
  es: appEs,
  ru: appRu,
  ar: appAr,
  fr: appFr,
  de: appDe,
  'pt-BR': appPtBR,
} as const

type AppBadgeWords = {
  badges: Record<string, unknown>
  badgesV3: { unit: Record<string, unknown>; name: Record<string, string> }
}

describe('the server’s badge names', () => {
  for (const [locale, app] of Object.entries(APP) as [Locale, AppBadgeWords][]) {
    it(`say what the app's shelf says, in ${locale}`, () => {
      const server = (catalogs[locale] as { badgeNames: Record<string, unknown> }).badgeNames
      const { badges, badgesV3 } = app

      expect(server.firstCorrection).toEqual(badges.firstCorrection)
      expect(server.streakDays).toEqual(badges.streakDays)
      expect(server.corrections).toEqual(badges.corrections)
      expect(server.messagesSent).toEqual(badges.messagesSent)
      expect(server.tokensEarned).toEqual(badges.tokensEarned)
      expect(server.memberDays).toEqual(badges.memberDays)
      expect(server.earlyAdopter).toEqual(badges.earlyAdopter)
      for (const kind of V3_BADGE_KINDS) expect(server[kind]).toEqual(badgesV3.unit[kind])

      const v3Names = Object.fromEntries(
        Object.entries(badgesV3.name).filter(([id]) =>
          (V3_BADGE_KINDS as readonly string[]).includes(id.split('_')[0] as string),
        ),
      )
      expect(server.v3).toEqual(v3Names)
    })
  }

  it('names a v3 badge the way the v3 shelf does', () => {
    expect(badgeName('en', { kind: 'guide', threshold: 50 })).toBe('Weaver')
    expect(badgeName('tr', { kind: 'guide', threshold: 50 })).toBe('Dokumacı')
  })

  it('falls back to the unit for a v3 threshold with no name', () => {
    expect(badgeName('en', { kind: 'guide', threshold: 7 })).toBe('7 people')
  })

  it('has a name for every badge in the catalogue', () => {
    for (const badge of BADGES) {
      for (const locale of Object.keys(APP) as Locale[]) {
        expect(badgeName(locale, badge)).not.toMatch(/^badgeNames\./)
      }
    }
  })
})
