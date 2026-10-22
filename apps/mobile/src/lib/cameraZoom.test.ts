import { describe, expect, it } from 'vitest'
import {
  atZoomEdge,
  clearOfZoomEdge,
  pinchFactor,
  settleFactor,
  stepFactor,
  ZOOM,
  zoomProp,
  zoomStop,
} from './cameraZoom'

describe('pinchFactor', () => {
  it('multiplies by the spread of the fingers', () => {
    expect(pinchFactor(1, 2, 'ios')).toBe(2)
    expect(pinchFactor(2, 1.5, 'android')).toBe(3)
  })

  it('never goes under 1 or over the stop', () => {
    expect(pinchFactor(1, 0.5, 'ios')).toBe(1)
    expect(pinchFactor(8, 4, 'ios')).toBe(ZOOM.iosStop)
    expect(pinchFactor(4, 4, 'android')).toBe(zoomStop('android'))
  })

  it('comes back to where it started when the fingers do', () => {
    expect(pinchFactor(pinchFactor(2, 1.5, 'ios'), 1 / 1.5, 'ios')).toBeCloseTo(2, 12)
  })
})

describe('zoomStop', () => {
  it('is where Android’s prop reaches 1, so the picture and the buzz stop together', () => {
    expect(zoomProp(zoomStop('android'), 'android')).toBe(1)
    // Just short of the stop the picture is still moving.
    expect(zoomProp(zoomStop('android') / 1.01, 'android')).toBeLessThan(1)
  })

  it('leaves iOS short of its maximum, where the picture still follows the hand', () => {
    expect(zoomProp(zoomStop('ios'), 'ios')).toBeLessThan(1)
  })
})

describe('zoomProp', () => {
  it('is 0 when not zoomed, on both platforms', () => {
    expect(zoomProp(1, 'ios')).toBe(0)
    expect(zoomProp(1, 'android')).toBe(0)
    expect(zoomProp(0.5, 'ios')).toBe(0)
  })

  it('inverts iOS’s max ^ zoom', () => {
    for (const factor of [1.5, 2, 5, 10]) {
      const zoom = zoomProp(factor, 'ios')
      expect(ZOOM.iosMaxEstimate ** zoom).toBeCloseTo(factor, 9)
    }
    expect(zoomProp(10, 'ios')).toBeCloseTo(0.5, 9)
  })

  it('inverts Android’s zoom × max, and moves on the first step', () => {
    expect(zoomProp(2, 'android')).toBe(0.25)
    expect(zoomProp(1.01, 'android')).toBeGreaterThan(1 / ZOOM.androidMaxEstimate)
    expect(zoomProp(ZOOM.androidMaxEstimate, 'android')).toBe(1)
  })

  it('stays inside 0…1 everywhere', () => {
    for (let factor = 0; factor <= 20; factor += 0.25) {
      for (const os of ['ios', 'android'] as const) {
        const zoom = zoomProp(factor, os)
        expect(zoom).toBeGreaterThanOrEqual(0)
        expect(zoom).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('settleFactor', () => {
  it('lands a hair over 1 on 1, and leaves a real zoom alone', () => {
    expect(settleFactor(1.03)).toBe(1)
    expect(settleFactor(1.05)).toBe(1.05)
    expect(settleFactor(4)).toBe(4)
  })
})

describe('the edge buzz', () => {
  it('fires at both ends, on both platforms', () => {
    for (const os of ['ios', 'android'] as const) {
      expect(atZoomEdge(1, os)).toBe(true)
      expect(atZoomEdge(zoomStop(os), os)).toBe(true)
      expect(atZoomEdge(3, os)).toBe(false)
    }
  })

  it('re-arms only once the factor has moved 5 % off an end', () => {
    for (const os of ['ios', 'android'] as const) {
      expect(clearOfZoomEdge(1.02, os)).toBe(false)
      expect(clearOfZoomEdge(1.06, os)).toBe(true)
      expect(clearOfZoomEdge(zoomStop(os) / 1.02, os)).toBe(false)
      expect(clearOfZoomEdge(zoomStop(os) / 1.06, os)).toBe(true)
    }
  })
})

describe('stepFactor', () => {
  it('doubles and halves, clamped, for a screen reader', () => {
    expect(stepFactor(1, 1, 'ios')).toBe(2)
    expect(stepFactor(2, -1, 'ios')).toBe(1)
    expect(stepFactor(1, -1, 'android')).toBe(1)
    expect(stepFactor(8, 1, 'ios')).toBe(ZOOM.iosStop)
    expect(stepFactor(4, 1, 'android')).toBe(zoomStop('android'))
  })
})
