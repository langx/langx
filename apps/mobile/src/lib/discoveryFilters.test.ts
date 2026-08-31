import { describe, expect, it } from 'vitest'
import {
  activeCount,
  hasProFilters,
  parseFilters,
  toParams,
  toQuery,
  withoutProFilters,
  type DiscoveryFilters,
} from './discoveryFilters'

/**
 * `withoutProFilters` is what a free account actually sees. It used to have no
 * test at all, and it is the one function here that fails *quietly*: dropping a
 * filter it should have kept just shows a wider list, which looks like the
 * filter matched nothing.
 */
describe('withoutProFilters', () => {
  const everything: DiscoveryFilters = {
    targetLanguage: 'en',
    minLevel: 'beginner',
    maxLevel: 'fluent',
    ageMin: 25,
    ageMax: 40,
    country: 'US',
    gender: 'female',
    onlyMyGender: true,
    city: 'Istanbul',
  }

  it('keeps every free filter', () => {
    expect(withoutProFilters(everything)).toEqual({
      targetLanguage: 'en',
      minLevel: 'beginner',
      maxLevel: 'fluent',
      ageMin: 25,
      ageMax: 40,
      country: 'US',
      onlyMyGender: true,
    })
  })

  it('drops exactly the paid ones', () => {
    const free = withoutProFilters(everything)
    expect(free.gender).toBeUndefined()
    expect(free.city).toBeUndefined()
  })

  /**
   * The regression this function is shaped to cause. It is an allow-list, so a
   * filter that moves from paid to free is dropped until someone adds it here
   * — and dropping it just shows a wider list, which looks like the filter
   * matched everybody rather than like a bug.
   */
  it('keeps only-my-gender, which is free now', () => {
    expect(withoutProFilters({ onlyMyGender: true }).onlyMyGender).toBe(true)
  })

  /** 18 is the slider floor, and `ageMin: 18` must survive a falsiness check. */
  it('keeps an age bound that is falsy-looking but real', () => {
    expect(withoutProFilters({ ageMin: 18 }).ageMin).toBe(18)
  })
})

describe('hasProFilters', () => {
  it('is false for a set that is entirely free', () => {
    expect(hasProFilters({ targetLanguage: 'en', minLevel: 'beginner', ageMin: 30 })).toBe(false)
  })

  it('is true for each paid filter on its own', () => {
    expect(hasProFilters({ gender: 'female' })).toBe(true)
    expect(hasProFilters({ city: 'Istanbul' })).toBe(true)
  })

  it('is false for only-my-gender, which no longer costs anything', () => {
    expect(hasProFilters({ onlyMyGender: true })).toBe(false)
  })
})

describe('the URL round trip', () => {
  it('survives every filter', () => {
    const filters: DiscoveryFilters = {
      targetLanguage: 'en',
      minLevel: 'beginner',
      maxLevel: 'fluent',
      ageMin: 25,
      ageMax: 40,
      country: 'US',
      gender: 'female',
      city: 'İstanbul',
    }
    expect(parseFilters(toParams(filters))).toEqual(filters)
  })

  it('reads a city out of a pasted URL, trimmed', () => {
    expect(parseFilters({ city: '  Istanbul ' }).city).toBe('Istanbul')
    expect(parseFilters({ city: '   ' }).city).toBeUndefined()
  })

  /** `'1'` is the URL's spelling of a boolean; `'true'` is the API's. */
  it('sends booleans the way the API coerces them', () => {
    const query = toQuery({ onlyMyGender: true, city: 'Istanbul' })
    expect(query).toMatchObject({ onlyMyGender: 'true', city: 'Istanbul' })
  })
})

describe('activeCount', () => {
  it('counts a band or a range once, however many bounds express it', () => {
    expect(activeCount({ minLevel: 'beginner', maxLevel: 'fluent' })).toBe(1)
    expect(activeCount({ ageMin: 25, ageMax: 40 })).toBe(1)
    expect(activeCount({ gender: 'female', onlyMyGender: true })).toBe(1)
  })

  it('counts city as its own filter', () => {
    expect(activeCount({ city: 'Istanbul' })).toBe(1)
    expect(activeCount({ city: 'Istanbul', country: 'US' })).toBe(2)
  })

  it('is zero for no filters', () => {
    expect(activeCount({})).toBe(0)
  })
})
