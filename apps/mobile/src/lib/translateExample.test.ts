import { describe, expect, it } from 'vitest'
import { sentenceDirection, translateExampleLocales } from './translateExample'

describe('translateExampleLocales', () => {
  it('shows a learning language turned into the chosen one', () => {
    expect(translateExampleLocales('es', [{ code: 'ru' }])).toEqual({ from: 'ru', to: 'es' })
  })

  it('maps a base code onto its interface locale', () => {
    expect(translateExampleLocales('pt', [{ code: 'de' }])).toEqual({ from: 'de', to: 'pt-BR' })
  })

  it('draws no card for a target the app has no copy of', () => {
    expect(translateExampleLocales('ca', [{ code: 'ru' }])).toBeNull()
    expect(translateExampleLocales(undefined, [{ code: 'ru' }])).toBeNull()
  })

  it('falls back to English, then Spanish, never the target itself', () => {
    expect(translateExampleLocales('fr', [{ code: 'ja' }])).toEqual({ from: 'en', to: 'fr' })
    expect(translateExampleLocales('en', [{ code: 'en' }])).toEqual({ from: 'es', to: 'en' })
  })
})

describe('sentenceDirection', () => {
  it('sets Arabic right to left at the end of a left-to-right layout', () => {
    expect(sentenceDirection('ar', false)).toEqual({ writingDirection: 'rtl', textAlign: 'right' })
  })

  it('sets English left to right at the end of a right-to-left layout', () => {
    expect(sentenceDirection('en', true)).toEqual({ writingDirection: 'ltr', textAlign: 'right' })
  })

  it('leaves a sentence that reads the layout’s way at its start', () => {
    expect(sentenceDirection('es', false)).toEqual({ writingDirection: 'ltr', textAlign: 'left' })
    expect(sentenceDirection('ar', true)).toEqual({ writingDirection: 'rtl', textAlign: 'left' })
  })
})
