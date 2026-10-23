import { afterEach, describe, expect, it, vi } from 'vitest'
import { shortDisplayName } from './displayName'

describe('shortDisplayName', () => {
  it('keeps every word but the last and an initial of the last', () => {
    expect(shortDisplayName('Behic Sakar')).toBe('Behic S.')
    expect(shortDisplayName('Malik Sahb')).toBe('Malik S.')
    expect(shortDisplayName('Ana Maria Silva')).toBe('Ana Maria S.')
  })

  it('trims and collapses spaces', () => {
    expect(shortDisplayName('  Behic \t  Sakar  ')).toBe('Behic S.')
    expect(shortDisplayName('  Cher ')).toBe('Cher')
    expect(shortDisplayName('   ')).toBe('')
  })

  it('leaves a single word as it is', () => {
    expect(shortDisplayName('Cher')).toBe('Cher')
    expect(shortDisplayName('LangX')).toBe('LangX')
  })

  it('leaves a name that already ends in an initial', () => {
    expect(shortDisplayName('Behic S.')).toBe('Behic S.')
    expect(shortDisplayName(shortDisplayName('Ana Maria Silva'))).toBe('Ana Maria S.')
  })

  it('takes a whole letter from Turkish, Cyrillic and Arabic names', () => {
    expect(shortDisplayName('Ayşe İnce')).toBe('Ayşe İ.')
    expect(shortDisplayName('Behiç Şakar')).toBe('Behiç Ş.')
    expect(shortDisplayName('Иван Петров')).toBe('Иван П.')
    expect(shortDisplayName('محمد علي')).toBe('محمد ع.')
  })

  it('keeps a combining mark with the letter it belongs to', () => {
    // "S" followed by U+0327 COMBINING CEDILLA: two code points, one letter.
    expect(shortDisplayName('Behic Şakar')).toBe('Behic Ş.')
  })

  it('takes a whole emoji as the initial', () => {
    expect(shortDisplayName('Ana 👩‍👩‍👧')).toBe('Ana 👩‍👩‍👧.')
    expect(shortDisplayName('Ana 👍🏽fan')).toBe('Ana 👍🏽.')
    expect(shortDisplayName('Ana 🇹🇷')).toBe('Ana 🇹🇷.')
  })

  it('leaves Chinese, Japanese and Korean names alone', () => {
    expect(shortDisplayName('王小明')).toBe('王小明')
    expect(shortDisplayName('山田 太郎')).toBe('山田 太郎')
    expect(shortDisplayName('김 민준')).toBe('김 민준')
  })

  describe('without Intl.Segmenter, as on Hermes', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('groups the same clusters by hand', () => {
      const { Segmenter: _omitted, ...rest } = Intl as typeof Intl & { Segmenter?: unknown }
      vi.stubGlobal('Intl', rest)
      expect('Segmenter' in Intl).toBe(false)
      expect(shortDisplayName('Behic Sakar')).toBe('Behic S.')
      expect(shortDisplayName('Behic Şakar')).toBe('Behic Ş.')
      expect(shortDisplayName('Ana 👩‍👩‍👧')).toBe('Ana 👩‍👩‍👧.')
      expect(shortDisplayName('Ana 👍🏽fan')).toBe('Ana 👍🏽.')
      expect(shortDisplayName('Ana 🇹🇷')).toBe('Ana 🇹🇷.')
      expect(shortDisplayName('محمد علي')).toBe('محمد ع.')
    })
  })
})
