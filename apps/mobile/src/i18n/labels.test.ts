import { describe, expect, it } from 'vitest'
import { createTranslate } from './runtime'
import { lastSeenLabel } from './labels'

const NOW = new Date('2026-08-31T12:00:00Z')
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const ago = (ms: number, locale: 'en' | 'ru' | 'tr' = 'en') =>
  lastSeenLabel(createTranslate(locale), new Date(NOW.getTime() - ms), NOW)

describe('lastSeenLabel', () => {
  it('says the whole sentence, one rung per unit', () => {
    expect(ago(10_000)).toBe('Last seen just now')
    expect(ago(MINUTE)).toBe('Last seen 1 minute ago')
    expect(ago(12 * MINUTE)).toBe('Last seen 12 minutes ago')
    expect(ago(3 * HOUR)).toBe('Last seen 3 hours ago')
    expect(ago(2 * DAY)).toBe('Last seen 2 days ago')
    expect(ago(60 * DAY)).toBe('Last seen 2 months ago')
    expect(ago(800 * DAY)).toBe('Last seen 2 years ago')
  })

  /**
   * Russian is why these are whole sentences rather than a phrase dropped into
   * a wrapper: the noun after a numeral inflects three ways, and 2, 5 and 21
   * take three different forms of the same word.
   */
  it('picks the right Russian plural category', () => {
    // The count is inside the sentence, so compare the inflected noun rather
    // than the whole string — "1 день" and "21 день" differ only by the number.
    const noun = (n: number) =>
      ago(n * DAY, 'ru')
        .replace(String(n), '')
        .trim()
    expect(noun(1)).toContain('день')
    expect(noun(2)).toContain('дня')
    expect(noun(5)).toContain('дней')
    // 21 takes the singular form in Russian, which is the case an `!== 1`
    // ternary gets wrong and a CLDR category gets right.
    expect(noun(21)).toBe(noun(1))
    expect(new Set([noun(1), noun(2), noun(5)]).size).toBe(3)
  })

  it('reads a clock a few minutes fast as "just now", not a negative count', () => {
    expect(lastSeenLabel(createTranslate('en'), new Date(NOW.getTime() + 5 * MINUTE), NOW)).toBe(
      'Last seen just now',
    )
  })

  it('translates', () => {
    expect(ago(3 * HOUR, 'tr')).toBe('3 saat önce görüldü')
  })
})
