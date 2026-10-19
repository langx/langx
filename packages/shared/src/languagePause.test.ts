import { describe, expect, it } from 'vitest'
import { nextGiftLanguages, pausedLanguageCodes } from './languagePause'

const learn = (code: string, priority: number) => ({ code, level: 'beginner', priority })

describe('pausedLanguageCodes', () => {
  it('pauses nothing for somebody with no gift languages, however many they list', () => {
    // A v1 account with five learning languages on the free plan: grandfathered.
    const profile = {
      nativeLanguages: [{ code: 'tr' }, { code: 'de' }],
      learning: ['en', 'es', 'fr', 'it', 'ja'].map((code, i) => learn(code, i + 1)),
    }
    expect(pausedLanguageCodes(profile, 'free')).toEqual([])
  })

  it('pauses the gift languages once the plan is free, and none while it is Pro', () => {
    const profile = {
      nativeLanguages: [{ code: 'tr' }, { code: 'de' }],
      learning: [learn('en', 1), learn('es', 2), learn('fr', 3)],
      giftLanguages: ['es', 'fr', 'de'],
    }
    expect(pausedLanguageCodes(profile, 'pro')).toEqual([])
    expect(pausedLanguageCodes(profile, 'free')).toEqual(['es', 'fr', 'de'])
  })

  it('never leaves a list below the plan allowance', () => {
    // The language they joined with was removed during the gift: the first
    // gift language (by the order they set) takes its place, the rest pause.
    const profile = {
      nativeLanguages: [{ code: 'tr' }],
      learning: [learn('fr', 2), learn('es', 1)],
      giftLanguages: ['es', 'fr'],
    }
    expect(pausedLanguageCodes(profile, 'free')).toEqual(['fr'])
  })
})

describe('nextGiftLanguages', () => {
  const before = {
    nativeLanguages: [{ code: 'tr' }],
    learning: [learn('en', 1)],
  }

  it('marks a language added during a gift, and only then', () => {
    const after = { nativeLanguages: [{ code: 'tr' }], learning: [learn('en', 1), learn('es', 2)] }
    expect(nextGiftLanguages(before, after, true)).toEqual(['es'])
    expect(nextGiftLanguages(before, after, false)).toEqual([])
  })

  it('keeps a mark while the language is listed, in either list', () => {
    const marked = { ...before, learning: [learn('en', 1), learn('es', 2)], giftLanguages: ['es'] }
    const moved = { nativeLanguages: [{ code: 'tr' }, { code: 'es' }], learning: [learn('en', 1)] }
    expect(nextGiftLanguages(marked, moved, false)).toEqual(['es'])
  })

  it('drops the mark of a language that is no longer listed', () => {
    const marked = { ...before, learning: [learn('en', 1), learn('es', 2)], giftLanguages: ['es'] }
    expect(nextGiftLanguages(marked, before, false)).toEqual([])
  })
})
