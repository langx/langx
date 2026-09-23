import { PLAN_LIMITS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  applyLanguageEdit,
  refuseLanguageEdit,
  sameLanguageLists,
  type LanguageLists,
  type LanguageRefusal,
} from './profileLanguages'

const FREE = PLAN_LIMITS.free
const POLYGLOT = PLAN_LIMITS.pro_plus

function lists(native: string[], learning: [string, string, number][]): LanguageLists {
  return {
    nativeLanguages: native.map((code) => ({ code })),
    learning: learning.map(([code, level, priority]) => ({
      code,
      level: level as LanguageLists['learning'][number]['level'],
      priority,
    })),
  }
}

/** One native, one learning — a free account as onboarding leaves it. */
const free = lists(['tr'], [['en', 'intermediate', 1]])

/** Three learning languages in a deliberately scrambled stored order. */
const many = lists(
  ['tr'],
  [
    ['fr', 'beginner', 3],
    ['en', 'intermediate', 1],
    ['de', 'beginner', 2],
  ],
)

describe('applying a language edit', () => {
  it('swaps a native language in place', () => {
    const next = applyLanguageEdit(free, { kind: 'replaceNative', from: 'tr', to: 'de' })
    expect(next.nativeLanguages).toEqual([{ code: 'de' }])
    expect(next.learning).toEqual(free.learning)
  })

  /** The correction is which language it is, not how well it is spoken. */
  it('keeps the level and the position when a learning language is replaced', () => {
    const next = applyLanguageEdit(many, { kind: 'replaceLearning', from: 'de', to: 'es' })
    expect(next.learning).toEqual([
      { code: 'en', level: 'intermediate', priority: 1 },
      { code: 'es', level: 'beginner', priority: 2 },
      { code: 'fr', level: 'beginner', priority: 3 },
    ])
  })

  it('adds a learning language at the end, as a beginner', () => {
    const next = applyLanguageEdit(free, { kind: 'addLearning', code: 'de' })
    expect(next.learning).toEqual([
      { code: 'en', level: 'intermediate', priority: 1 },
      { code: 'de', level: 'absoluteBeginner', priority: 2 },
    ])
  })

  it('reads the stored list in priority order, not array order', () => {
    const next = applyLanguageEdit(many, { kind: 'moveLearning', code: 'de', to: 0 })
    expect(next.learning.map((l) => l.code)).toEqual(['de', 'en', 'fr'])
  })

  /** A drag can cross more than one row, which the arrows never could. */
  it('moves a learning language straight to the row it is dropped on', () => {
    const next = applyLanguageEdit(many, { kind: 'moveLearning', code: 'en', to: 2 })
    expect(next.learning).toEqual([
      { code: 'de', level: 'beginner', priority: 1 },
      { code: 'fr', level: 'beginner', priority: 2 },
      { code: 'en', level: 'intermediate', priority: 3 },
    ])
  })

  /** A gap in the priorities is a reorder nobody asked for, later. */
  it('leaves no gap in the priorities after a removal', () => {
    const next = applyLanguageEdit(many, { kind: 'removeLearning', code: 'en' })
    expect(next.learning).toEqual([
      { code: 'de', level: 'beginner', priority: 1 },
      { code: 'fr', level: 'beginner', priority: 2 },
    ])
  })

  it('changes one level and nothing else', () => {
    const next = applyLanguageEdit(many, { kind: 'setLevel', code: 'fr', level: 'fluent' })
    expect(next.learning.find((l) => l.code === 'fr')?.level).toBe('fluent')
    expect(next.learning.find((l) => l.code === 'en')?.level).toBe('intermediate')
  })

  it('never mutates what it was given', () => {
    const before = JSON.stringify(many)
    applyLanguageEdit(many, { kind: 'removeLearning', code: 'en' })
    applyLanguageEdit(many, { kind: 'moveLearning', code: 'fr', to: 1 })
    expect(JSON.stringify(many)).toBe(before)
  })

  /**
   * The queued second tap whose first tap was refused and rolled back. It must
   * come out saying nothing changed, because that is what stops the mutation
   * sending a body about a language that is not there.
   */
  it('changes nothing when the language it names is gone', () => {
    const next = applyLanguageEdit(free, { kind: 'replaceLearning', from: 'es', to: 'de' })
    expect(sameLanguageLists(next, free)).toBe(true)
  })
})

