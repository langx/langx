import { describe, expect, it } from 'vitest'
import { createShakeGate, giftState, giftTickDelay, isShake } from './gift'

const now = new Date('2026-09-05T12:00:00.000Z')
const at = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString()

describe('giftState', () => {
  it('is ready when the wallet says nothing is pending', () => {
    expect(giftState(null, now)).toEqual({ ready: true })
    expect(giftState(undefined, now)).toEqual({ ready: true })
  })

  it('is ready once the time has passed', () => {
    expect(giftState(at(0), now)).toEqual({ ready: true })
    expect(giftState(at(-1), now)).toEqual({ ready: true })
  })

  it('rounds the wait up to whole minutes', () => {
    expect(giftState(at(61_000), now)).toMatchObject({ ready: false, minutes: 2 })
    expect(giftState(at(60_000), now)).toMatchObject({ ready: false, minutes: 1 })
    expect(giftState(at(59_000), now)).toMatchObject({ ready: false, minutes: 1 })
  })

  it('never says zero minutes while it is not ready', () => {
    expect(giftState(at(500), now)).toMatchObject({ ready: false, minutes: 1 })
  })

  it('treats garbage as ready rather than as a countdown to nowhere', () => {
    expect(giftState('not a date', now)).toEqual({ ready: true })
  })
})

describe('giftTickDelay', () => {
  it('waits until the next whole minute boundary', () => {
    expect(giftTickDelay(61_000)).toBe(1000)
    expect(giftTickDelay(120_000)).toBe(60_000)
    expect(giftTickDelay(59_500)).toBe(59_500)
  })
})

const still = { x: 0, y: 0, z: 1 }
const jolt = { x: 3, y: 0, z: 1 }

describe('isShake', () => {
  it('ignores a phone lying still', () => {
    expect(isShake([still, still, still, still])).toBe(false)
  })

  it('ignores a single knock', () => {
    expect(isShake([still, jolt, still, still])).toBe(false)
  })

  it('counts two big samples as a shake', () => {
    expect(isShake([still, jolt, still, jolt])).toBe(true)
  })

  it('measures beyond gravity, whichever way the phone is held', () => {
    // Upside down and still: magnitude is still 1 g, so nothing beyond it.
    expect(
      isShake([
        { x: 0, y: 0, z: -1 },
        { x: 0, y: -1, z: 0 },
      ]),
    ).toBe(false)
  })
})

describe('createShakeGate', () => {
  it('fires once for a burst and stays quiet through the debounce', () => {
    const gate = createShakeGate({ debounceMs: 1000 })
    expect(gate(still, 0)).toBe(false)
    expect(gate(jolt, 100)).toBe(false)
    expect(gate(jolt, 200)).toBe(true)
    // Still shaking, still inside the debounce: nothing.
    expect(gate(jolt, 300)).toBe(false)
    expect(gate(jolt, 400)).toBe(false)
    // After the quiet time a fresh burst fires again.
    expect(gate(jolt, 1500)).toBe(false)
    expect(gate(jolt, 1600)).toBe(true)
  })

  it('forgets samples that fall out of the window', () => {
    const gate = createShakeGate({ windowSize: 3 })
    expect(gate(jolt, 0)).toBe(false)
    expect(gate(still, 100)).toBe(false)
    expect(gate(still, 200)).toBe(false)
    // The jolt has left the window, so this one is alone.
    expect(gate(jolt, 300)).toBe(false)
  })
})
