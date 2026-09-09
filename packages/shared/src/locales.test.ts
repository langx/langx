import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  matchLocale,
  LOCALE_NAMES,
  SUPPORTED_LOCALES,
  isRtlLocale,
  resolveLocale,
} from './locales'

describe('resolveLocale', () => {
  it('matches an exact tag', () => {
    expect(resolveLocale(['tr'])).toBe('tr')
    expect(resolveLocale(['pt-BR'])).toBe('pt-BR')
  })

  it('ignores case, because platforms disagree on it', () => {
    expect(resolveLocale(['PT-br'])).toBe('pt-BR')
    expect(resolveLocale(['TR'])).toBe('tr')
  })

  it('falls back to the base language of a regional tag', () => {
    expect(resolveLocale(['en-GB'])).toBe('en')
    expect(resolveLocale(['de-AT'])).toBe('de')
    expect(resolveLocale(['es-419'])).toBe('es')
  })

  it('sends a regional variant to the one we ship', () => {
    expect(resolveLocale(['pt-PT'])).toBe('pt-BR')
  })

  it('prefers an earlier candidate over a later one', () => {
    // The whole point of the ordering: a Portuguese device that also lists
    // English wants Portuguese, even though the English match is exact.
    expect(resolveLocale(['pt-PT', 'en-US'])).toBe('pt-BR')
  })

  it('moves on when a candidate matches nothing', () => {
    expect(resolveLocale(['ja-JP', 'fr-CA'])).toBe('fr')
  })

  it('skips empty entries rather than defaulting on them', () => {
    // One bad entry from a platform API must not cost the good entry behind it.
    expect(resolveLocale([null, undefined, '', '  ', 'ru-RU'])).toBe('ru')
  })

  it('defaults to English when nothing matches', () => {
    expect(resolveLocale(['ja', 'ko'])).toBe(DEFAULT_LOCALE)
    expect(resolveLocale([])).toBe(DEFAULT_LOCALE)
  })
})

/**
 * The distinction mail needs: an English speaker has been answered, a speaker
 * of a language we ship no catalogue for has not, and both come back as `en`
 * from `resolveLocale`.
 */
describe('matchLocale', () => {
  it('tells a real English match from no match at all', () => {
    expect(matchLocale(['en-GB'])).toBe('en')
    expect(matchLocale(['ja', 'ko'])).toBeNull()
    expect(matchLocale([])).toBeNull()
  })

  it('searches exactly as resolveLocale does', () => {
    expect(matchLocale(['pt-PT', 'en-US'])).toBe('pt-BR')
    expect(matchLocale([null, undefined, '', 'ru-RU'])).toBe('ru')
  })
})

describe('locale metadata', () => {
  it('names every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_NAMES[locale]).toBeTruthy()
    }
  })

  it('marks Arabic, and only Arabic, as right to left', () => {
    expect(isRtlLocale('ar')).toBe(true)
    expect(SUPPORTED_LOCALES.filter(isRtlLocale)).toEqual(['ar'])
  })
})
