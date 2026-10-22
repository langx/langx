import { describe, expect, it } from 'vitest'
import { exitDelayMs, exitWaitsForFilm } from './launchFilm'
import { canExit } from './splashTiming'

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
  it('holds the reduced-motion mark for the floor on the first launch', () => {
    expect(exitDelayMs({ floorMs: 500, skipped: false, seen: false })).toBe(500)
  })

  it('treats a flag still being read as a first launch', () => {
    expect(exitDelayMs({ floorMs: 500, skipped: false, seen: undefined })).toBe(500)
  })

  it('has no floor on any later launch', () => {
    expect(exitDelayMs({ floorMs: 500, skipped: false, seen: true })).toBe(0)
  })

  it('drops the floor for a tap', () => {
    expect(exitDelayMs({ floorMs: 500, skipped: true, seen: false })).toBe(0)
    expect(exitDelayMs({ floorMs: 500, skipped: true, seen: undefined })).toBe(0)
  })
})

/**
 * The two rules together, as `AppSplash` combines them: the film is over when
 * it has played out or no longer has to be waited for, and the layer leaves
 * when that and readiness both hold.
 */
describe('the opening with motion on', () => {
  const leaves = (o: {
    seen: boolean | undefined
    skipped: boolean
    played: boolean
    ready: boolean
  }) =>
    canExit({
      ready: o.ready,
      introDone: o.played || !exitWaitsForFilm({ seen: o.seen, skipped: o.skipped }),
      reduceMotion: false,
    })

  /** Not a blank screen: the layer, and the film under it, stay until there is an app. */
  it('keeps the film up after a tap that came before the app was ready', () => {
    expect(leaves({ seen: false, skipped: true, played: false, ready: false })).toBe(false)
  })

  it('leaves the moment the app is ready after an early tap', () => {
    expect(leaves({ seen: false, skipped: true, played: false, ready: true })).toBe(true)
  })

  it('leaves at once for a tap once the app is ready', () => {
    expect(leaves({ seen: false, skipped: false, played: false, ready: true })).toBe(false)
    expect(leaves({ seen: false, skipped: true, played: false, ready: true })).toBe(true)
  })

  it('never waits for the film on a later launch', () => {
    expect(leaves({ seen: true, skipped: false, played: false, ready: true })).toBe(true)
  })

  it('plays the first launch out even when the app is ready early', () => {
    expect(leaves({ seen: false, skipped: false, played: false, ready: true })).toBe(false)
    expect(leaves({ seen: false, skipped: false, played: true, ready: true })).toBe(true)
  })
})
