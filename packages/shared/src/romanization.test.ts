import { describe, expect, it } from 'vitest'
import { needsRomanization } from './romanization'

describe('needsRomanization', () => {
  it('is true for scripts of a supported language', () => {
    expect(needsRomanization('Привет, как дела?')).toBe(true)
    expect(needsRomanization('مرحبا')).toBe(true)
    expect(needsRomanization('नमस्ते')).toBe(true)
    expect(needsRomanization('こんにちは世界')).toBe(true)
    expect(needsRomanization('ok спасибо')).toBe(true)
  })

  it('is false for Latin text and for scripts Google does not romanize', () => {
    expect(needsRomanization('hello there')).toBe(false)
    expect(needsRomanization('Merhaba, nasılsın?')).toBe(false)
    expect(needsRomanization('你好')).toBe(false)
    expect(needsRomanization('안녕하세요')).toBe(false)
    expect(needsRomanization('Γεια σου')).toBe(false)
  })

  it('ignores digits and punctuation from a supported script', () => {
    expect(needsRomanization('١٢٣ ،')).toBe(false)
    expect(needsRomanization('')).toBe(false)
  })
})
