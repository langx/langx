import { SUPPORTED_LOCALES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate, type TranslateFn } from '../i18n/runtime'
import {
  formatTokenCount,
  joinSentences,
  markAmount,
  plain,
  splitTokenMarks,
  TOKEN_MARK,
  tokenAmountLabel,
  tokenIconMetrics,
  tokenIconSide,
  tokenSentence,
  tokenSlot,
} from './tokenAmount'

describe('tokenAmountLabel', () => {
  const en = createTranslate('en')

  it('says the unit the icon stands for, in the plural the count needs', () => {
    expect(tokenAmountLabel(en, 1, 'en')).toBe('1 token')
    expect(tokenAmountLabel(en, 23, 'en')).toBe('23 tokens')
  })

  it('groups the digits as the screen prints them', () => {
    expect(tokenAmountLabel(en, 1500, 'en')).toBe('1,500 tokens')
    expect(tokenAmountLabel(createTranslate('de'), 1500, 'de')).toBe('1.500 Token')
  })

  it('keeps the sign and picks the plural from the magnitude', () => {
    expect(tokenAmountLabel(en, 10, 'en', '+')).toBe('+10 tokens')
    expect(tokenAmountLabel(en, -1, 'en', '−')).toBe('−1 token')
  })

  it('follows each language’s own plural rule', () => {
    expect(tokenAmountLabel(createTranslate('tr'), 23, 'tr')).toBe('23 jeton')
    const ru = createTranslate('ru')
    // 21 takes Russian's "one" form and 25 its "many": different words.
    expect(tokenAmountLabel(ru, 21, 'ru').replace('21', '')).not.toBe(
      tokenAmountLabel(ru, 25, 'ru').replace('25', ''),
    )
  })

  it('never drops the unit, in any locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const label = tokenAmountLabel(createTranslate(locale), 23, locale)
      const unit = label.replace(formatTokenCount(23, locale), '').trim()
      expect(unit.length, locale).toBeGreaterThan(0)
    }
  })
})

describe('tokenIconSide', () => {
  it('puts the icon after the number in every language shipped today', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(tokenIconSide(createTranslate(locale)), locale).toBe('after')
    }
  })

  it('follows a translation that puts the unit first', () => {
    const unitFirst: TranslateFn = (_key, params) => `tokens ${String(params?.amount)}`
    expect(tokenIconSide(unitFirst)).toBe('before')
  })
})

describe('tokenSlot and tokenSentence', () => {
  const en = createTranslate('en')

  it('puts the marker after the grouped, signed number', () => {
    expect(tokenSlot(en, 1500, 'en')).toBe(`1,500${TOKEN_MARK}`)
    expect(tokenSlot(en, 10, 'en', '+')).toBe(`+10${TOKEN_MARK}`)
  })

  it('draws the sentence with the marker and says it with the word', () => {
    const { text, label } = tokenSentence(en, 'streak.repairShort', {
      count: 600,
      locale: 'en',
      spokenKey: 'streak.repairButton',
    })
    expect(text).toBe(`Buy a day back · 600${TOKEN_MARK}`)
    expect(label).toBe('Buy a day back · 600 tokens')
  })

  it('fills its own key with the words when there is no spoken twin', () => {
    const { text, label } = tokenSentence(en, 'storeHome.youHave', { count: 1, locale: 'en' })
    expect(text).toBe(`You have 1${TOKEN_MARK}`)
    expect(label).toBe('You have 1 token')
  })

  it('takes the placeholder a key names', () => {
    const { text, label } = tokenSentence(en, 'chat.stickerUnlock', {
      count: 1200,
      locale: 'en',
      slot: 'price',
      spokenKey: 'chat.stickerBuy',
    })
    expect(text).toBe(`Unlock for 1,200${TOKEN_MARK}`)
    expect(label).toBe('Unlock for 1,200 tokens')
  })

  it('keeps every new icon sentence speaking the unit in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const t = createTranslate(locale)
      const pairs = [
        tokenSentence(t, 'streak.protectShort', {
          count: 200,
          locale,
          spokenKey: 'streak.protectA11y',
        }),
        tokenSentence(t, 'storeHome.moreNeeded', {
          count: 25,
          locale,
          spokenKey: 'storeHome.moreTokens',
        }),
        tokenSentence(t, 'wallet.nextRungShort', {
          count: 25,
          locale,
          params: { title: 'Aurora' },
          spokenKey: 'wallet.nextRung',
        }),
        tokenSentence(t, 'leaderboard.paysShort', {
          count: 50,
          locale,
          spokenKey: 'leaderboard.pays',
        }),
      ]
      for (const { text, label } of pairs) {
        expect(text, locale).toContain(TOKEN_MARK)
        expect(label, locale).not.toContain(TOKEN_MARK)
        expect(label.length, locale).toBeGreaterThan(text.length - 1)
      }
    }
  })
})

describe('markAmount and splitTokenMarks', () => {
  const en = createTranslate('en')

  it('marks the first amount in a sentence another key printed', () => {
    expect(markAmount(en, '+15 for both', '+15')).toBe(`+15${TOKEN_MARK} for both`)
    expect(markAmount(en, 'ikinize de +15', '+15')).toBe(`ikinize de +15${TOKEN_MARK}`)
  })

  it('leaves a sentence without the amount alone', () => {
    expect(markAmount(en, 'nothing here', '+15')).toBe('nothing here')
  })

  it('cuts a sentence into text, icon, text', () => {
    expect(splitTokenMarks(`Protect · 200${TOKEN_MARK}`)).toEqual(['Protect · 200', ''])
    expect(splitTokenMarks('no icon')).toEqual(['no icon'])
  })
})

describe('joinSentences', () => {
  it('joins the drawn and the said halves, skipping what is absent', () => {
    expect(
      joinSentences(
        [plain('9 of 10'), null, { text: `Pays 50${TOKEN_MARK}`, label: 'Pays 50 tokens' }],
        ' · ',
      ),
    ).toEqual({ text: `9 of 10 · Pays 50${TOKEN_MARK}`, label: '9 of 10 · Pays 50 tokens' })
  })
})

describe('tokenIconMetrics', () => {
  it('runs a full em at text sizes and 0.85em at display sizes', () => {
    expect(tokenIconMetrics(12).size).toBe(12)
    expect(tokenIconMetrics(16)).toEqual({ size: 16, gap: 2, drop: 2 })
    expect(tokenIconMetrics(76).size).toBe(65)
  })
})
