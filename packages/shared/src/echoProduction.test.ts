import { describe, expect, it } from 'vitest'
import {
  asksProduction,
  backAddsMeaning,
  ECHO_PRODUCTION_MAX_LENGTH,
  productionVerdict,
} from './echoProduction'
import { newCardSrs, type EchoSrs } from './srs'

const NOW = new Date('2026-09-14T12:00:00Z')

function reviewing(overrides: Partial<EchoSrs> = {}): EchoSrs {
  return { ...newCardSrs(NOW), state: 'review', interval: 10, reps: 2, ...overrides }
}

describe('when a review asks for the sentence', () => {
  it('never while the card is still being learned', () => {
    // Ninety seconds after meeting it is not a test, it is a setup.
    expect(asksProduction(newCardSrs(NOW), 'bonjour', 'hello')).toBe(false)
    expect(asksProduction(reviewing({ state: 'learning' }), 'bonjour', 'hello')).toBe(false)
  })

  it('never for a sentence too long to type on a phone', () => {
    const long = 'a'.repeat(ECHO_PRODUCTION_MAX_LENGTH + 1)
    expect(asksProduction(reviewing(), long, 'hello')).toBe(false)
    expect(asksProduction(reviewing(), 'a'.repeat(ECHO_PRODUCTION_MAX_LENGTH), 'hello')).toBe(true)
  })

  it('alternates, so recognition stays in the rotation', () => {
    expect(asksProduction(reviewing({ reps: 2 }), 'bonjour', 'hello')).toBe(true)
    expect(asksProduction(reviewing({ reps: 3 }), 'bonjour', 'hello')).toBe(false)
    expect(asksProduction(reviewing({ reps: 4 }), 'bonjour', 'hello')).toBe(true)
  })

  it('answers the same way twice for the same card', () => {
    // Leaving a session and coming back must not change what it asks.
    const card = reviewing()
    expect(asksProduction(card, 'bonjour', 'hello')).toBe(asksProduction(card, 'bonjour', 'hello'))
  })

  it('never when the back is not a meaning to write from', () => {
    // The back is the prompt: the sentence again would show the answer.
    expect(asksProduction(reviewing(), 'Merhaba!', 'merhaba')).toBe(false)
    expect(asksProduction(reviewing(), 'Merhaba!', '')).toBe(false)
  })

  it('never for a card whose back is in the language being learned', () => {
    // Typing writes the front, and here the front is the reader's own language.
    expect(asksProduction(reviewing(), 'Görüşürüz', 'See you', 'en')).toBe(false)
    expect(asksProduction(reviewing(), 'Görüşürüz', 'See you')).toBe(true)
  })
})

describe('whether a back says anything the front does not', () => {
  it('is a meaning when it is another sentence', () => {
    expect(backAddsMeaning('Nasılsın?', 'How are you?')).toBe(true)
  })

  it('is not when it is empty', () => {
    expect(backAddsMeaning('Nasılsın?', '')).toBe(false)
    expect(backAddsMeaning('Nasılsın?', '   ')).toBe(false)
  })

  it('is not when it is the front again, as an identity translation returns it', () => {
    expect(backAddsMeaning('Nasılsın?', 'Nasılsın?')).toBe(false)
    // Case, punctuation, spacing and accents are not a translation.
    expect(backAddsMeaning('Nasılsın?', ' nasilsin ')).toBe(false)
    expect(backAddsMeaning('Ça va ?', 'ca va')).toBe(false)
  })
})

describe('how close the answer was', () => {
  it('knows an exact answer', () => {
    expect(productionVerdict('Ça va ?', 'Ça va ?')).toBe('exact')
  })

  it('forgives what a phone keyboard makes hard', () => {
    // Diacritics, case, punctuation and spacing. Somebody who writes "ca va"
    // has produced the sentence.
    expect(productionVerdict('ca va', 'Ça va ?')).toBe('close')
    expect(productionVerdict('  ÇA  VA  ', 'Ça va ?')).toBe('close')
    expect(productionVerdict('n’ai', "n'ai")).toBe('close')
  })

  it('does not forgive a different word', () => {
    expect(productionVerdict('bonsoir', 'bonjour')).toBe('wrong')
    expect(productionVerdict('', 'bonjour')).toBe('wrong')
    expect(productionVerdict('   ', 'bonjour')).toBe('wrong')
  })

  it('leaves scripts with nothing to decompose alone', () => {
    expect(productionVerdict('خبز', 'خبز')).toBe('exact')
    expect(productionVerdict('хлеб', 'Хлеб')).toBe('close')
    expect(productionVerdict('хлеба', 'хлеб')).toBe('wrong')
  })

  it('forgives what an Arabic or Turkish keyboard makes hard', () => {
    // Vowel marks and hamza seats, which most learners do not type.
    expect(productionVerdict('انا هنا', 'أَنَا هُنَا')).toBe('close')
    expect(productionVerdict('سيارة جديدة', 'سيّارةٌ جديدةٌ')).toBe('close')
    // Final ta marbuta written as ha, alef maqsura as ya, and a tatweel.
    expect(productionVerdict('مدرسه', 'مدرسة')).toBe('close')
    expect(productionVerdict('علي', 'على')).toBe('close')
    expect(productionVerdict('جميـل', 'جميل')).toBe('close')
    // Turkish dotless i, whichever way the keyboard or the lowercase went.
    expect(productionVerdict('isik', 'Işık')).toBe('close')
    expect(productionVerdict('istanbul', 'İstanbul')).toBe('close')
    // A different consonant is still a different word.
    expect(productionVerdict('كلب', 'قلب')).toBe('wrong')
  })

  /*
   * Japanese can be written in kana alone, and an input method offers 私 and
   * わたし for the same keys. A Japanese card passes its reading.
   */
  it('takes a Japanese sentence written in kana as close', () => {
    const front = '私は学生です。'
    const kana = 'わたしは がくせいです。'
    expect(productionVerdict('私は学生です', front, kana)).toBe('close')
    expect(productionVerdict('わたしはがくせいです', front, kana)).toBe('close')
    expect(productionVerdict('ワタシハ ガクセイデス。', front, kana)).toBe('close')
    // A voiced sound is a different word, not a diacritic to forgive.
    expect(productionVerdict('わたしはかくせいです', front, kana)).toBe('wrong')
    // And without a reading, kana is just a different string.
    expect(productionVerdict('わたしはがくせいです', front)).toBe('wrong')
  })

  /*
   * The same rule when the front itself is kana — a pack word like がくせい.
   * NFD splits が into か and a combining voicing mark, and the accent strip
   * used to drop the mark, so the unvoiced word read as close.
   */
  it('keeps a voiced sound apart when the front is kana', () => {
    expect(productionVerdict('かくせい', 'がくせい')).toBe('wrong')
    expect(productionVerdict('はん', 'ぱん')).toBe('wrong')
    expect(productionVerdict('ガクセイ', 'ガクセイ。')).toBe('close')
  })

  it('never decides the grade — it only reports', () => {
    // The four buttons belong to the person: only they know whether they knew
    // it or guessed it. This function returns a verdict and nothing else.
    const verdict: string = productionVerdict('ca va', 'Ça va ?')
    expect(['exact', 'close', 'wrong']).toContain(verdict)
  })
})
