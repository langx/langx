import { describe, expect, it } from 'vitest'
import { LABEL_MARKER, splitLabel } from './splitLabel'

const withMarker = (template: string) => template.replace('{language}', LABEL_MARKER)

describe('splitLabel', () => {
  it('cuts a label that ends with its placeholder', () => {
    expect(splitLabel(withMarker('Your sentence in {language}'))).toEqual({
      before: 'Your sentence in ',
      after: '',
    })
  })

  // Turkish opens with the language, which is the case a hard-coded prefix
  // would get wrong while every English test still passed.
  it('cuts a label that opens with its placeholder', () => {
    expect(splitLabel(withMarker('{language} dilindeki c\u00fcmlen'))).toEqual({
      before: '',
      after: ' dilindeki c\u00fcmlen',
    })
  })

  it('cuts a label with the placeholder in the middle', () => {
    expect(splitLabel(withMarker('Say {language} out loud'))).toEqual({
      before: 'Say ',
      after: ' out loud',
    })
  })

  it('gives back nothing when a translation dropped the placeholder', () => {
    expect(splitLabel('Your sentence')).toBeNull()
  })
})
