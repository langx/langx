import {
  isRepairable,
  PLAN_LIMITS,
  shiftDayKey,
  SUPPORTED_LOCALES,
  TOKEN_RULES,
  type Catalog,
  type Locale,
} from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from '../i18n/catalogs'
import { createTranslate } from '../i18n/runtime'
import { streakProtectText, translationQuotaText } from './limitCopy'

/**
 * Two sentences that quote a number the server enforces, pinned to it.
 *
 * The first said a paid plan "removes the limit" on translations; Pro has one.
 * The second said a missed day could be bought back "for a month"; the window
 * is `dayRepairMaxAgeDays`. Both were literals in eight catalogues, so the
 * only thing that could have caught the drift was somebody reading all eight.
 */

/** Every wording of a key in one locale: the string, or each plural form. */
function forms(locale: Locale, key: string): string[] {
  let node: unknown = catalogs[locale]
  for (const part of key.split('.')) node = (node as Catalog)[part]
  return typeof node === 'string' ? [node] : Object.values(node as Record<string, string>)
}

describe.each(SUPPORTED_LOCALES)('%s', (locale) => {
  const t = createTranslate(locale)

  it('quotes the translation limit Pro really has', () => {
    const text = translationQuotaText(t)
    expect(text).toContain(String(PLAN_LIMITS.pro.translationsPer24h))
    expect(text).not.toMatch(/[{}]/)
  })

  it('quotes the repair window the server enforces', () => {
    const text = streakProtectText(t)
    expect(text).toContain(String(TOKEN_RULES.sinks.dayRepairMaxAgeDays))
    expect(text).not.toMatch(/[{}]/)
  })

  it('writes no number of its own, so a config change cannot leave a stale one behind', () => {
    for (const key of ['chat.translationQuota', 'streak.protectBody']) {
      for (const form of forms(locale, key)) expect(form, `${locale} ${key}`).not.toMatch(/\d/)
    }
  })
})

describe('the numbers are the ones that are enforced', () => {
  it('Pro keeps a finite translation limit, above what free gets', () => {
    // If Pro ever becomes unlimited the sentence has to change shape, not
    // quote Infinity.
    expect(Number.isFinite(PLAN_LIMITS.pro.translationsPer24h)).toBe(true)
    expect(PLAN_LIMITS.pro.translationsPer24h).toBeGreaterThan(PLAN_LIMITS.free.translationsPer24h)
  })

  it('a missed day is repairable for exactly as many days as the sentence says', () => {
    const today = '2026-09-03'
    let reach = 0
    while (isRepairable(shiftDayKey(today, -(reach + 1)), today)) reach++
    expect(reach).toBe(TOKEN_RULES.sinks.dayRepairMaxAgeDays)
  })
})

describe('english', () => {
  const t = createTranslate('en')

  it('no longer says a plan removes the limit, or that the window is a month', () => {
    expect(translationQuotaText(t)).toBe(
      `You’ve reached today’s translation limit. Pro allows ${PLAN_LIMITS.pro.translationsPer24h} translations a day.`,
    )
    expect(translationQuotaText(t)).not.toMatch(/removes|free translations|paid plan/i)
    expect(streakProtectText(t)).toContain(
      `up to ${TOKEN_RULES.sinks.dayRepairMaxAgeDays} days after you miss it`,
    )
    expect(streakProtectText(t)).not.toMatch(/month/i)
  })
})

describe('the count inflects where the language needs it', () => {
  it('russian counts days and translations in the right case', () => {
    const t = createTranslate('ru')
    expect(t('streak.protectBody', { count: 1 })).toContain('1 дня')
    expect(t('streak.protectBody', { count: 3 })).toContain('3 дней')
    expect(t('streak.protectBody', { count: 14 })).toContain('14 дней')
    expect(t('chat.translationQuota', { count: 1 })).toContain('1 перевод в день')
    expect(t('chat.translationQuota', { count: 3 })).toContain('3 перевода в день')
    expect(t('chat.translationQuota', { count: 1000 })).toContain('1000 переводов в день')
  })

  it('arabic has a form for each band', () => {
    const t = createTranslate('ar')
    expect(t('streak.protectBody', { count: 1 })).toContain('خلال يوم واحد')
    expect(t('streak.protectBody', { count: 2 })).toContain('خلال يومين')
    expect(t('streak.protectBody', { count: 5 })).toContain('5 أيام')
    expect(t('streak.protectBody', { count: 14 })).toContain('14 يومًا')
    expect(t('chat.translationQuota', { count: 1000 })).toContain('1000 ترجمة في اليوم')
  })

  it('english says "1 day", not "1 days"', () => {
    const t = createTranslate('en')
    expect(t('streak.protectBody', { count: 1 })).toContain('up to 1 day after')
    expect(t('chat.translationQuota', { count: 1 })).toContain('1 translation a day')
  })
})
