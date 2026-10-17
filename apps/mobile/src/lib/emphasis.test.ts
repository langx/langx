import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { emphasise, emphasisRuns } from './emphasis'

describe('emphasisRuns', () => {
  it('leaves a sentence with nothing marked as one plain run', () => {
    expect(emphasisRuns('Cancel anytime')).toEqual([{ text: 'Cancel anytime', strong: false }])
    expect(emphasisRuns('')).toEqual([])
  })

  it('finds every marked value, wherever the translation put it', () => {
    expect(emphasisRuns(`1 week free, then ${emphasise('$83.99')} ${emphasise('a year')}`)).toEqual(
      [
        { text: '1 week free, then ', strong: false },
        { text: '$83.99', strong: true },
        { text: ' ', strong: false },
        { text: 'a year', strong: true },
      ],
    )
  })

  it('reads a mark that was never closed as plain text', () => {
    expect(emphasisRuns('a \uE000b c')).toEqual([
      { text: 'a ', strong: false },
      { text: 'b c', strong: false },
    ])
  })

  /** The paywall's terms line, through the real catalogues. */
  it('survives translation in a locale that puts the period first', () => {
    const t = createTranslate('tr')
    const line = t('paywall.renewsSummary', {
      price: emphasise('₺1.799,99'),
      period: emphasise(t('paywall.perYear')),
    })
    const strong = emphasisRuns(line)
      .filter((run) => run.strong)
      .map((run) => run.text)
    expect(strong).toEqual(['yılda', '₺1.799,99'])
    expect(
      emphasisRuns(line)
        .map((run) => run.text)
        .join(''),
    ).toBe('yılda ₺1.799,99. İstediğin zaman iptal et.')
  })
})
