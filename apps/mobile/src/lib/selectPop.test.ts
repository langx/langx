import { describe, expect, it } from 'vitest'
import { POP_FROM_GLYPH, POP_FROM_PILL, shouldPop } from './selectPop'

describe('shouldPop', () => {
  it('pops a choice that has just been made', () => {
    expect(shouldPop(false, true, false)).toBe(true)
  })

  it('stays still for one that was already made', () => {
    expect(shouldPop(true, true, false)).toBe(false)
  })

  it('stays still for one being let go of', () => {
    expect(shouldPop(true, false, false)).toBe(false)
  })

  it('never moves under reduce motion', () => {
    expect(shouldPop(false, true, true)).toBe(false)
  })
})

describe('pop sizes', () => {
  it('starts a pill much nearer full size than a tick', () => {
    expect(POP_FROM_PILL).toBeGreaterThan(POP_FROM_GLYPH)
    expect(POP_FROM_PILL).toBeLessThan(1)
  })
})