describe('refusing a language edit', () => {
  it('allows a swap at the cap, and refuses an addition', () => {
    expect(
      refuseLanguageEdit(free, { kind: 'replaceNative', from: 'tr', to: 'de' }, FREE),
    ).toBeNull()
    expect(refuseLanguageEdit(free, { kind: 'addNative', code: 'de' }, FREE)).toEqual({
      kind: 'cap',
      list: 'nativeLanguages',
      max: FREE.maxNativeLanguages,
    })
  })

  it('keeps the last one of each list', () => {
    expect(refuseLanguageEdit(free, { kind: 'removeNative', code: 'tr' }, FREE)).toEqual({
      kind: 'last',
      list: 'nativeLanguages',
    })
    expect(refuseLanguageEdit(free, { kind: 'removeLearning', code: 'en' }, FREE)).toEqual({
      kind: 'last',
      list: 'learningLanguages',
    })
  })

  it('refuses a language that is on the other list', () => {
    expect(refuseLanguageEdit(free, { kind: 'replaceNative', from: 'tr', to: 'en' }, FREE)).toEqual(
      {
        kind: 'overlap',
        code: 'en',
      },
    )
    expect(
      refuseLanguageEdit(free, { kind: 'replaceLearning', from: 'en', to: 'tr' }, FREE),
    ).toEqual({ kind: 'overlap', code: 'tr' })
  })

  it('refuses a language already on this one', () => {
    expect(
      refuseLanguageEdit(many, { kind: 'replaceLearning', from: 'de', to: 'fr' }, POLYGLOT),
    ).toEqual({ kind: 'duplicate', code: 'fr' })
  })

  /**
   * The grandfathered account: three learning languages on a plan allowing
   * one. Over the limit has to mean "cannot grow", never "frozen" — so every
   * edit that does not lengthen the list still goes through.
   */
  it('lets an over-limit list be edited and shrunk, but never grown', () => {
    expect(refuseLanguageEdit(many, { kind: 'removeLearning', code: 'de' }, FREE)).toBeNull()
    expect(
      refuseLanguageEdit(many, { kind: 'setLevel', code: 'de', level: 'fluent' }, FREE),
    ).toBeNull()
    expect(
      refuseLanguageEdit(many, { kind: 'replaceLearning', from: 'de', to: 'es' }, FREE),
    ).toBeNull()
    expect(refuseLanguageEdit(many, { kind: 'addLearning', code: 'es' }, FREE)).toEqual({
      kind: 'cap',
      list: 'learningLanguages',
      max: FREE.maxLearningLanguages,
    })
  })

  it('has nothing to do at the ends of the list, or for a level already set', () => {
    expect(refuseLanguageEdit(many, { kind: 'moveLearning', code: 'en', to: 0 }, FREE)).toEqual({
      kind: 'noop',
    })
    expect(refuseLanguageEdit(many, { kind: 'moveLearning', code: 'fr', to: 3 }, FREE)).toEqual({
      kind: 'noop',
    })
    expect(
      refuseLanguageEdit(many, { kind: 'setLevel', code: 'en', level: 'intermediate' }, FREE),
    ).toEqual({ kind: 'noop' })
    expect(refuseLanguageEdit(free, { kind: 'replaceNative', from: 'tr', to: 'tr' }, FREE)).toEqual(
      {
        kind: 'noop',
      },
    )
  })

  /**
   * Every refusal the screen has to word is one this file has produced. A new
   * kind without a case here fails on the missing key rather than shipping as
   * a control that dims with nothing to say.
   */
  it('produces every kind of refusal it declares', () => {
    const produced: Record<LanguageRefusal['kind'], boolean> = {
      cap: refuseLanguageEdit(free, { kind: 'addNative', code: 'de' }, FREE)?.kind === 'cap',
      overlap:
        refuseLanguageEdit(free, { kind: 'replaceNative', from: 'tr', to: 'en' }, FREE)?.kind ===
        'overlap',
      duplicate:
        refuseLanguageEdit(many, { kind: 'replaceLearning', from: 'de', to: 'fr' }, POLYGLOT)
          ?.kind === 'duplicate',
      last: refuseLanguageEdit(free, { kind: 'removeNative', code: 'tr' }, FREE)?.kind === 'last',
      noop:
        refuseLanguageEdit(many, { kind: 'moveLearning', code: 'en', to: 0 }, FREE)?.kind ===
        'noop',
    }
    expect(Object.values(produced).every(Boolean)).toBe(true)
  })
})
