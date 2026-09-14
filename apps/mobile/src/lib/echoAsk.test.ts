import { describe, expect, it } from 'vitest'
import { MAX_POST_LENGTH, type LanguageCode } from '@langx/shared'
import { echoAskParams } from './echoAsk'

const LEARNING: LanguageCode[] = ['fr', 'es']

function card(front: string, lang: string) {
  return { _id: 'card1', front, lang }
}

describe('echoAskParams', () => {
  it('carries the sentence, the language and the card id', () => {
    expect(echoAskParams(card('  Bonjour  ', 'fr'), LEARNING)).toEqual({
      kind: 'pronunciation',
      draft: 'Bonjour',
      lang: 'fr',
      card: 'card1',
    })
  })

  it('refuses a sentence longer than a post may be', () => {
    expect(echoAskParams(card('a'.repeat(MAX_POST_LENGTH + 1), 'fr'), LEARNING)).toBeNull()
    expect(echoAskParams(card('a'.repeat(MAX_POST_LENGTH), 'fr'), LEARNING)).not.toBeNull()
  })

  /*
   * The case that made this a function rather than a condition in the screen:
   * the composer would have fallen back to French and posted a Russian
   * sentence under it.
   */
  it('refuses a language the person is not learning', () => {
    expect(echoAskParams(card('Привет', 'ru'), LEARNING)).toBeNull()
  })

  it('refuses an empty front, and a card with no language to post in', () => {
    expect(echoAskParams(card('   ', 'fr'), LEARNING)).toBeNull()
    expect(echoAskParams(card('Bonjour', 'fr'), [])).toBeNull()
  })
})
