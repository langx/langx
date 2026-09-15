import { PLAN_LIMITS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  applyLanguageEdit,
  profileBeforeEdit,
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
    const next = applyLanguageEdit(many, { kind: 'moveLearning', code: 'de', direction: 'up' })
    expect(next.learning.map((l) => l.code)).toEqual(['de', 'en', 'fr'])
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
    applyLanguageEdit(many, { kind: 'moveLearning', code: 'fr', direction: 'up' })
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

  /**
   * The shape of the bug this guard exists for: the mutation applied one tap
   * to the cache and then applied it again to that same cache, so a language
   * added once arrived as two rows — and removing either of them removed both,
   * because a row is a language and a language is filtered by its code.
   *
   * The screen refuses a duplicate long before this, so the second application
   * is the only caller that can reach here. It now costs nothing.
   */
  it('adds a language once however many times it is applied', () => {
    const once = applyLanguageEdit(free, { kind: 'addLearning', code: 'de' })
    const twice = applyLanguageEdit(once, { kind: 'addLearning', code: 'de' })
    expect(twice.learning).toEqual(once.learning)
    expect(twice.learning.filter((l) => l.code === 'de')).toHaveLength(1)

    const nativeOnce = applyLanguageEdit(free, { kind: 'addNative', code: 'de' })
    const nativeTwice = applyLanguageEdit(nativeOnce, { kind: 'addNative', code: 'de' })
    expect(nativeTwice.nativeLanguages).toEqual([{ code: 'tr' }, { code: 'de' }])
  })

  /** The same, from the other side: a replacement already made is not a second row. */
  it('does not duplicate when replacing with a language already on the list', () => {
    const swapped = applyLanguageEdit(free, { kind: 'replaceNative', from: 'tr', to: 'de' })
    const again = applyLanguageEdit(swapped, { kind: 'replaceNative', from: 'tr', to: 'de' })
    expect(again.nativeLanguages).toEqual([{ code: 'de' }])

    const learning = applyLanguageEdit(many, { kind: 'replaceLearning', from: 'de', to: 'es' })
    const learningAgain = applyLanguageEdit(learning, {
      kind: 'replaceLearning',
      from: 'de',
      to: 'es',
    })
    expect(learningAgain.learning.map((l) => l.code)).toEqual(['en', 'es', 'fr'])
  })
})

/**
 * The half of the fix that lives in the mutation: an edit is applied to the
 * cache once, for the eye, and the body is built from what it was applied to
 * rather than from what came out.
 */
describe('choosing what to build the request body from', () => {
  const before = free
  const shown = applyLanguageEdit(free, { kind: 'addLearning', code: 'de' })

  it('goes back to the lists the edit was applied to while the cache still holds its result', () => {
    expect(profileBeforeEdit(shown, { before, shown })).toBe(before)
  })

  /**
   * The queued tap: a request ahead of this one has answered and written the
   * server's own profile over the optimistic one. That answer is what this
   * edit belongs on — applying it to the lists from before would undo it.
   */
  it('takes the cache when something has landed in it since', () => {
    const answered = { ...shown }
    expect(profileBeforeEdit(answered, { before, shown })).toBe(answered)
  })

  /** An equal-looking profile is not the same profile: identity is the question. */
  it('does not mistake a copy of the optimistic profile for the optimistic profile', () => {
    expect(profileBeforeEdit({ ...shown }, { before, shown })).not.toBe(before)
  })

  it('takes the cache when there was nothing to apply the edit to', () => {
    expect(profileBeforeEdit(shown, {})).toBe(shown)
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
    expect(
      refuseLanguageEdit(many, { kind: 'moveLearning', code: 'en', direction: 'up' }, FREE),
    ).toEqual({ kind: 'noop' })
    expect(
      refuseLanguageEdit(many, { kind: 'moveLearning', code: 'fr', direction: 'down' }, FREE),
    ).toEqual({ kind: 'noop' })
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
        refuseLanguageEdit(many, { kind: 'moveLearning', code: 'en', direction: 'up' }, FREE)
          ?.kind === 'noop',
    }
    expect(Object.values(produced).every(Boolean)).toBe(true)
  })
})
