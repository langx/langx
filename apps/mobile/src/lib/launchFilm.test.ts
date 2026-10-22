import { describe, expect, it } from 'vitest'
import { exitDelayMs, exitWaitsForFilm } from './launchFilm'

describe('exitWaitsForFilm', () => {
  it('plays the whole film on the very first launch', () => {
    expect(exitWaitsForFilm({ seen: false, skipped: false })).toBe(true)
  })

  it('treats a flag still being read as a first launch', () => {
    expect(exitWaitsForFilm({ seen: undefined, skipped: false })).toBe(true)
  })

  it('leaves as soon as the app is ready on every later launch', () => {
    expect(exitWaitsForFilm({ seen: true, skipped: false })).toBe(false)
  })

  it('lets a tap skip the film on any launch, the first included', () => {
    expect(exitWaitsForFilm({ seen: false, skipped: true })).toBe(false)
    expect(exitWaitsForFilm({ seen: undefined, skipped: true })).toBe(false)
    expect(exitWaitsForFilm({ seen: true, skipped: true })).toBe(false)
  })
})

describe('exitDelayMs', () => {
  it('keeps the anti-flicker floor until somebody taps', () => {
    expect(exitDelayMs({ floorMs: 500, skipped: false })).toBe(500)
    expect(exitDelayMs({ floorMs: 500, skipped: true })).toBe(0)
  })
})
