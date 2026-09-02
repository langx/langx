import { describe, expect, it } from 'vitest'
import { postLanguages, resolvePostLanguage } from './postLanguage'

describe('postLanguages', () => {
  it('orders by priority, not by the order the API sent', () => {
    const learning = [
      { code: 'ru', priority: 2 },
      { code: 'es', priority: 1 },
    ]
    expect(postLanguages(learning)).toEqual(['es', 'ru'])
  })

  it('leaves the caller list alone', () => {
    const learning = [
      { code: 'ru', priority: 2 },
      { code: 'es', priority: 1 },
    ]
    postLanguages(learning)
    expect(learning.map((entry) => entry.code)).toEqual(['ru', 'es'])
  })

  it('drops a code this build has no name for', () => {
    expect(
      postLanguages([
        { code: 'zz', priority: 1 },
        { code: 'en', priority: 2 },
      ]),
    ).toEqual(['en'])
  })

  it('has nothing to offer before the profile arrives', () => {
    expect(postLanguages(undefined)).toEqual([])
    expect(postLanguages([])).toEqual([])
  })
})

describe('resolvePostLanguage', () => {
  it('keeps a choice that is still on offer', () => {
    expect(resolvePostLanguage(['es', 'ru'], 'ru')).toBe('ru')
  })

  it('defaults to the most important language when nothing was chosen', () => {
    expect(resolvePostLanguage(['es', 'ru'], null)).toBe('es')
  })

  /**
   * The reason `chosen` is a loose string: a stored choice outlives the profile
   * it was made against. Dropping a learning language must not leave the
   * composer pointed at it — the server would reject the post.
   */
  it('falls back when the chosen language is no longer learned', () => {
    expect(resolvePostLanguage(['es'], 'ru')).toBe('es')
  })

  it('resolves to nothing when there is nothing to post in', () => {
    expect(resolvePostLanguage([], 'ru')).toBeUndefined()
    expect(resolvePostLanguage([], null)).toBeUndefined()
  })
})
