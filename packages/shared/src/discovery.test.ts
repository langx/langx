import { describe, expect, it } from 'vitest'
import { DISCOVERY_PRO_FILTER_KEYS, discoveryQuerySchema } from './discovery'

describe('discoveryQuerySchema', () => {
  it('defaults sort to recommended and limit to 20 when omitted', () => {
    const result = discoveryQuerySchema.parse({})
    expect(result).toMatchObject({ sort: 'recommended', limit: 20 })
  })

  it('coerces querystring limit/ageMin/ageMax into numbers', () => {
    const result = discoveryQuerySchema.parse({ limit: '5', ageMin: '20', ageMax: '30' })
    expect(result).toMatchObject({ limit: 5, ageMin: 20, ageMax: 30 })
  })

  it('rejects a limit above the page-size cap', () => {
    expect(discoveryQuerySchema.safeParse({ limit: '999' }).success).toBe(false)
  })

  it('rejects ageMin greater than ageMax', () => {
    const result = discoveryQuerySchema.safeParse({ ageMin: '40', ageMax: '30' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown language code for targetLanguage', () => {
    expect(discoveryQuerySchema.safeParse({ targetLanguage: 'xx' }).success).toBe(false)
  })

  it('rejects an unknown sort value', () => {
    expect(discoveryQuerySchema.safeParse({ sort: 'popular' }).success).toBe(false)
  })
})

describe('DISCOVERY_PRO_FILTER_KEYS', () => {
  /**
   * Asserted by name, because this list *is* the paywall. The server refuses
   * anything on it and the filter screen locks the matching control; a key
   * added or removed by accident either sells something already free or 403s a
   * request from a screen that offered it, and every other test here would
   * still pass.
   */
  it('is the two gender filters and city, and nothing else', () => {
    expect([...DISCOVERY_PRO_FILTER_KEYS].sort()).toEqual(['city', 'gender', 'onlyMyGender'])
  })

  it('leaves fit filters free — level, age and country are how a match is found', () => {
    for (const key of ['minLevel', 'maxLevel', 'ageMin', 'ageMax', 'country', 'targetLanguage']) {
      expect(DISCOVERY_PRO_FILTER_KEYS as readonly string[], key).not.toContain(key)
    }
  })

  it('accepts a city and normalises the whitespace around it', () => {
    const parsed = discoveryQuerySchema.parse({ city: '  İstanbul  ' })
    expect(parsed.city).toBe('İstanbul')
  })

  it('refuses an empty city rather than matching everyone with no city set', () => {
    expect(discoveryQuerySchema.safeParse({ city: '   ' }).success).toBe(false)
  })
})
