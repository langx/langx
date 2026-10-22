import { describe, expect, it } from 'vitest'
import { learningTargetFor, translateTargetFor, translateTargetOptions } from './translation'

describe('translateTargetFor', () => {
  it('defaults to the first native language', () => {
    expect(translateTargetFor({ nativeLanguages: [{ code: 'tr' }, { code: 'de' }] })).toBe('tr')
  })

  it('honours a choice that is still a native language', () => {
    expect(
      translateTargetFor({
        nativeLanguages: [{ code: 'tr' }, { code: 'de' }],
        settings: { translateTo: 'de' },
      }),
    ).toBe('de')
  })

  /** Languages can be edited after the choice was made; the choice does not outlive them. */
  it('falls back when the chosen language is no longer native', () => {
    expect(
      translateTargetFor({ nativeLanguages: [{ code: 'tr' }], settings: { translateTo: 'de' } }),
    ).toBe('tr')
  })

  it('never points at a language someone is learning', () => {
    expect(
      translateTargetFor({ nativeLanguages: [{ code: 'tr' }], settings: { translateTo: 'en' } }),
    ).toBe('tr')
  })

  it('skips a signed language, and is undefined when nothing is left', () => {
    expect(translateTargetFor({ nativeLanguages: [{ code: 'ase' }, { code: 'tr' }] })).toBe('tr')
    expect(translateTargetFor({ nativeLanguages: [{ code: 'ase' }] })).toBeUndefined()
  })

  it('treats null as no choice', () => {
    expect(
      translateTargetFor({ nativeLanguages: [{ code: 'tr' }], settings: { translateTo: null } }),
    ).toBe('tr')
  })
})

describe('translateTargetOptions', () => {
  it('offers the native languages that have a written form, in order', () => {
    expect(
      translateTargetOptions({
        nativeLanguages: [{ code: 'de' }, { code: 'ase' }, { code: 'tr' }],
      }),
    ).toEqual(['de', 'tr'])
  })
})

describe('learningTargetFor', () => {
  const codes = (...list: string[]) => list.map((code) => ({ code }))

  it('picks the language being learned that the partner speaks natively', () => {
    expect(learningTargetFor(codes('es', 'en'), codes('en'))).toBe('en')
  })

  it('falls back to the first language being learned', () => {
    expect(learningTargetFor(codes('es', 'en'), codes('ja'))).toBe('es')
    expect(learningTargetFor(codes('es'), undefined)).toBe('es')
  })

  it('is undefined for somebody learning nothing', () => {
    expect(learningTargetFor([], codes('en'))).toBeUndefined()
    expect(learningTargetFor(undefined, codes('en'))).toBeUndefined()
  })
})
