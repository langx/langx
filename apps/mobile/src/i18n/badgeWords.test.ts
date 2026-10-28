import { SUPPORTED_LOCALES, TOKEN_RULES, type Locale } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { milestoneCounts } from './badgeWords'
import { createTranslate } from './runtime'

/**
 * The streak milestone sentences, `badgesV3.streakReward` on the Badges page
 * and `badgesV3.milestonePays` in a badge's sheet. Each carries two counts,
 * the days and the tokens, and a language that inflects a noun by its number
 * cannot word both in one plain string: Arabic read "عند 7 يومًا … +50 رمز"
 * on the first milestone, where it needs أيام and رمزًا.
 *
 * Every milestone `TOKEN_RULES` pays, and the counts where the plural rules
 * part ways, in all eight languages.
 */
const MILESTONES = Object.entries(TOKEN_RULES.streakMilestones).map(
  ([days, tokens]): [number, number] => [Number(days), tokens],
)
const COUNTS = [1, 2, 3, 11, 21, 100]
const CASES = [...MILESTONES, ...COUNTS.map((n): [number, number] => [n, n])]

function sentences(locale: Locale, days: number, tokens: number) {
  const t = createTranslate(locale)
  const counts = milestoneCounts({ t, locale }, days, tokens)
  return {
    reward: t('badgesV3.streakReward', counts),
    pays: t('badgesV3.milestonePays', counts),
  }
}

/**
 * The phrase each number takes, written out by hand rather than derived from
 * the plural rules, so the test checks the words and not the code that picks
 * them. `#` is the number as the app formats it. A milestone added to
 * `TOKEN_RULES` fails here until someone has said how it reads.
 */
const AR_DAYS: Record<number, string> = {
  1: 'يوم واحد',
  2: 'يومين',
  3: '# أيام',
  7: '# أيام',
  11: '# يومًا',
  21: '# يومًا',
  30: '# يومًا',
  100: '# يوم',
  180: '# يومًا',
  365: '# يومًا',
  730: '# يومًا',
  1095: '# يومًا',
}
const AR_TOKENS: Record<number, string> = {
  1: 'رمزًا واحدًا',
  2: 'رمزين',
  3: '+# رموز',
  11: '+# رمزًا',
  21: '+# رمزًا',
  50: '+# رمزًا',
  100: '+# رمز',
  250: '+# رمزًا',
  1000: '+# رمز',
  1500: '+# رمز',
  5000: '+# رمز',
  12000: '+# رمز',
  25000: '+# رمز',
}
const RU_DAYS: Record<number, string> = {
  1: '# день',
  2: '# дня',
  3: '# дня',
  7: '# дней',
  11: '# дней',
  21: '# день',
  30: '# дней',
  100: '# дней',
  180: '# дней',
  365: '# дней',
  730: '# дней',
  1095: '# дней',
}
const RU_TOKENS: Record<number, string> = {
  1: '+# токен',
  2: '+# токена',
  3: '+# токена',
  11: '+# токенов',
  21: '+# токен',
  50: '+# токенов',
  100: '+# токенов',
  250: '+# токенов',
  1000: '+# токенов',
  1500: '+# токенов',
  5000: '+# токенов',
  12000: '+# токенов',
  25000: '+# токенов',
}

function phrase(table: Record<number, string>, locale: Locale, n: number): string {
  const form = table[n]
  if (form === undefined) throw new Error(`No ${locale} wording written down for ${n}`)
  return form.replace('#', n.toLocaleString(locale))
}

describe('streak milestone sentences', () => {
  it.each(SUPPORTED_LOCALES)('fill in both counts in %s', (locale) => {
    for (const [days, tokens] of CASES) {
      const { reward, pays } = sentences(locale, days, tokens)
      for (const line of [reward, pays]) {
        expect(line).not.toMatch(/[{}]/)
        // Arabic says one and two in words: "يوم واحد", "رمزين".
        if (locale !== 'ar' || days > 2) expect(line).toContain(days.toLocaleString(locale))
        if (locale !== 'ar' || tokens > 2) expect(line).toContain(tokens.toLocaleString(locale))
      }
    }
  })

  it('read in English exactly as they did as one string', () => {
    for (const [days, tokens] of MILESTONES) {
      const d = days.toLocaleString('en')
      const n = tokens.toLocaleString('en')
      expect(sentences('en', days, tokens)).toEqual({
        reward: `The ${d}-day streak milestone adds +${n} tokens.`,
        pays: `The badge itself pays nothing; the ${d}-day streak milestone adds +${n} tokens.`,
      })
    }
    expect(sentences('en', 1, 1).reward).toBe('The 1-day streak milestone adds +1 token.')
  })

  it.each(CASES)('agree in Arabic with %i days and %i tokens', (days, tokens) => {
    const d = phrase(AR_DAYS, 'ar', days)
    const n = phrase(AR_TOKENS, 'ar', tokens)
    expect(sentences('ar', days, tokens)).toEqual({
      reward: `محطة السلسلة عند ${d} تضيف ${n}.`,
      pays: `الشارة نفسها لا تمنح شيئًا؛ محطة السلسلة عند ${d} تضيف ${n}.`,
    })
  })

  it.each(CASES)('agree in Russian with %i days and %i tokens', (days, tokens) => {
    const d = phrase(RU_DAYS, 'ru', days)
    const n = phrase(RU_TOKENS, 'ru', tokens)
    expect(sentences('ru', days, tokens)).toEqual({
      reward: `Рубеж серии в ${d} даёт ${n}.`,
      pays: `Сам значок ничего не даёт; рубеж серии в ${d} даёт ${n}.`,
    })
  })

  it('take the singular for one and the plural for two in the other languages', () => {
    const one: Partial<Record<Locale, string>> = {
      de: 'Der Meilenstein für eine Serie von 1 Tag bringt +1 Token.',
      fr: 'Le palier de 1 jour de série rapporte +1 jeton.',
      es: 'El hito de 1 día de racha suma +1 token.',
      'pt-BR': 'O marco de 1 dia de sequência rende +1 token.',
      tr: '1 günlük seri dönüm noktası +1 token ekler.',
    }
    const two: Partial<Record<Locale, string>> = {
      de: 'Der Meilenstein für eine Serie von 2 Tagen bringt +2 Token.',
      fr: 'Le palier de 2 jours de série rapporte +2 jetons.',
      es: 'El hito de 2 días de racha suma +2 tokens.',
      'pt-BR': 'O marco de 2 dias de sequência rende +2 tokens.',
      tr: '2 günlük seri dönüm noktası +2 token ekler.',
    }
    for (const locale of Object.keys(one) as Locale[]) {
      expect(sentences(locale, 1, 1).reward).toBe(one[locale])
      expect(sentences(locale, 2, 2).reward).toBe(two[locale])
    }
  })
})
