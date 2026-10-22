import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { todayBreakdown } from './poolBreakdown'

describe('todayBreakdown', () => {
  it('says one of each in the singular', () => {
    expect(
      todayBreakdown(createTranslate('en'), { messages: 1, corrections: 1, distinctPartners: 1 }),
    ).toBe('1 message, 1 correction, 1 person.')
  })

  it('says many of each in the plural', () => {
    expect(
      todayBreakdown(createTranslate('en'), { messages: 6, corrections: 0, distinctPartners: 3 }),
    ).toBe('6 messages, 0 corrections, 3 people.')
  })

  it('takes the few form where Russian has one', () => {
    expect(
      todayBreakdown(createTranslate('ru'), { messages: 3, corrections: 1, distinctPartners: 5 }),
    ).toBe('3 сообщения, 1 исправление, 5 собеседников.')
  })
})
