import { ECHO_FRONT_MAX_LENGTH, captureEchoSchema } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { lookupWords, wordCardClientId, wordCardLang } from './wordLookup'

describe('lookupWords', () => {
  it('offers each word once, whatever its case, in the spelling first written', () => {
    expect(lookupWords('The cat saw the dog. THE END')).toEqual(['The', 'cat', 'saw', 'dog', 'END'])
  })

  it('leaves out numbers, which read the same in every language', () => {
    expect(lookupWords('I have 3 cats and 2024 plans')).toEqual([
      'I',
      'have',
      'cats',
      'and',
      'plans',
    ])
    expect(lookupWords('42 😂 !!')).toEqual([])
  })

  it('keeps a word with a digit in it', () => {
    expect(lookupWords('see you 2morrow')).toEqual(['see', 'you', '2morrow'])
  })

  it('drops a run too long to be a card, rather than cutting it', () => {
    const long = 'a'.repeat(ECHO_FRONT_MAX_LENGTH + 1)
    expect(lookupWords(`hello ${long}`)).toEqual(['hello'])
    expect(lookupWords('b'.repeat(ECHO_FRONT_MAX_LENGTH))).toHaveLength(1)
  })

  it('keeps words exactly as written, apostrophes and all', () => {
    expect(lookupWords('Don’t drink l’eau')).toEqual(['Don’t', 'drink', 'l’eau'])
  })
})

describe('wordCardClientId', () => {
  const messageId = '65f1c2a4b3e9d8f7a6b5c4d3'

  it('names the same card for the same word of the same message', () => {
    expect(wordCardClientId(messageId, 'gato')).toBe(wordCardClientId(messageId, 'gato'))
  })

  it('names different cards for different words, and for the same word elsewhere', () => {
    expect(wordCardClientId(messageId, 'gato')).not.toBe(wordCardClientId(messageId, 'perro'))
    expect(wordCardClientId(messageId, 'gato')).not.toBe(
      wordCardClientId('65f1c2a4b3e9d8f7a6b5c4d4', 'gato'),
    )
  })

  it('is an id the capture schema accepts, even for the longest word', () => {
    for (const word of ['a', 'x'.repeat(ECHO_FRONT_MAX_LENGTH), '猫']) {
      const parsed = captureEchoSchema.safeParse({
        source: {
          kind: 'manual',
          clientId: wordCardClientId(messageId, word),
          front: word,
          lang: 'es',
        },
      })
      expect(parsed.success).toBe(true)
    }
  })
})

describe('wordCardLang', () => {
  it('files the card under the partner’s written native language first', () => {
    expect(
      wordCardLang({
        partnerNativeLanguages: [{ code: 'ase' }, { code: 'es' }],
        sourceLang: 'pt',
        myLearning: [{ code: 'fr' }],
      }),
    ).toBe('es')
  })

  it('falls back to the translation’s source, then to what the reader is learning', () => {
    expect(
      wordCardLang({
        partnerNativeLanguages: [{ code: 'ase' }],
        sourceLang: 'pt',
        myLearning: [{ code: 'fr' }],
      }),
    ).toBe('pt')
    expect(
      wordCardLang({
        partnerNativeLanguages: undefined,
        sourceLang: undefined,
        myLearning: [{ code: 'fr' }],
      }),
    ).toBe('fr')
  })

  it('skips a source language the card could not be filed under', () => {
    expect(
      wordCardLang({
        partnerNativeLanguages: [],
        sourceLang: 'xx-nope',
        myLearning: [{ code: 'fr' }],
      }),
    ).toBe('fr')
  })

  it('has no answer when nothing names a language', () => {
    expect(
      wordCardLang({ partnerNativeLanguages: [], sourceLang: undefined, myLearning: [] }),
    ).toBeUndefined()
  })
})
