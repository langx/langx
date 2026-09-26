import { describe, expect, it } from 'vitest'
import { NORMAL_PLAYBACK_RATE, PLAYBACK_RATES, nextPlaybackRate } from './playbackRate'

describe('playback rates', () => {
  /**
   * `expo-audio` clamps to 0.1–2.0 on Android and 0.0–2.0 on iOS, silently. A
   * rate outside that range would not throw — it would just play at a speed
   * nobody chose, on one platform only.
   */
  it('stays inside the range every platform accepts', () => {
    for (const rate of PLAYBACK_RATES) {
      expect(rate).toBeGreaterThanOrEqual(0.1)
      expect(rate).toBeLessThanOrEqual(2)
    }
  })

  it('is slow enough to be worth a control and not so slow the sentence dissolves', () => {
    const slowest = Math.min(...PLAYBACK_RATES)
    expect(slowest).toBeLessThan(NORMAL_PLAYBACK_RATE)
    expect(slowest).toBeGreaterThanOrEqual(0.4)
  })

  it('returns to true normal speed, not something near it', () => {
    expect(NORMAL_PLAYBACK_RATE).toBe(1)
    expect(PLAYBACK_RATES).toContain(NORMAL_PLAYBACK_RATE)
  })

  it('is listed slowest first, with no speed twice', () => {
    expect([...PLAYBACK_RATES]).toEqual([...new Set(PLAYBACK_RATES)].sort((a, b) => a - b))
  })
})

describe('nextPlaybackRate', () => {
  it('slows a note down on the first tap, as the old toggle did', () => {
    expect(nextPlaybackRate(NORMAL_PLAYBACK_RATE)).toBe(0.5)
  })

  it('goes from the slowest round to the fastest', () => {
    expect(nextPlaybackRate(0.5)).toBe(1.5)
  })

  it('comes back to normal from the fastest', () => {
    expect(nextPlaybackRate(1.5)).toBe(NORMAL_PLAYBACK_RATE)
  })

  it('visits every rate once before it repeats', () => {
    const seen: number[] = []
    let rate = nextPlaybackRate(NORMAL_PLAYBACK_RATE)
    for (let i = 0; i < PLAYBACK_RATES.length; i += 1) {
      seen.push(rate)
      rate = nextPlaybackRate(rate)
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([...PLAYBACK_RATES])
    expect(seen.at(-1)).toBe(NORMAL_PLAYBACK_RATE)
  })
})
