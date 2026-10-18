import { describe, expect, it } from 'vitest'
import { copilotGate } from './copilotGate'

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
})
