import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { proWelcomeCopy } from './proWelcome'

describe('proWelcomeCopy', () => {
  const en = createTranslate('en')
  const title = (welcome: { source: string; months?: number }, t = en) => {
    const line = proWelcomeCopy(welcome).title
    return t(line.key, line.params)
  }

  it('titles each source its own way', () => {
    expect(title({ source: 'purchase' })).toBe('You’re Pro now')
    expect(title({ source: 'trial' })).toBe('Your free Pro week has started')
    expect(title({ source: 'gift', months: 3 })).toBe('3 months of Pro, on us 🎁')
    expect(title({ source: 'referral', months: 1 })).toBe('Your invites earned you 1 month of Pro')
    expect(title({ source: 'streak', months: 3 })).toBe('Your streak earned you 3 months of Pro')
    expect(title({ source: 'merge' })).toBe('Fluent and Polyglot are now one plan: Pro')
  })

  it('says a grant of no known length as a plain gift', () => {
    expect(title({ source: 'gift' })).toBe('Pro, on us 🎁')
    expect(title({ source: 'streak', months: 0 })).toBe('Pro, on us 🎁')
  })

  it('falls back to the generic title for a reason this build does not know', () => {
    expect(title({ source: 'something-new' })).toBe('You’re Pro now')
  })

  it('gives the merge its own body', () => {
    expect(proWelcomeCopy({ source: 'merge' }).body.key).toBe('proWelcome.bodyMerge')
    expect(proWelcomeCopy({ source: 'purchase' }).body.key).toBe('proWelcome.body')
  })

  it('inflects the months in the languages that split hardest', () => {
    const ru = createTranslate('ru')
    expect(title({ source: 'gift', months: 1 }, ru)).toBe('1 месяц Pro в подарок 🎁')
    expect(title({ source: 'gift', months: 3 }, ru)).toBe('3 месяца Pro в подарок 🎁')
    expect(title({ source: 'gift', months: 6 }, ru)).toBe('6 месяцев Pro в подарок 🎁')
    const ar = createTranslate('ar')
    expect(title({ source: 'gift', months: 1 }, ar)).toBe('شهر من Pro هدية منّا 🎁')
    expect(title({ source: 'gift', months: 3 }, ar)).toBe('3 أشهر من Pro هدية منّا 🎁')
  })
})
