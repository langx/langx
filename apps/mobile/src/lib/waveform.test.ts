import { describe, expect, it } from 'vitest'
import { WAVEFORM_BARS, WAVEFORM_PEAK } from '@langx/shared'
import {
  WAVEFORM_BAR_GAP,
  WAVEFORM_BAR_WIDTH,
  playedBarCount,
  seekFraction,
  waveformBarCount,
  waveformBars,
} from './waveform'

describe('waveformBarCount', () => {
  it('fits whole bars, the last with no gap after it', () => {
    const step = WAVEFORM_BAR_WIDTH + WAVEFORM_BAR_GAP
    expect(waveformBarCount(step * 10 - WAVEFORM_BAR_GAP)).toBe(10)
    expect(waveformBarCount(step * 10 - WAVEFORM_BAR_GAP - 1)).toBe(9)
  })

  it('draws nothing before the row has been measured', () => {
    expect(waveformBarCount(0)).toBe(0)
  })
})

describe('waveformBars', () => {
  it('draws the stored values as heights when the counts match', () => {
    expect(waveformBars([WAVEFORM_PEAK, 50, 100], 3)).toEqual([1, 0.5, 1])
  })

  // Squeezed into fewer bars, a short loud syllable must not average away.
  it('keeps the loudest value each bar covers when there are fewer bars', () => {
    expect(waveformBars([20, 100, 20, 20, 40, 20], 3)).toEqual([1, 0.2, 0.4])
  })

  it('repeats values when there are more bars than data', () => {
    expect(waveformBars([100, 50], 4)).toEqual([1, 1, 0.5, 0.5])
  })

  it('always resamples the stored length to the drawn one', () => {
    const stored = Array.from({ length: WAVEFORM_BARS }, (_, i) => (i * 7) % WAVEFORM_PEAK)
    for (const count of [1, 17, WAVEFORM_BARS, 90]) {
      const bars = waveformBars(stored, count)
      expect(bars).toHaveLength(count)
      expect(bars.every((bar) => bar > 0 && bar <= 1)).toBe(true)
    }
  })

  it('still draws silence as a dot', () => {
    const [bar = 0] = waveformBars([0], 1)
    expect(bar).toBeGreaterThan(0)
  })

  // Every note sent before the server read one, and every Echo recording.
  it('draws even bars for a note with no waveform', () => {
    const bars = waveformBars(undefined, 5)
    expect(bars).toHaveLength(5)
    expect(new Set(bars).size).toBe(1)
    expect(waveformBars([], 3)).toHaveLength(3)
  })

  it('draws nothing for no room', () => {
    expect(waveformBars([50], 0)).toEqual([])
  })
})

describe('playedBarCount', () => {
  it('colours the bars the playhead has passed', () => {
    expect(playedBarCount(0, 40)).toBe(0)
    expect(playedBarCount(0.5, 40)).toBe(20)
    expect(playedBarCount(1, 40)).toBe(40)
  })

  it('colours none for a note of unknown length', () => {
    expect(playedBarCount(null, 40)).toBe(0)
  })
})

describe('seekFraction', () => {
  it('maps a touch to a share of the note', () => {
    expect(seekFraction(50, 200)).toBe(0.25)
  })

  // A drag runs past the ends; it holds there rather than seeking outside.
  it('holds at either end', () => {
    expect(seekFraction(-30, 200)).toBe(0)
    expect(seekFraction(260, 200)).toBe(1)
    expect(seekFraction(10, 0)).toBe(0)
  })
})
