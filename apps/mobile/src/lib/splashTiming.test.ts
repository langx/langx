import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DISC_SIZE,
  PARTNER_OFFSET,
  PARTNER_SIZE,
  QUICK_EXIT_MS,
  RING_WIDTH,
  SPLASH_TIMING,
  STAMP_DONE_AT,
  STAMP_PRESS_AT,
  msUntilExitAllowed,
  quickRingMs,
} from './splashTiming'
import { v3 } from './theme/tokens'

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

describe('the first-launch stamp', () => {
  const T = SPLASH_TIMING

  it('holds the native frame before anything moves', () => {
    expect(T.STAMP_HOLD_MS).toBeGreaterThan(0)
  })

  it('presses only once the ring has closed', () => {
    expect(STAMP_PRESS_AT).toBe(T.STAMP_HOLD_MS + T.STAMP_RING_MS)
  })

  /** The sheet lifts with the badge on it; a partner still out would be carried off half-tucked. */
  it('has the partner discs back behind the badge before the sheet may lift', () => {
    const tucked = STAMP_PRESS_AT + T.PARTNER_OUT_MS + T.PARTNER_HOLD_MS + T.PARTNER_IN_MS
    expect(tucked).toBeLessThanOrEqual(STAMP_DONE_AT)
  })

  /** The film it replaced was 2.7 s on every launch; the stamp and its lift fit in 1.5 s. */
  it('is over in about a second and a half when the app is ready in time', () => {
    expect(STAMP_DONE_AT + T.LIFT_MS).toBeLessThanOrEqual(1500)
  })
})

describe('a later launch', () => {
  it('adds no more than 600 ms of motion to the boot', () => {
    expect(QUICK_EXIT_MS).toBeLessThanOrEqual(600)
  })

  it('lifts the sheet while the ring is still closing, not after', () => {
    expect(SPLASH_TIMING.QUICK_LIFT_DELAY_MS).toBeLessThan(SPLASH_TIMING.QUICK_RING_MS)
  })
})

describe('quickRingMs', () => {
  it('draws a ring that has not started in full', () => {
    expect(quickRingMs(0)).toBe(SPLASH_TIMING.QUICK_RING_MS)
  })

  /** A tap that catches the first launch's ring halfway finishes what is left. */
  it('finishes a ring caught halfway in what is left of the time', () => {
    expect(quickRingMs(0.5)).toBe(SPLASH_TIMING.QUICK_RING_MS / 2)
  })

  it('spends nothing on a ring that has closed', () => {
    expect(quickRingMs(1)).toBe(0)
  })

  it('clamps a value outside the ring', () => {
    expect(quickRingMs(1.2)).toBe(0)
    expect(quickRingMs(-1)).toBe(SPLASH_TIMING.QUICK_RING_MS)
    expect(quickRingMs(Number.NaN)).toBe(SPLASH_TIMING.QUICK_RING_MS)
  })
})

describe('the geometry', () => {
  /** The ring is two clipped halves; a half-pixel seam between them shows. */
  it('halves the ring into whole pixels', () => {
    expect((DISC_SIZE + RING_WIDTH) % 2).toBe(0)
  })

  /** Android 12+ masks the splash image to a 192 dp circle. */
  it('keeps the disc inside the Android splash mask', () => {
    expect(DISC_SIZE).toBeLessThan(192)
  })

  /** Tucked, a partner is hidden behind the disc; out, its centre is past the disc's edge. */
  it('hides the partners behind the disc and brings most of each out', () => {
    expect(PARTNER_SIZE).toBeLessThan(DISC_SIZE)
    const out = Math.hypot(PARTNER_OFFSET, PARTNER_OFFSET)
    expect(out).toBeGreaterThan(DISC_SIZE / 2)
  })
})

/**
 * The OS draws the native splash from `app.config.ts`; `AppSplash` draws its
 * first frame from the tokens and `DISC_SIZE`. The config cannot import
 * either (an import breaks `expo export`), so the numbers are written twice
 * and this reads the config as text to hold the copies together. A mismatch
 * is a visible jump on every cold start.
 */
describe('the native splash', () => {
  const config = readFileSync(path.join(__dirname, '..', '..', 'app.config.ts'), 'utf8')
  const block = config.slice(config.indexOf("'expo-splash-screen',"))
  const body = block.slice(0, block.indexOf(']'))

  it('draws the badge at the size the opening starts with', () => {
    expect(body).toContain(`imageWidth: ${DISC_SIZE},`)
    expect(body).toContain("image: './assets/splash/stamp.png'")
  })

  it("starts on the opening's grounds, light and dark", () => {
    expect(body).toContain(`backgroundColor: '${v3.light.colors.yellow}'`)
    expect(body).toContain(
      `dark: { image: './assets/splash/stamp.png', backgroundColor: '${v3.dark.colors.bg}' }`,
    )
  })
})
