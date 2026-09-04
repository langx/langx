import { SUPPORTED_LOCALES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { matchSettings, SETTINGS_SECTIONS, settingsSection } from './settingsRegistry'

/**
 * The registry is what the landing page, every category page and the search
 * draw from, so a key that does not resolve here is a dotted path on three
 * screens at once. The notification items are built with an `as MessageKey`
 * cast, which is what makes this worth running in every locale.
 */
describe('SETTINGS_SECTIONS', () => {
  it('resolves every title and body in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslate(locale)
      for (const section of SETTINGS_SECTIONS) {
        expect(t(section.titleKey), `${locale} ${section.id}`).not.toContain('.')
        expect(t(section.bodyKey), `${locale} ${section.id}`).not.toMatch(/^settings\./)
        for (const item of section.items) {
          expect(t(item.titleKey), `${locale} ${item.id}`).not.toMatch(/^[a-z]+\.[a-zA-Z.]+$/)
          if (item.bodyKey) {
            expect(t(item.bodyKey), `${locale} ${item.id}`).not.toMatch(/^[a-z]+\.[a-zA-Z.]+$/)
          }
        }
      }
    }
  })

  it('gives every item a unique id, prefixed with its section', () => {
    const ids = SETTINGS_SECTIONS.flatMap((s) => s.items.map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const section of SETTINGS_SECTIONS) {
      for (const item of section.items) expect(item.id.startsWith(`${section.id}.`)).toBe(true)
    }
  })

  it('routes each section to its own page', () => {
    for (const section of SETTINGS_SECTIONS) {
      expect(section.route).toBe(`/(app)/settings/${section.id}`)
      expect(settingsSection(section.id)).toBe(section)
    }
  })
})

describe('matchSettings', () => {
  const t = createTranslate('en')

  it('finds a row by its title', () => {
    const hits = matchSettings(SETTINGS_SECTIONS, 'incognito', t)
    expect(hits.map((h) => h.item.id)).toEqual(['privacy.incognito'])
    expect(hits[0]?.section.id).toBe('privacy')
  })

  it('finds a row by its body', () => {
    const hits = matchSettings(SETTINGS_SECTIONS, 'green dot', t)
    expect(hits.map((h) => h.item.id)).toContain('privacy.hideOnline')
  })

  it('is case- and accent-insensitive', () => {
    expect(matchSettings(SETTINGS_SECTIONS, 'INCOGNITO', t)).toHaveLength(1)
    const tr = createTranslate('tr')
    // "gizli" is in the Turkish incognito copy; typed without its dotless i.
    expect(matchSettings(SETTINGS_SECTIONS, 'gizli', tr).length).toBeGreaterThan(0)
  })

  it('answers nothing under two characters', () => {
    expect(matchSettings(SETTINGS_SECTIONS, 'i', t)).toEqual([])
    expect(matchSettings(SETTINGS_SECTIONS, ' ', t)).toEqual([])
  })

  it('finds the same row through another language', () => {
    const ar = createTranslate('ar')
    expect(matchSettings(SETTINGS_SECTIONS, ar('settings.incognito'), ar)[0]?.item.id).toBe(
      'privacy.incognito',
    )
  })
})
