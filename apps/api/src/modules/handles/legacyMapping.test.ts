import { describe, expect, it } from 'vitest'
import { isMatchable, mapLanguages, toBirthYear, toGender } from './legacyMapping'

describe('Faz 11 — v1 → v2 field mapping', () => {
  describe('languages', () => {
    it('splits mother tongues from learning languages and maps the numeric level', () => {
      // The exact shape seen in the live v1 data.
      const result = mapLanguages([
        { code: 'hi', level: -1, motherLanguage: true, name: 'Hindi' },
        { code: 'en', level: 3, motherLanguage: false, name: 'English' },
        { code: 'es', level: 1, motherLanguage: false, name: 'Spanish' },
      ])

      expect(result.nativeLanguages).toEqual([{ code: 'hi' }])
      expect(result.learning).toEqual([
        { code: 'en', level: 'fluent', priority: 1 },
        { code: 'es', level: 'beginner', priority: 2 },
      ])
    })

    it('treats level -1 as native even when motherLanguage is missing', () => {
      const result = mapLanguages([{ code: 'tr', level: -1 }])
      expect(result.nativeLanguages).toEqual([{ code: 'tr' }])
      expect(result.learning).toHaveLength(0)
    })

    it('never lets a language be both native and learning', () => {
      // v2 rejects this outright, so the ETL must not produce it.
      const result = mapLanguages([
        { code: 'de', level: -1, motherLanguage: true },
        { code: 'de', level: 2, motherLanguage: false },
        { code: 'fr', level: 2, motherLanguage: false },
      ])
      expect(result.nativeLanguages).toEqual([{ code: 'de' }])
      expect(result.learning).toEqual([{ code: 'fr', level: 'intermediate', priority: 1 }])
    })

    it('keeps priorities contiguous after dropping an overlap', () => {
      const result = mapLanguages([
        { code: 'en', level: -1, motherLanguage: true },
        { code: 'en', level: 1 },
        { code: 'es', level: 1 },
        { code: 'it', level: 2 },
      ])
      expect(result.learning.map((l) => l.priority)).toEqual([1, 2])
    })

    it('drops codes v2 cannot represent rather than storing an unmatchable one', () => {
      const result = mapLanguages([
        { code: 'klingon', level: 2 },
        { code: 'en', level: 2 },
      ])
      expect(result.learning).toEqual([{ code: 'en', level: 'intermediate', priority: 1 }])
    })

    it('de-duplicates repeated entries', () => {
      const result = mapLanguages([
        { code: 'en', level: 1 },
        { code: 'en', level: 3 },
        { code: 'tr', level: -1, motherLanguage: true },
        { code: 'tr', level: -1, motherLanguage: true },
      ])
      expect(result.learning).toHaveLength(1)
      expect(result.nativeLanguages).toHaveLength(1)
    })

    /**
     * The whole reason v2 dropped CEFR. Squeezing v1's four values onto six
     * bands was lossy in both directions — the old mapping sent v1's top to
     * `B2` on purpose, and `C1`/`C2` were bands no migrated user could reach.
     * Now every v1 value has a counterpart rather than an approximation.
     */
    it('maps every v1 level to its exact counterpart, losing nothing', () => {
      const expected = ['absoluteBeginner', 'beginner', 'intermediate', 'fluent'] as const
      for (const [raw, level] of expected.entries()) {
        expect(mapLanguages([{ code: 'en', level: raw }]).learning[0]?.level).toBe(level)
      }
    })

    it('falls back to the lowest level for a value v1 never used', () => {
      expect(mapLanguages([{ code: 'en', level: 99 }]).learning[0]?.level).toBe('absoluteBeginner')
    })

    it('survives a missing or malformed languages field', () => {
      expect(mapLanguages(undefined).learning).toHaveLength(0)
      expect(mapLanguages('not an array').nativeLanguages).toHaveLength(0)
      expect(mapLanguages([{}, { code: 42 }]).learning).toHaveLength(0)
    })
  })

  describe('gender', () => {
    it('normalises case, which the live data needs', () => {
      expect(toGender('Male')).toBe('male')
      expect(toGender('female')).toBe('female')
      expect(toGender(' OTHER ')).toBe('other')
    })

    it('returns undefined for anything v2 does not model', () => {
      expect(toGender('non-binary')).toBeUndefined()
      expect(toGender(null)).toBeUndefined()
      expect(toGender(undefined)).toBeUndefined()
    })
  })

  describe('birth year', () => {
    it('extracts the year from v1 ISO birthdates', () => {
      expect(toBirthYear('1991-04-02T05:00:00.000+00:00')).toBe(1991)
    })

    it('rejects unusable values instead of writing a nonsense age', () => {
      const now = new Date('2026-01-01T00:00:00Z')
      expect(toBirthYear('not a date', now)).toBeUndefined()
      expect(toBirthYear('1850-01-01T00:00:00Z', now)).toBeUndefined()
      expect(toBirthYear('2026-01-01T00:00:00Z', now)).toBeUndefined()
      expect(toBirthYear(null, now)).toBeUndefined()
    })
  })

  it('treats a one-sided language list as unmatchable', () => {
    expect(isMatchable(mapLanguages([{ code: 'tr', level: -1, motherLanguage: true }]))).toBe(false)
    expect(isMatchable(mapLanguages([{ code: 'en', level: 1 }]))).toBe(false)
    expect(
      isMatchable(
        mapLanguages([
          { code: 'tr', level: -1, motherLanguage: true },
          { code: 'en', level: 1 },
        ]),
      ),
    ).toBe(true)
  })
})
