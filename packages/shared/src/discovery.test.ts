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
  it('is naming a gender and naming a city, and nothing else', () => {
    expect([...DISCOVERY_PRO_FILTER_KEYS].sort()).toEqual(['cityId', 'gender'])
  })

  /**
   * The line the list is drawn on: a paid filter names somebody else's
   * attribute, a free one names only your own. `onlyMyGender` takes no value
   * and is resolved from the caller's own profile, so there is no third party
   * in it — and it is the one filter that can only ever make an already-small
   * pool smaller, which is not a thing to sell to somebody being shown too few
   * people already.
   */
  it('leaves only-my-gender free, unlike naming a gender', () => {
    expect(DISCOVERY_PRO_FILTER_KEYS as readonly string[]).not.toContain('onlyMyGender')
    expect(DISCOVERY_PRO_FILTER_KEYS as readonly string[]).toContain('gender')
  })

  it('leaves fit filters free — level, age and country are how a match is found', () => {
    for (const key of ['minLevel', 'maxLevel', 'ageMin', 'ageMax', 'country', 'targetLanguage']) {
      expect(DISCOVERY_PRO_FILTER_KEYS as readonly string[], key).not.toContain(key)
    }
  })

  it('accepts a city id and trims it', () => {
    const parsed = discoveryQuerySchema.parse({ cityId: '  geonames:745044  ' })
    expect(parsed.cityId).toBe('geonames:745044')
  })

  it('refuses an empty city id rather than matching everyone with no city', () => {
    expect(discoveryQuerySchema.safeParse({ cityId: '   ' }).success).toBe(false)
  })
})
