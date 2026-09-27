import { describe, expect, it } from 'vitest'
import { romanizationFor } from './index'

function reading(text: string, langs?: string | string[]): string | null {
  const engine = romanizationFor(text, langs)
  return engine?.engine === 'rules' ? engine.romanize(text) : null
}

describe('romanizationFor', () => {
  it('answers null for text with nothing to romanize', () => {
    expect(romanizationFor('Hello there')).toBeNull()
    expect(romanizationFor('😀 123 !?')).toBeNull()
    expect(romanizationFor('')).toBeNull()
  })

  it('answers null for unvoweled scripts and Thai, on purpose', () => {
    expect(romanizationFor('مرحبا كيف حالك')).toBeNull()
    expect(romanizationFor('שלום מה שלומך')).toBeNull()
    expect(romanizationFor('سلام، حالت چطوره؟')).toBeNull()
    expect(romanizationFor('สวัสดีครับ')).toBeNull()
  })

  it('goes by the script with the most letters, not counting Latin', () => {
    expect(romanizationFor('I said привет')?.lang).toBe('ru')
    expect(romanizationFor('مرحبا مرحبا привет')).toBeNull()
  })

  it('runs the rule scripts on the device', () => {
    expect(romanizationFor('Καλημέρα')?.engine).toBe('rules')
    expect(romanizationFor('Καλημέρα')?.lang).toBe('el')
    expect(romanizationFor('안녕하세요')?.lang).toBe('ko')
    expect(romanizationFor('नमस्ते')?.lang).toBe('hi')
    expect(reading('안녕 Anna!')).toBe('annyeong Anna!')
  })

  it('lets a language hint choose between Cyrillic tables', () => {
    // No letter of its own: Russian by default, Ukrainian when the hint says so.
    expect(reading('Добрий ранок')).toBe('Dobriy ranok')
    expect(reading('Добрий ранок', ['uk'])).toBe('Dobryi ranok')
    expect(romanizationFor('добро', [undefined, 'bg', 'ru'])?.lang).toBe('bg')
  })

  it('ignores a hint the letters contradict', () => {
    expect(romanizationFor('Київ', 'ru')?.lang).toBe('uk')
  })

  it('gives no reading for Cyrillic none of the five tables covers', () => {
    expect(romanizationFor('қазақ тілі', 'kk')).toBeNull()
  })

  it('sends Chinese and Japanese to the service', () => {
    expect(romanizationFor('こんにちは')).toEqual({ engine: 'service', lang: 'ja' })
    expect(romanizationFor('日本語を勉強しています')).toEqual({ engine: 'service', lang: 'ja' })
    expect(romanizationFor('你好')).toEqual({ engine: 'service', lang: 'zh' })
    // Han alone could be either; the people in the conversation decide.
    expect(romanizationFor('中文', ['es', 'ja'])).toEqual({ engine: 'service', lang: 'ja' })
  })
})
