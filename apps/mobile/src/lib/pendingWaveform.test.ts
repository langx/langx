import { describe, expect, it } from 'vitest'
import { pendingWaveform } from './pendingWaveform'

describe('pendingWaveform', () => {
  it('gives one bar per slot, and none for no room', () => {
    expect(pendingWaveform('a', 40)).toHaveLength(40)
    expect(pendingWaveform('a', 0)).toEqual([])
    expect(pendingWaveform('a', -3)).toEqual([])
  })

  it('keeps every bar visible and inside its box', () => {
    for (const bar of pendingWaveform('mx3k-9q1', 200)) {
      expect(bar).toBeGreaterThanOrEqual(0.22)
      expect(bar).toBeLessThanOrEqual(0.9)
    }
  })

  it('is the same shape every render for the same note', () => {
    expect(pendingWaveform('mx3k-9q1', 30)).toEqual(pendingWaveform('mx3k-9q1', 30))
  })

  it('gives two notes two different shapes', () => {
    expect(pendingWaveform('mx3k-9q1', 30)).not.toEqual(pendingWaveform('mx3k-9q2', 30))
  })

  it('is not flat, so it reads as a voice rather than a progress bar', () => {
    const bars = pendingWaveform('mx3k-9q1', 30)
    expect(Math.max(...bars) - Math.min(...bars)).toBeGreaterThan(0.2)
  })
})
