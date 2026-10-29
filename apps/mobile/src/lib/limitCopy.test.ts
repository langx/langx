import {
  effectivePlanTier,
  isRepairable,
  PLAN_LIMITS,
  QUOTA_WINDOW_MS,
  shiftDayKey,
  SUPPORTED_LOCALES,
  TOKEN_RULES,
  type Catalog,
  type Locale,
} from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { catalogs } from '../i18n/catalogs'
import { createTranslate } from '../i18n/runtime'
import {
  chatVoiceLimitText,
  isTranslationFairUse,
  offersPlansAtTranslationLimit,
  streakProtectText,
  translationQuotaText,
} from './limitCopy'

/**
 * Sentences about a limit the server enforces, pinned to it.
 *
 * The first once said a paid plan "removes the limit" on translations while
 * Pro had one; since 17 October 2026 it does remove it, and the sentence says
 * so. The second said a missed day could be bought back "for a month"; the
 * window is `dayRepairMaxAgeDays`. Both were literals in eight catalogues, so
 * the only thing that could have caught the drift was somebody reading all
 * eight.
 */

/** Every wording of a key in one locale: the string, or each plural form. */
function forms(locale: Locale, key: string): string[] {
  let node: unknown = catalogs[locale]
  for (const part of key.split('.')) node = (node as Catalog)[part]
  return typeof node === 'string' ? [node] : Object.values(node as Record<string, string>)
}

/** What the server sends at the fair-use ceiling, as `ApiRequestError` carries it. */
const fairUseRefusal = {
  code: 'QUOTA_EXCEEDED',
  limit: 'translationFairUsePer24h',
  retryAt: '2026-10-18T12:00:00.000Z',
}
/** What it sends at the free plan's allowance. */
const allowanceRefusal = { code: 'QUOTA_EXCEEDED', retryAt: '2026-10-18T12:00:00.000Z' }

/** The rolling window the server counts in, as the fair-use alert quotes it. */
const windowHours = QUOTA_WINDOW_MS / (60 * 60 * 1000)

/**
 * The word each locale uses for fair use — the same one its media alert
 * (`chat.mediaQuota`) already uses, so the two ceilings read as one idea.
 */
const FAIR_USE: Record<Locale, RegExp> = {
  en: /fair-use/,
  tr: /adil kullanım/,
  es: /uso justo/,
  'pt-BR': /uso justo/,
  fr: /usage raisonnable/,
  de: /Fair-Use/,
  ru: /честного использования/,
  ar: /الاستخدام العادل/,
}

describe.each(SUPPORTED_LOCALES)('%s', (locale) => {
  const t = createTranslate(locale)

  it('words the two translation refusals differently, each in full', () => {
    const allowance = translationQuotaText(t, false)
    const fairUse = translationQuotaText(t, true)
    expect(allowance).toBe(t('chat.translationQuota'))
    expect(fairUse).toBe(t('chat.translationFairUse', { count: windowHours }))
    expect(fairUse).not.toBe(allowance)
    for (const text of [allowance, fairUse]) expect(text).not.toMatch(/[{}]/)
  })

  /**
   * Behic's call of 17 October 2026: the alert says fair use and when it
   * resets, and never sells — the ceiling is the same on every plan, so there
   * is nothing to buy past it.
   */
  it('names fair use and when it resets, and no plan or purchase', () => {
    const fairUse = translationQuotaText(t, true)
    expect(fairUse).toMatch(FAIR_USE[locale])
    expect(fairUse).toContain(String(windowHours))
    expect(fairUse).not.toMatch(/\bPro\b|LangX/)
  })

  it('quotes the repair window the server enforces', () => {
    const text = streakProtectText(t)
    expect(text).toContain(String(TOKEN_RULES.sinks.dayRepairMaxAgeDays))
    expect(text).not.toMatch(/[{}]/)
  })

  it('quotes the read-aloud allowance and the window it comes back in', () => {
    const text = chatVoiceLimitText(t)
    expect(text).toContain(String(PLAN_LIMITS.free.chatVoicesPerDay))
    expect(text).toContain(t('chat.limitWindow', { count: windowHours }))
    expect(text).toContain(String(windowHours))
    expect(text).not.toMatch(/[{}]/)
  })

  /**
   * Pro's translations have no number to quote, and the fair-use ceiling is
   * not one to plan around — a digit in either is a number that has gone
   * stale, or one Pro does not have. The read-aloud limit said "24 hours" in
   * every language, beside the window the server counts in.
   */
  it('writes no number of its own, so a config change cannot leave a stale one behind', () => {
    for (const key of [
      'chat.translationQuota',
      'chat.translationFairUse',
      'streak.protectBody',
      'chat.speakLimit',
      'chat.limitWindow',
    ]) {
      for (const form of forms(locale, key)) expect(form, `${locale} ${key}`).not.toMatch(/\d/)
    }
  })
})

