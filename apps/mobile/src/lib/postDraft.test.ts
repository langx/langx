import { describe, expect, it } from 'vitest'
import type { PostAsk } from './postAsks'
import {
  asksFromParams,
  asksParam,
  canSubmitPost,
  draftBlock,
  draftBlockKey,
  postedKey,
  type DraftState,
} from './postDraft'

function draft(overrides: Partial<DraftState> = {}): DraftState {
  return { body: '', asks: [], media: [], language: 'es', asksAllowed: true, ...overrides }
}

describe('draftBlock', () => {
  it('lets a moment through with words, or with a photo or video alone', () => {
    expect(draftBlock(draft({ body: 'Mi desayuno' }))).toBeNull()
    expect(draftBlock(draft({ media: [{ kind: 'image' }] }))).toBeNull()
    expect(draftBlock(draft({ media: [{ kind: 'video' }] }))).toBeNull()
  })

  it('refuses an empty moment, and a voice note on its own', () => {
    expect(draftBlock(draft())).toBe('needsSomething')
    expect(draftBlock(draft({ body: '   ' }))).toBe('needsSomething')
    expect(draftBlock(draft({ media: [{ kind: 'audio' }] }))).toBe('needsSomething')
  })

  it('needs words for every ask, whatever else is attached', () => {
    for (const asks of [['correction'], ['pronunciation'], ['correction', 'pronunciation']]) {
      expect(draftBlock(draft({ asks: asks as PostAsk[], media: [{ kind: 'image' }] }))).toBe(
        'needsText',
      )
      expect(draftBlock(draft({ asks: asks as PostAsk[], body: 'Yo tener hambre' }))).toBeNull()
    }
  })

  it('refuses an ask in a language the writer does not learn', () => {
    expect(draftBlock(draft({ asks: ['correction'], body: 'Merhaba', asksAllowed: false }))).toBe(
      'askNeedsLearning',
    )
    // The same words with the chips off — a moment in a native language — go.
    expect(draftBlock(draft({ body: 'Merhaba', asksAllowed: false }))).toBeNull()
  })

  it('needs a language before anything else', () => {
    expect(draftBlock(draft({ body: 'Hola', language: undefined }))).toBe('noLanguage')
  })

  it('agrees with canSubmitPost and has a sentence for every block', () => {
    expect(canSubmitPost(draft({ body: 'Hola' }))).toBe(true)
    expect(canSubmitPost(draft())).toBe(false)
    for (const block of [
      'noLanguage',
      'askNeedsLearning',
      'needsText',
      'needsSomething',
    ] as const) {
      expect(draftBlockKey(block)).toMatch(/^feed\./)
    }
  })
})

describe('asksFromParams', () => {
  it('reads the comma string compose is handed', () => {
    expect(asksFromParams({ asks: 'pronunciation' })).toEqual(['pronunciation'])
    expect(asksFromParams({ asks: 'pronunciation,correction' })).toEqual([
      'correction',
      'pronunciation',
    ])
    expect(asksFromParams({ asks: '' })).toEqual([])
  })

  it('maps a legacy ?kind= to the one ask it named', () => {
    expect(asksFromParams({ kind: 'pronunciation' })).toEqual(['pronunciation'])
    expect(asksFromParams({ kind: 'correction' })).toEqual(['correction'])
    // A hand-typed or stale kind preselects nothing rather than guessing.
    expect(asksFromParams({ kind: 'nonsense' })).toEqual([])
  })

  it('prefers asks over a kind, and opens a moment when given neither', () => {
    expect(asksFromParams({ asks: 'correction', kind: 'pronunciation' })).toEqual(['correction'])
    expect(asksFromParams({})).toEqual([])
  })

  it('round-trips through asksParam', () => {
    const asks: PostAsk[] = ['pronunciation', 'correction']
    expect(asksFromParams({ asks: asksParam(asks) })).toEqual(['correction', 'pronunciation'])
  })
})

describe('postedKey', () => {
  it('promises only what was asked for', () => {
    expect(postedKey([])).toBe('feed.postedPlain')
    expect(postedKey(['correction'])).toBe('feed.postedCorrection')
    expect(postedKey(['pronunciation'])).toBe('feed.postedPronunciation')
    expect(postedKey(['correction', 'pronunciation'])).toBe('feed.postedBoth')
  })
})
