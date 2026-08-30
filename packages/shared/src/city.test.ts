import { describe, expect, it } from 'vitest'
import { cityKey } from './city'

describe('cityKey', () => {
  /**
   * The case the filter exists for. `'İ'.toLowerCase()` is an `i` plus a
   * combining dot, and `'ı'` is not `i` at all — so without the explicit map
   * the most-typed city in the user base has three keys that never meet.
   */
  it('agrees on İstanbul however it was typed', () => {
    const keys = ['İstanbul', 'Istanbul', 'istanbul', ' ISTANBUL ', 'ıstanbul'].map(cityKey)
    expect(new Set(keys).size).toBe(1)
    expect(keys[0]).toBe('istanbul')
  })

  it('folds diacritics the rest of the world writes', () => {
    expect(cityKey('München')).toBe(cityKey('Munchen'))
    expect(cityKey('São Paulo')).toBe(cityKey('Sao Paulo'))
    expect(cityKey('Málaga')).toBe('malaga')
  })

  it('treats punctuation and spacing as noise', () => {
    expect(cityKey('St. Petersburg')).toBe(cityKey('St Petersburg'))
    expect(cityKey('Saint-Denis')).toBe('saint denis')
    expect(cityKey('New   York')).toBe('new york')
  })

  it('leaves non-Latin scripts alone rather than emptying them', () => {
    expect(cityKey('Москва')).toBe('москва')
    expect(cityKey('東京')).toBe('東京')
    expect(cityKey('القاهرة')).toBe('القاهرة')
  })

  it('is idempotent, so a re-run of the backfill changes nothing', () => {
    for (const city of ['İzmir', 'São Paulo', 'St. Petersburg', 'Москва']) {
      expect(cityKey(cityKey(city))).toBe(cityKey(city))
    }
  })

  it('is empty for something with nothing to match on', () => {
    expect(cityKey('   ')).toBe('')
    expect(cityKey('---')).toBe('')
  })
})
