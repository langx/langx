import { describe, expect, it } from 'vitest'
import { echoPackFileSchema, hskLanguageLevel, jlptLanguageLevel } from './echoPacks'

describe('HSK packs', () => {
  it('put each HSK level where its CEFR band already goes', () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => hskLanguageLevel(n as 1))).toEqual([
      'absoluteBeginner',
      'beginner',
      'intermediate',
      'intermediate',
      'fluent',
      'fluent',
    ])
  })

  const file = (overrides: Record<string, unknown>) => ({
    lang: 'zh',
    contentVersion: 1,
    sources: [{ name: 'Tatoeba', licence: 'CC BY 2.0 FR', url: 'https://tatoeba.org/' }],
    items: [{ index: 0, kind: 'phrase', text: '我是学生。', gloss: { en: 'I am a student.' } }],
    ...overrides,
  })

  it('accept an id that says the HSK level, at the level it maps to', () => {
    const parsed = echoPackFileSchema.safeParse(
      file({ id: 'zh:hsk3', level: 'intermediate', hsk: 3 }),
    )
    expect(parsed.success).toBe(true)
  })

  /*
   * HSK 3 and 4 share `intermediate`. An id written from the level rather than
   * the HSK number would give both packs one `_id`, and the second seeded
   * would overwrite the first.
   */
  it('refuse an HSK pack filed under its level', () => {
    const parsed = echoPackFileSchema.safeParse(
      file({ id: 'zh:intermediate', level: 'intermediate', hsk: 3 }),
    )
    expect(parsed.success).toBe(false)
  })

  it('refuse an HSK pack at the wrong level', () => {
    const parsed = echoPackFileSchema.safeParse(file({ id: 'zh:hsk5', level: 'beginner', hsk: 5 }))
    expect(parsed.success).toBe(false)
  })
})

describe('JLPT packs', () => {
  it('put each JLPT level where its CEFR band already goes, N5 first', () => {
    expect([5, 4, 3, 2, 1].map((n) => jlptLanguageLevel(n as 5))).toEqual([
      'absoluteBeginner',
      'beginner',
      'intermediate',
      'intermediate',
      'fluent',
    ])
  })

  const file = (overrides: Record<string, unknown>) => ({
    lang: 'ja',
    contentVersion: 1,
    sources: [{ name: 'Tatoeba', licence: 'CC BY 2.0 FR', url: 'https://tatoeba.org/' }],
    items: [
      {
        index: 0,
        kind: 'phrase',
        text: '私は学生です。',
        reading: 'わたしは がくせいです。',
        gloss: { en: 'I am a student.' },
      },
    ],
    ...overrides,
  })

  it('accept an id that says the JLPT level, at the level it maps to', () => {
    const parsed = echoPackFileSchema.safeParse(
      file({ id: 'ja:jlptN3', level: 'intermediate', jlpt: 3 }),
    )
    expect(parsed.success).toBe(true)
  })

  /* N3 and N2 share `intermediate`, for the reason HSK 3 and 4 do. */
  it('refuse a JLPT pack filed under its level', () => {
    const parsed = echoPackFileSchema.safeParse(
      file({ id: 'ja:intermediate', level: 'intermediate', jlpt: 3 }),
    )
    expect(parsed.success).toBe(false)
  })

  it('refuse a JLPT pack at the wrong level', () => {
    const parsed = echoPackFileSchema.safeParse(
      file({ id: 'ja:jlptN5', level: 'beginner', jlpt: 5 }),
    )
    expect(parsed.success).toBe(false)
  })

  it('refuse a pack that claims both names', () => {
    const parsed = echoPackFileSchema.safeParse(
      file({ id: 'ja:jlptN5', level: 'absoluteBeginner', jlpt: 5, hsk: 1 }),
    )
    expect(parsed.success).toBe(false)
  })
})
