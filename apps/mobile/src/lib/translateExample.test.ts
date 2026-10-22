import { describe, expect, it } from 'vitest'
import { translateExampleLocales } from './translateExample'

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
