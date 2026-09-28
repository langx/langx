import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SPLASH_TIMING, canExit, discDiameter, msUntilExitAllowed } from './splashTiming'

const { MIN_VISIBLE_MS } = SPLASH_TIMING

describe('msUntilExitAllowed', () => {
  /** A warm start: the session came back from a cached cookie almost at once. */
  it('holds a fast boot open for the rest of the floor', () => {
    expect(msUntilExitAllowed(1000, 1080)).toBe(MIN_VISIBLE_MS - 80)
  })

  it('lets a boot that already took longer go immediately', () => {
    expect(msUntilExitAllowed(1000, 1000 + MIN_VISIBLE_MS)).toBe(0)
    expect(msUntilExitAllowed(1000, 9999)).toBe(0)
  })

  it('never asks for a negative wait', () => {
    expect(msUntilExitAllowed(0, Number.MAX_SAFE_INTEGER)).toBe(0)
  })

  /**
   * A device whose clock is corrected during launch. Treated as "no time has
   * passed" rather than as a wait of days.
   */
  it('treats a clock that went backwards as the start of the floor', () => {
    expect(msUntilExitAllowed(5000, 1000)).toBe(MIN_VISIBLE_MS)
  })
})

describe('the reduced-motion exit', () => {
  /**
   * The ground is the only opaque thing on the layer, so a fade that starts
   * before the badge has finished leaving shows the app through the logo. The
   * two numbers are one number for that reason; this is what notices if they
   * ever stop being.
   */
  it('does not lift the ground while the badge is still on screen', () => {
    expect(SPLASH_TIMING.EXIT_GROUND_DELAY_MS).toBeGreaterThanOrEqual(SPLASH_TIMING.EXIT_TILE_MS)
  })
})

describe('discDiameter', () => {
  /**
   * The disc grows from the window's centre, so what it has to reach is the
   * farthest corner. Sized to the longer side, a phone keeps a sliver of the
   * old ground in each corner under the whole film.
   */
  it('reaches every corner of the window from its centre', () => {
    for (const [width, height] of [
      [390, 844],
      [844, 390],
      [1024, 1366],
      [1920, 1080],
      [320, 320],
    ] as const) {
      const radius = discDiameter(width, height) / 2
      expect(radius).toBeGreaterThan(Math.hypot(width / 2, height / 2))
      expect(Number.isInteger(discDiameter(width, height))).toBe(true)
    }
  })
})

describe('canExit', () => {
  it('never leaves before the app is ready', () => {
    expect(canExit({ ready: false, introDone: true, reduceMotion: false })).toBe(false)
    expect(canExit({ ready: false, introDone: true, reduceMotion: true })).toBe(false)
  })

  /** A warm start is ready long before the film is over; it still plays out. */
  it('does not cut the film short for an app that is ready early', () => {
    expect(canExit({ ready: true, introDone: false, reduceMotion: false })).toBe(false)
  })

  it('leaves once both the film and the app are done', () => {
    expect(canExit({ ready: true, introDone: true, reduceMotion: false })).toBe(true)
  })

  /** Reduced motion has no film, so there is nothing for it to wait on. */
  it('waits only for the app with reduced motion', () => {
    expect(canExit({ ready: true, introDone: false, reduceMotion: true })).toBe(true)
  })
})

describe('the film', () => {
  /**
   * `INTRO_MS` is what the stall guard is measured from, and it is written by
   * hand. A re-render that changes the film's length without it leaves the
   * guard either cutting a slow film short or holding a stalled one too long,
   * and nothing else would say so. So this reads the length out of the file.
   *
   * An MP4's `mvhd` box carries the timescale and the duration; version 0
   * stores both as 32-bit numbers, version 1 the duration as 64-bit.
   */
  it('is as long as the timing says it is', () => {
    const file = readFileSync(path.join(__dirname, '..', '..', 'assets', 'splash', 'intro.mp4'))
    const at = file.indexOf('mvhd')
    expect(at).toBeGreaterThan(0)
    const version = file.readUInt8(at + 4)
    const timescale = file.readUInt32BE(at + (version === 1 ? 24 : 16))
    const duration =
      version === 1 ? Number(file.readBigUInt64BE(at + 28)) : file.readUInt32BE(at + 20)
    expect(Math.round((duration / timescale) * 1000)).toBe(SPLASH_TIMING.INTRO_MS)
  })
})
