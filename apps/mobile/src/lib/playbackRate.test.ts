import { describe, expect, it } from 'vitest'
import { NORMAL_PLAYBACK_RATE, SLOW_PLAYBACK_RATE } from './playbackRate'

describe('playback rates', () => {
  /**
   * `expo-audio` clamps to 0.1–2.0 on Android and 0.0–2.0 on iOS, silently. A
   * rate outside that range would not throw — it would just play at a speed
   * nobody chose, on one platform only.
   */
  it('stays inside the range every platform accepts', () => {
    for (const rate of [SLOW_PLAYBACK_RATE, NORMAL_PLAYBACK_RATE]) {
      expect(rate).toBeGreaterThanOrEqual(0.1)
      expect(rate).toBeLessThanOrEqual(2)
    }
  })

  it('is slow enough to be worth a control and not so slow the sentence dissolves', () => {
    expect(SLOW_PLAYBACK_RATE).toBeLessThan(NORMAL_PLAYBACK_RATE)
    expect(SLOW_PLAYBACK_RATE).toBeGreaterThanOrEqual(0.4)
  })

  it('returns to true normal speed, not something near it', () => {
    expect(NORMAL_PLAYBACK_RATE).toBe(1)
  })
})
