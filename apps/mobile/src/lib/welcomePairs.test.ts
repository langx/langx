import { describe, expect, it } from 'vitest'
import { welcomePairs } from './welcomePairs'

describe('welcome pairs', () => {
  it('opens with the reader own language, in its own script', () => {
    const [first] = welcomePairs('tr')
    expect(first).toEqual({ left: 'Türkçe', right: 'English' })
  })

  it('pairs an English reader with something other than English', () => {
    const [first] = welcomePairs('en')
    expect(first?.left).toBe('English')
    expect(first?.right).not.toBe('English')
  })

  it('resolves a locale down to its language', () => {
    // `pt-BR` is what the device reports; `pt` is what the table holds.
    const [first] = welcomePairs('pt-BR')
    expect(first?.left).toBe('Português')
  })

  it('never shows a language against itself, or twice', () => {
    for (const locale of ['en', 'tr', 'es', 'ru', 'ar', 'fr', 'de', 'pt-BR', 'ja', 'zz']) {
      const pairs = welcomePairs(locale)
      expect(pairs.length).toBeGreaterThan(0)
      for (const pair of pairs) expect(pair.left).not.toBe(pair.right)
      const own = welcomePairs(locale)[0]?.left
      // The reader's own language leads and then does not come back.
      expect(pairs.slice(1).flatMap((p) => [p.left, p.right])).not.toContain(own)
    }
  })

  it('still returns something for a language the table does not know', () => {
    expect(welcomePairs('zz').length).toBeGreaterThan(0)
  })
})
