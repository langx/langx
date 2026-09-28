import { describe, expect, it } from 'vitest'
import {
  APPROXIMATE_RADIUS_METRES,
  canShowMapPreview,
  mapPreviewShape,
  type MapPreviewEnvironment,
} from './locationMapPreview'

const READY: MapPreviewEnvironment = {
  os: 'ios',
  hasNativeMaps: true,
  appleMapsUsable: true,
  androidKeyConfigured: true,
}

describe('canShowMapPreview', () => {
  it('draws a map on iOS 17+ and on Android with a key', () => {
    expect(canShowMapPreview(READY)).toBe(true)
    expect(canShowMapPreview({ ...READY, os: 'android' })).toBe(true)
  })

  /** The store binary an over-the-air update reaches before the new build ships. */
  it('keeps the card on a binary without the native module', () => {
    expect(canShowMapPreview({ ...READY, hasNativeMaps: false })).toBe(false)
    expect(canShowMapPreview({ ...READY, os: 'android', hasNativeMaps: false })).toBe(false)
  })

  it('keeps the card below iOS 17, where the map view draws nothing', () => {
    expect(canShowMapPreview({ ...READY, appleMapsUsable: false })).toBe(false)
  })

  /** A Maps SDK without a key throws when the view initialises. */
  it('keeps the card on an Android build made without a key', () => {
    expect(canShowMapPreview({ ...READY, os: 'android', androidKeyConfigured: false })).toBe(false)
  })

  it('reads each platform only by its own fact', () => {
    expect(canShowMapPreview({ ...READY, androidKeyConfigured: false })).toBe(true)
    expect(canShowMapPreview({ ...READY, os: 'android', appleMapsUsable: false })).toBe(true)
  })

  it('never draws one on the web', () => {
    expect(canShowMapPreview({ ...READY, os: 'web' })).toBe(false)
  })
})

describe('mapPreviewShape', () => {
  it('pins an exact point', () => {
    expect(mapPreviewShape('exact')).toEqual({ zoom: 15, pin: true })
  })

  it('draws an approximate point as a circle and no pin', () => {
    const shape = mapPreviewShape('approximate')
    expect(shape.pin).toBe(false)
    expect(shape.radiusMetres).toBe(APPROXIMATE_RADIUS_METRES)
    expect(shape.zoom).toBeLessThan(mapPreviewShape('exact').zoom)
  })

  /**
   * The server rounds to two decimals, so the real point is within half a
   * step of the stored one on each axis; the circle has to reach at least the
   * farthest corner of that cell and still read as "about a kilometre".
   */
  it('is wide enough to contain the rounded-away point', () => {
    const halfStepMetres = 111_320 * 0.005
    expect(APPROXIMATE_RADIUS_METRES).toBeGreaterThanOrEqual(halfStepMetres * Math.SQRT2)
    expect(APPROXIMATE_RADIUS_METRES).toBeLessThan(1500)
  })
})
