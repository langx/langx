import { describe, expect, it } from 'vitest'
import { asksProduction, ECHO_PRODUCTION_MAX_LENGTH, productionVerdict } from './echoProduction'
import { newCardSrs, type EchoSrs } from './srs'

const NOW = new Date('2026-09-14T12:00:00Z')

function reviewing(overrides: Partial<EchoSrs> = {}): EchoSrs {
  return { ...newCardSrs(NOW), state: 'review', interval: 10, reps: 2, ...overrides }
}

describe('when a review asks for the sentence', () => {
  it('never while the card is still being learned', () => {
    // Ninety seconds after meeting it is not a test, it is a setup.
    expect(asksProduction(newCardSrs(NOW), 'bonjour')).toBe(false)
    expect(asksProduction(reviewing({ state: 'learning' }), 'bonjour')).toBe(false)
  })

  it('never for a sentence too long to type on a phone', () => {
    const long = 'a'.repeat(ECHO_PRODUCTION_MAX_LENGTH + 1)
    expect(asksProduction(reviewing(), long)).toBe(false)
    expect(asksProduction(reviewing(), 'a'.repeat(ECHO_PRODUCTION_MAX_LENGTH))).toBe(true)
  })

  it('alternates, so recognition stays in the rotation', () => {
    expect(asksProduction(reviewing({ reps: 2 }), 'bonjour')).toBe(true)
    expect(asksProduction(reviewing({ reps: 3 }), 'bonjour')).toBe(false)
    expect(asksProduction(reviewing({ reps: 4 }), 'bonjour')).toBe(true)
  })

  it('answers the same way twice for the same card', () => {
    // Leaving a session and coming back must not change what it asks.
    const card = reviewing()
    expect(asksProduction(card, 'bonjour')).toBe(asksProduction(card, 'bonjour'))
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

  it('never decides the grade — it only reports', () => {
    // The four buttons belong to the person: only they know whether they knew
    // it or guessed it. This function returns a verdict and nothing else.
    const verdict: string = productionVerdict('ca va', 'Ça va ?')
    expect(['exact', 'close', 'wrong']).toContain(verdict)
  })
})
