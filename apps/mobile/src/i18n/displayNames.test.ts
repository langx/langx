import { COUNTRY_CODES, LANGUAGE_CODES } from '@langx/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DISPLAY_NAMES } from './displayNameData'
import { displayNamesFor } from './displayNames'

// The provider pulls in react-native, which vitest cannot load; the hook is
// not under test here, only the lookup it memoises.
vi.mock('./I18nProvider', () => ({ useLocale: () => ({ locale: 'en' }) }))

describe('displayNamesFor', () => {
  // What Hermes looks like: no `Intl.DisplayNames`. Before the table, this is
  // the state in which every phone showed English names.
  const original = Object.getOwnPropertyDescriptor(Intl, 'DisplayNames')!
  afterEach(() => {
    Object.defineProperty(Intl, 'DisplayNames', original)
  })

  it('names languages and countries in the reader’s language without Intl.DisplayNames', () => {
    Reflect.deleteProperty(Intl, 'DisplayNames')
    expect(Intl.DisplayNames).toBeUndefined()

    expect(displayNamesFor('tr').language('de')).toBe('Almanca')
    expect(displayNamesFor('ru').language('en')).toBe('английский')
    expect(displayNamesFor('ar').country('EG')).toBe('مصر')
    expect(displayNamesFor('de').country('JP')).toBe('Japan')
    expect(displayNamesFor('es').language('ja')).toBe('japonés')
  })

  it('keeps the English names from @langx/shared for English', () => {
    expect(displayNamesFor('en').language('de')).toBe('German')
    expect(displayNamesFor('en').country('DE')).toBe('Germany')
  })

  it('accepts a lowercase country code', () => {
    expect(displayNamesFor('fr').country('de')).toBe('Allemagne')
  })

  it('falls back to the English name, then the code, for what the table lacks', () => {
    // Afrikaans is Afrikaans in German too, so the table leaves it out.
    expect(displayNamesFor('de').language('af')).toBe('Afrikaans')
    expect(displayNamesFor('tr').language('zz')).toBe('zz')
  })

  it('carries no code the app no longer knows', () => {
    // A code dropped from languages.ts or countries.ts should leave the table
    // too; a stale entry here means `gen:names` was not rerun.
    const languages = new Set<string>(LANGUAGE_CODES)
    const countries = new Set<string>(COUNTRY_CODES)
    for (const table of Object.values(DISPLAY_NAMES)) {
      for (const code of Object.keys(table.languages)) expect(languages).toContain(code)
      for (const code of Object.keys(table.countries)) expect(countries).toContain(code)
    }
  })
})
