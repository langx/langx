import {
  ACCOUNT_DELETION_GRACE_DAYS,
  PUBLIC_STATS_TTL_MS,
  SUPPORTED_LOCALES,
  type PublicStatsDay,
} from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import {
  COUNTED_EVERY_MINUTES,
  countedAgo,
  formatCount,
  insightLink,
  linksFor,
  seriesOf,
  seriesTotal,
  SUPPORT_LINKS,
  TAKE_PART_LINKS,
  totalsStep,
  transparencyQuestions,
} from './transparency'

/** Any space a locale groups with — the French one is a narrow no-break space. */
const plain = (text: string) => text.replace(/\s/g, ' ')

describe('formatCount', () => {
  it('writes a count the way the reader’s language groups digits', () => {
    expect(formatCount(12345, 'en')).toBe('12,345')
    expect(formatCount(12345, 'de')).toBe('12.345')
    expect(formatCount(12345, 'pt-BR')).toBe('12.345')
    expect(plain(formatCount(12345, 'fr'))).toBe('12 345')
    expect(plain(formatCount(12345, 'ru'))).toBe('12 345')
  })

  it('leaves a four-digit count ungrouped where the language does', () => {
    // Spanish groups from five digits: "1234", but "12.345".
    expect(formatCount(1234, 'es')).toBe('1234')
    expect(formatCount(12345, 'es')).toBe('12.345')
  })

  it('never shortens: the page promises exactly how many', () => {
    expect(formatCount(1_234_567, 'en')).toBe('1,234,567')
    expect(formatCount(0, 'en')).toBe('0')
  })
})

describe('totalsStep', () => {
  it('keeps all four totals in Title while every one fits a half tile', () => {
    expect(totalsStep(['12,345', '845', '0', '42'])).toBe('title')
  })

  it('moves all four to Headline together once any one is longer', () => {
    expect(totalsStep(['12,345', '123,456', '0', '42'])).toBe('headline')
  })

  it('takes the placeholders of a page still loading as fitting', () => {
    expect(totalsStep(['', '', '', ''])).toBe('title')
  })
})

describe('countedAgo', () => {
  const t = createTranslate('en')
  const at = '2026-10-27T12:00:00.000Z'
  const later = (ms: number) => new Date(Date.parse(at) + ms)

  it('says when the server counted, in the largest whole unit', () => {
    expect(countedAgo(at, t, later(20_000))).toBe('Counted just now')
    expect(countedAgo(at, t, later(60_000))).toBe('Counted 1 minute ago')
    expect(countedAgo(at, t, later(4 * 60_000))).toBe('Counted 4 minutes ago')
    expect(countedAgo(at, t, later(2 * 3_600_000))).toBe('Counted 2 hours ago')
    expect(countedAgo(at, t, later(3 * 86_400_000))).toBe('Counted 3 days ago')
  })

  it('reads a server clock ahead of this one as just now, never as the future', () => {
    expect(countedAgo(at, t, later(-5 * 60_000))).toBe('Counted just now')
  })

  it('says nothing about a time it cannot read', () => {
    expect(countedAgo('not a date', t, later(0))).toBe('')
  })
})

describe('the 30-day series', () => {
  const daily: PublicStatsDay[] = [
    { day: '2026-10-25', members: 2, messages: 40, corrections: 1 },
    { day: '2026-10-26', members: 0, messages: 0, corrections: 0 },
    { day: '2026-10-27', members: 5, messages: 12, corrections: 3 },
  ]

  it('keeps the server’s order, oldest first, and a quiet day as a zero', () => {
    expect(seriesOf(daily, 'messages')).toEqual([
      { key: '2026-10-25', value: 40 },
      { key: '2026-10-26', value: 0 },
      { key: '2026-10-27', value: 12 },
    ])
  })

  it('sums one series over the window', () => {
    expect(seriesTotal(daily, 'members')).toBe(7)
    expect(seriesTotal(daily, 'corrections')).toBe(4)
    expect(seriesTotal([], 'messages')).toBe(0)
  })
})

describe('links the page draws', () => {
  it('finds a row in externalLinks.ts for every key it asks for', () => {
    for (const keys of [SUPPORT_LINKS, TAKE_PART_LINKS, ['kitchen.contributing'] as const]) {
      expect(linksFor(keys).map((link) => link.labelKey)).toEqual([...keys])
    }
    expect(linksFor(['legal.security'])[0]?.url).toMatch(/SECURITY\.md$/)
  })

  it('ends on insight.langx.io, the same row Our Kitchen opens this page from', () => {
    const insight = insightLink()
    expect(insight?.url).toBe('https://insight.langx.io')
    expect(insight?.route).toBe('/(app)/transparency')
  })
})

describe('the questions', () => {
  it('says the server’s own interval, from its own constant', () => {
    expect(COUNTED_EVERY_MINUTES * 60_000).toBe(PUBLIC_STATS_TTL_MS)
    const updates = transparencyQuestions(createTranslate('en')).find((q) => q.key === 'updates')
    expect(updates?.answer).toContain(`every ${COUNTED_EVERY_MINUTES} minutes`)
  })

  it('names the grace period and the settings rows by their own words', () => {
    const t = createTranslate('en')
    const exported = transparencyQuestions(t).find((q) => q.key === 'export')?.answer ?? ''
    expect(exported).toContain(`${ACCOUNT_DELETION_GRACE_DAYS} days`)
    for (const key of ['settings.exportData', 'settings.deleteAccount'] as const) {
      expect(exported).toContain(t(key))
    }
  })

  it.each(SUPPORTED_LOCALES)('leaves no placeholder unfilled in %s', (locale) => {
    const items = transparencyQuestions(createTranslate(locale))
    expect(items).toHaveLength(12)
    for (const item of items) {
      expect(item.question, item.key).not.toMatch(/[{}]/)
      expect(item.answer, item.key).not.toMatch(/[{}]/)
    }
  })

  it('answers the encryption question with a plain no, first', () => {
    const answer = transparencyQuestions(createTranslate('en')).find((q) => q.key === 'e2e')
    expect(answer?.answer.startsWith('No.')).toBe(true)
  })
})
