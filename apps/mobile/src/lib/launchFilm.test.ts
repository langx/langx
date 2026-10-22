import { describe, expect, it } from 'vitest'
import { exitDelayMs, exitWaitsForFilm, stampPlan } from './launchFilm'

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

describe('stampPlan', () => {
  it('plays the whole stamp on the very first launch', () => {
    expect(stampPlan({ seen: false, skipped: false, reduceMotion: false })).toBe('full')
  })

  it('treats a flag still being read as a first launch', () => {
    expect(stampPlan({ seen: undefined, skipped: false, reduceMotion: false })).toBe('full')
  })

  it('closes and lifts at once on every later launch', () => {
    expect(stampPlan({ seen: true, skipped: false, reduceMotion: false })).toBe('quick')
  })

  it('takes a tap to the quick exit on any launch', () => {
    expect(stampPlan({ seen: false, skipped: true, reduceMotion: false })).toBe('quick')
    expect(stampPlan({ seen: undefined, skipped: true, reduceMotion: false })).toBe('quick')
  })

  /** Nothing moves for somebody who asked for no motion, first launch or not, tapped or not. */
  it('holds the badge still with reduced motion', () => {
    for (const seen of [false, true, undefined]) {
      for (const skipped of [false, true]) {
        expect(stampPlan({ seen, skipped, reduceMotion: true })).toBe('still')
      }
    }
  })
})
