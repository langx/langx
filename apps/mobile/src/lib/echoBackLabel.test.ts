import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { echoBackLabel } from './echoBackLabel'

const t = createTranslate('en')
const names = (code: string) => ({ en: 'English', es: 'Spanish' })[code] ?? code

describe('echoBackLabel', () => {
  it('calls an ordinary back what it is: the meaning', () => {
    expect(echoBackLabel(t, names, undefined)).toBe('What it means')
  })

  it('names the language of a back in a language being learned', () => {
    // Sofia's own "¡Jaja! Me pasa siempre.", its back the English for it.
    expect(echoBackLabel(t, names, 'en')).toBe('How to say it in English')
  })
})