describe('the numbers are the ones that are enforced', () => {
  it('Pro has no daily translation allowance; free has one', () => {
    // If Pro ever gets a number again, the sentence has to change shape and
    // quote it, rather than go on promising there is none.
    expect(PLAN_LIMITS.pro.translationsPer24h).toBeNull()
    expect(PLAN_LIMITS.free.translationsPer24h).toBeGreaterThan(0)
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

  it('says Pro is unlimited, and the window is not a month', () => {
    expect(translationQuotaText(t, false)).toBe(
      'You’ve reached today’s translation limit. Pro has unlimited translations.',
    )
    expect(streakProtectText(t)).toContain(
      `up to ${TOKEN_RULES.sinks.dayRepairMaxAgeDays} days after you miss it`,
    )
    expect(streakProtectText(t)).not.toMatch(/month/i)
  })

  it('says when the read-aloud allowance comes back', () => {
    expect(chatVoiceLimitText(t)).toBe(
      `You’ve used today’s ${PLAN_LIMITS.free.chatVoicesPerDay} readings. They reset in ${windowHours} hours.`,
    )
  })

  it('calls the ceiling fair use, and names no plan in it', () => {
    const text = translationQuotaText(t, true)
    expect(text).toBe(
      `You’ve reached the fair-use limit for translations, which is there to stop automated use. It resets within ${windowHours} hours.`,
    )
    expect(text).not.toMatch(/\bPro\b|plan|upgrade|buy|subscri/i)
  })
})

describe('the count inflects where the language needs it', () => {
  it('russian counts days in the right case', () => {
    const t = createTranslate('ru')
    expect(t('streak.protectBody', { count: 1 })).toContain('1 дня')
    expect(t('streak.protectBody', { count: 3 })).toContain('3 дней')
    expect(t('streak.protectBody', { count: 14 })).toContain('14 дней')
    expect(t('chat.translationFairUse', { count: 1 })).toContain('в течение 1 часа')
    expect(t('chat.translationFairUse', { count: 24 })).toContain('в течение 24 часов')
    expect(t('chat.limitWindow', { count: 1 })).toBe('через 1 час')
    expect(t('chat.limitWindow', { count: 24 })).toBe('через 24 часа')
    expect(t('chat.limitWindow', { count: 12 })).toBe('через 12 часов')
  })

  it('arabic has a form for each band', () => {
    const t = createTranslate('ar')
    expect(t('streak.protectBody', { count: 1 })).toContain('خلال يوم واحد')
    expect(t('streak.protectBody', { count: 2 })).toContain('خلال يومين')
    expect(t('streak.protectBody', { count: 5 })).toContain('5 أيام')
    expect(t('streak.protectBody', { count: 14 })).toContain('14 يومًا')
    expect(t('chat.translationFairUse', { count: 2 })).toContain('خلال ساعتين')
    expect(t('chat.translationFairUse', { count: 24 })).toContain('خلال 24 ساعةً')
    expect(t('chat.limitWindow', { count: 2 })).toBe('خلال ساعتين')
    expect(t('chat.limitWindow', { count: 6 })).toBe('خلال 6 ساعات')
    expect(t('chat.limitWindow', { count: 24 })).toBe('خلال 24 ساعةً')
  })

  it('english says "1 day", not "1 days"', () => {
    const t = createTranslate('en')
    expect(t('streak.protectBody', { count: 1 })).toContain('up to 1 day after')
    expect(t('chat.translationFairUse', { count: 1 })).toContain('within 1 hour.')
  })
})

describe('which refusal is the fair-use ceiling', () => {
  it('is the one the server marks', () => {
    expect(isTranslationFairUse(fairUseRefusal)).toBe(true)
  })

  it('is not the free allowance, which carries no mark', () => {
    expect(isTranslationFairUse(allowanceRefusal)).toBe(false)
  })

  it('is not another limit that happens to carry one', () => {
    expect(isTranslationFairUse({ code: 'QUOTA_EXCEEDED', limit: 'postsPer24h' })).toBe(false)
  })

  it.each([null, undefined, 'QUOTA_EXCEEDED', new Error('offline')])(
    'is not %s, which is not a refusal from the server at all',
    (error) => {
      expect(isTranslationFairUse(error)).toBe(false)
    },
  )

  it('names a limit that really exists in the table', () => {
    expect(PLAN_LIMITS.pro).toHaveProperty(fairUseRefusal.limit)
    expect(PLAN_LIMITS.pro.translationFairUsePer24h).toBe(PLAN_LIMITS.free.translationFairUsePer24h)
  })
})

describe('who is sent on to the paywall from a refused translation', () => {
  // The tier is derived the way the app derives it (`useEffectiveTier`), from
  // what `me.entitlement` holds, so each account is the shape it really
  // arrives in rather than a hand-written `'pro'`.
  const day = 24 * 60 * 60 * 1000
  const later = new Date(Date.now() + day).toISOString()
  const earlier = new Date(Date.now() - day).toISOString()
  const offers = (stored: string, expiresAt?: string) =>
    offersPlansAtTranslationLimit(effectivePlanTier(stored, expiresAt))

  it('a free account is, because Pro removes the allowance it hit', () => {
    expect(offers('free')).toBe(true)
  })

  it.each([
    ['a paid subscription', 'pro', later],
    ['a gift, which ends on a date', 'pro', later],
    ['a lifetime plan, which never ends', 'pro', undefined],
    ['the retired tier name', 'pro_plus', later],
  ])('%s is not, because there is nothing above Pro to sell it', (_name, stored, expiresAt) => {
    expect(offers(stored, expiresAt)).toBe(false)
  })

  it('a lapsed subscription is a free account again, as everywhere else in the app', () => {
    expect(offers('pro', earlier)).toBe(true)
  })

  it('a tier this build has never heard of reads as free rather than throwing', () => {
    expect(offers('platinum')).toBe(true)
  })
})
