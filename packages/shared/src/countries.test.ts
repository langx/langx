import { describe, expect, it } from 'vitest'
import { countryFlag, getCountry, isCountryCode, searchCountries } from './countries'

const codes = (term: string) => searchCountries(term).map((c) => c.code)

describe('searchCountries', () => {
  /**
   * The reason the folding exists. Most of v1's users are in the country ICU
   * spells "Türkiye"; without it the most likely search on the filter screen
   * returns Turkmenistan and the Turks & Caicos Islands, and nothing else.
   */
  it('finds Türkiye by typing "tur"', () => {
    expect(codes('tur')).toContain('TR')
  })

  it('finds it by the name people still type', () => {
    expect(codes('Turkey')[0]).toBe('TR')
  })

  it('folds diacritics in both directions', () => {
    expect(codes('aland')).toContain('AX')
    expect(codes('Åland')).toContain('AX')
  })

  it('takes a code directly, in either case', () => {
    expect(codes('TR')[0]).toBe('TR')
    expect(codes('gb')[0]).toBe('GB')
  })

  it('ranks a prefix above a substring', () => {
    const results = codes('ind')
    expect(results.indexOf('IN')).toBeLessThan(results.indexOf('ID'))
  })

  it('returns nothing for an empty term, so the caller chooses the empty state', () => {
    expect(searchCountries('')).toEqual([])
    expect(searchCountries('   ')).toEqual([])
  })

  it('returns nothing for a term that matches no country', () => {
    expect(searchCountries('qqqq')).toEqual([])
  })
})

describe('country codes', () => {
  /**
   * ICU hands out `ZZ` as "Unknown Region" and it once made it into the
   * generated table, where it would have validated as a real country.
   */
  it('rejects ICU placeholder and aggregate regions', () => {
    for (const code of ['ZZ', 'EU', 'UN', 'XA']) {
      expect(isCountryCode(code)).toBe(false)
    }
  })

  it('rejects deprecated codes that were replaced', () => {
    // RH (Southern Rhodesia) canonicalises to ZW.
    expect(isCountryCode('RH')).toBe(false)
    expect(isCountryCode('ZW')).toBe(true)
  })

  it('is case-insensitive, because profiles were written both ways', () => {
    expect(getCountry('tr')?.code).toBe('TR')
    expect(getCountry('TR')?.code).toBe('TR')
  })

  it('builds a flag from the regional-indicator block', () => {
    expect(countryFlag('TR')).toBe('🇹🇷')
    expect(countryFlag('gb')).toBe('🇬🇧')
    expect(countryFlag('ZZ')).toBe('')
  })
})
