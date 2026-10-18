import { beforeEach, describe, expect, it } from 'vitest'
import {
  CELEBRATION_MS,
  RAIN,
  claimCelebration,
  rainDrops,
  rainEndsAt,
  resetCelebrationsForTest,
} from './celebration'

/** Always the same value: the edges of every range. */
const always = (value: number) => () => value

describe('the celebration rain', () => {
  it('has landed by the end of the window, at its slowest', () => {
    const { delay, fall } = RAIN.celebration
    expect(delay[1] + fall[1]).toBeLessThanOrEqual(CELEBRATION_MS)
    const drops = rainDrops(40, 390, RAIN.celebration, always(0.999999))
    expect(rainEndsAt(drops)).toBeLessThanOrEqual(CELEBRATION_MS)
  })

  it('waits a beat before the first piece moves', () => {
    const drops = rainDrops(40, 390, RAIN.celebration, always(0))
    expect(Math.min(...drops.map((d) => d.delay))).toBeGreaterThan(0)
  })

  it('keeps every piece inside the width', () => {
    for (const value of [0, 0.5, 0.999999]) {
      for (const drop of rainDrops(10, 390, RAIN.celebration, always(value))) {
        expect(drop.start).toBeGreaterThanOrEqual(0)
        expect(drop.start + RAIN.celebration.size[1]).toBeLessThanOrEqual(390)
      }
    }
  })

  it('draws nothing off screen on a box narrower than a piece', () => {
    expect(rainDrops(3, 4, RAIN.celebration, always(0.5)).map((d) => d.start)).toEqual([0, 0, 0])
  })

  it('numbers the pieces so they can wrap round a short list', () => {
    expect(rainDrops(4, 390, RAIN.celebration).map((d) => d.piece)).toEqual([0, 1, 2, 3])
  })
})

describe('the Pro welcome rain', () => {
  // The values `ProWelcomeHost` had inline before the rain moved out of it.
  it('keeps the ranges it had', () => {
    const low = rainDrops(1, 390, RAIN.welcome, always(0))[0]
    const high = rainDrops(1, 390, RAIN.welcome, always(1))[0]
    expect(low).toMatchObject({ start: 0, delay: 250, fall: 1900, size: 22, spin: -150 })
    expect(high).toMatchObject({ start: 390 - 36, delay: 1150, fall: 3200, size: 36, spin: 150 })
  })
})

describe('rainEndsAt', () => {
  it('is zero with nothing falling', () => {
    expect(rainEndsAt([])).toBe(0)
  })
})

describe('claimCelebration', () => {
  beforeEach(() => resetCelebrationsForTest())

  it('celebrates an event once', () => {
    expect(claimCelebration('streak:2026-10-17')).toBe(true)
    expect(claimCelebration('streak:2026-10-17')).toBe(false)
  })

  it('keeps events apart', () => {
    expect(claimCelebration('streak:2026-10-17')).toBe(true)
    expect(claimCelebration('pair:anna:9')).toBe(true)
  })
})
