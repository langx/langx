import { COPILOT_RULES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { copilotGate, copilotOffers, copilotTargetLanguage } from './copilotGate'

describe('copilotGate', () => {
  it('is off whenever the deployment says no, or says nothing', () => {
    const consented = { available: true, consented: true }
    expect(copilotGate(false, consented)).toBe('off')
    // An API that predates Copilot sends no `copilotService` at all.
    expect(copilotGate(undefined, consented)).toBe('off')
  })

  it('is off when this person may not use it, or nobody has asked yet', () => {
    expect(copilotGate(true, { available: false, consented: true })).toBe('off')
    expect(copilotGate(true, undefined)).toBe('off')
  })

  it('asks for consent before anything is sent', () => {
    expect(copilotGate(true, { available: true, consented: false })).toBe('consent')
  })

  it('is ready once both answers are yes', () => {
    expect(copilotGate(true, { available: true, consented: true })).toBe('ready')
  })

  /*
   * The whole table: the deployment's switch, then this person's answer.
   * Every "not available" reads as off, whatever the reason — the server says
   * so for the switch off or no key — and the thread draws nothing for it.
   */
  it.each([
    [false, true, true, 'off'],
    [false, true, false, 'off'],
    [true, false, true, 'off'],
    [true, false, false, 'off'],
    [true, true, false, 'consent'],
    [true, true, true, 'ready'],
  ] as const)(
    'service %s, available %s, consented %s is %s',
    (service, available, consented, gate) => {
      expect(copilotGate(service, { available, consented })).toBe(gate)
    },
  )
})

describe('copilotOffers', () => {
  it('offers both questions on a typed sentence', () => {
    expect(copilotOffers('Ich habe gestern ins Kino gegangen', false, 'de')).toEqual({
      check: true,
      sayIt: true,
    })
  })

  it('offers nothing on an empty or blank draft', () => {
    expect(copilotOffers('', false, 'de')).toEqual({ check: false, sayIt: false })
    expect(copilotOffers('   ', false, 'de')).toEqual({ check: false, sayIt: false })
  })

  it('offers nothing while correcting, whose draft starts as the other person’s words', () => {
    expect(copilotOffers('Their sentence, being corrected', true, 'de')).toEqual({
      check: false,
      sayIt: false,
    })
  })

  it('offers each question only within its own cap, trimmed as the server trims', () => {
    const sayItMax = 'a'.repeat(COPILOT_RULES.maxSayItChars)
    expect(copilotOffers(` ${sayItMax} `, false, 'de')).toEqual({ check: true, sayIt: true })
    expect(copilotOffers(`${sayItMax}a`, false, 'de')).toEqual({ check: true, sayIt: false })
    const checkMax = 'a'.repeat(COPILOT_RULES.maxCheckChars)
    expect(copilotOffers(checkMax, false, 'de').check).toBe(true)
    expect(copilotOffers(`${checkMax}a`, false, 'de').check).toBe(false)
  })

  it('offers no Say it without a language to say it in', () => {
    expect(copilotOffers('hello', false, undefined)).toEqual({ check: true, sayIt: false })
  })
})

describe('copilotTargetLanguage', () => {
  const codes = (...list: string[]) => list.map((code) => ({ code }))

  it('picks the language they learn that the other person speaks natively', () => {
    expect(copilotTargetLanguage(codes('es', 'de'), codes('de'))).toBe('de')
  })

  it('falls back to the first language they learn', () => {
    expect(copilotTargetLanguage(codes('es', 'de'), codes('ja'))).toBe('es')
    expect(copilotTargetLanguage(codes('es'), undefined)).toBe('es')
  })

  it('has none for somebody learning nothing', () => {
    expect(copilotTargetLanguage([], codes('de'))).toBeUndefined()
    expect(copilotTargetLanguage(undefined, codes('de'))).toBeUndefined()
  })
})
