import { describe, expect, it } from 'vitest'
import {
  CAMERA_FILTER_IDS,
  CAMERA_FILTERS,
  cameraFilter,
  channels,
  concat,
  contrast,
  filterIndexAfterSwipe,
  IDENTITY,
  saturation,
  SWIPE_DISTANCE,
  SWIPE_VELOCITY,
  type ColorMatrix,
} from './cameraFilters'

/** One RGB colour through a matrix, as Skia applies it (alpha 1). */
function apply(matrix: ColorMatrix, [r, g, b]: readonly number[]): number[] {
  return [0, 1, 2].map((row) => {
    const m = matrix.slice(row * 5, row * 5 + 5)
    return m[0]! * r! + m[1]! * g! + m[2]! * b! + m[3]! * 1 + m[4]!
  })
}

const SKIN = [0.8, 0.6, 0.5] as const
const spread = (c: readonly number[]) => Math.max(...c) - Math.min(...c)

describe('matrix helpers', () => {
  it('concat with the identity changes nothing', () => {
    const vivid = saturation(1.4)
    expect(concat(IDENTITY, vivid)).toEqual(vivid)
    expect(concat(vivid, IDENTITY)).toEqual(vivid)
  })

  it('concat applies the inner matrix first', () => {
    const lift = channels([1, 1, 1], [0.1, 0.1, 0.1])
    const double = channels([2, 2, 2])
    // (0.2 + 0.1) * 2, not 0.2 * 2 + 0.1.
    expect(apply(concat(double, lift), [0.2, 0.2, 0.2])[0]).toBeCloseTo(0.6)
  })

  it('saturation 0 turns every colour to its own grey', () => {
    const [r, g, b] = apply(saturation(0), SKIN)
    expect(r).toBeCloseTo(g!)
    expect(g).toBeCloseTo(b!)
  })

  it('saturation leaves every grey as it was', () => {
    for (const m of [saturation(1.5), saturation(0)]) {
      apply(m, [1, 1, 1]).forEach((v) => expect(v).toBeCloseTo(1))
      apply(m, [0.3, 0.3, 0.3]).forEach((v) => expect(v).toBeCloseTo(0.3))
    }
  })

  it('contrast turns about mid-grey', () => {
    for (const m of [contrast(1.3), contrast(0.7)]) {
      apply(m, [0.5, 0.5, 0.5]).forEach((v) => expect(v).toBeCloseTo(0.5))
    }
    expect(apply(contrast(1.3), [0.8, 0.8, 0.8])[0]).toBeGreaterThan(0.8)
    expect(apply(contrast(0.7), [0.1, 0.1, 0.1])[0]).toBeGreaterThan(0.1)
  })
})

describe('CAMERA_FILTERS', () => {
  it('has one entry per id, Original first, and 4–5 effects besides', () => {
    expect(CAMERA_FILTERS.map((f) => f.id)).toEqual([...CAMERA_FILTER_IDS])
    expect(CAMERA_FILTERS[0]!.id).toBe('original')
    expect(CAMERA_FILTERS.length - 1).toBeGreaterThanOrEqual(4)
    expect(CAMERA_FILTERS.length - 1).toBeLessThanOrEqual(5)
  })

  it('every matrix is 4×5 of finite numbers and leaves alpha alone', () => {
    for (const { matrix } of CAMERA_FILTERS) {
      expect(matrix).toHaveLength(20)
      matrix.forEach((v) => expect(Number.isFinite(v)).toBe(true))
      expect(matrix.slice(15)).toEqual([0, 0, 0, 1, 0])
    }
  })

  it('Original is the identity and has no tint', () => {
    expect(cameraFilter('original').matrix).toEqual(IDENTITY)
    expect(cameraFilter('original').tint).toBeNull()
  })

  it('each effect leans the way its name says', () => {
    const [wr, , wb] = apply(cameraFilter('warm').matrix, [0.5, 0.5, 0.5])
    expect(wr!).toBeGreaterThan(wb!)
    const [cr, , cb] = apply(cameraFilter('cool').matrix, [0.5, 0.5, 0.5])
    expect(cb!).toBeGreaterThan(cr!)
    const [mr, mg, mb] = apply(cameraFilter('mono').matrix, SKIN)
    expect(mr).toBeCloseTo(mg!)
    expect(mg).toBeCloseTo(mb!)
    // Vivid spreads the channels apart; Film pulls them together and lifts black.
    expect(spread(apply(cameraFilter('vivid').matrix, SKIN))).toBeGreaterThan(spread(SKIN))
    expect(spread(apply(cameraFilter('film').matrix, SKIN))).toBeLessThan(spread(SKIN))
    expect(Math.min(...apply(cameraFilter('film').matrix, [0, 0, 0]))).toBeGreaterThan(0.05)
  })

  it('every effect has a viewfinder tint light enough to see through', () => {
    for (const filter of CAMERA_FILTERS.slice(1)) {
      const alpha = Number(/,\s*([\d.]+)\)$/.exec(filter.tint ?? '')?.[1])
      expect(alpha).toBeGreaterThan(0)
      expect(alpha).toBeLessThanOrEqual(0.5)
    }
  })

  it('an unknown id falls back to Original', () => {
    expect(cameraFilter('sepia' as never).id).toBe('original')
  })
})

describe('filterIndexAfterSwipe', () => {
  const base = { index: 2, count: 6, velocityX: 0 }

  it('a swipe to the left is the next filter, to the right the one before', () => {
    expect(filterIndexAfterSwipe({ ...base, translationX: -SWIPE_DISTANCE })).toBe(3)
    expect(filterIndexAfterSwipe({ ...base, translationX: SWIPE_DISTANCE })).toBe(1)
  })

  it('a short, slow drag stays put', () => {
    expect(filterIndexAfterSwipe({ ...base, translationX: -(SWIPE_DISTANCE - 1) })).toBe(2)
  })

  it('a short flick counts by its speed', () => {
    expect(filterIndexAfterSwipe({ ...base, translationX: -10, velocityX: -SWIPE_VELOCITY })).toBe(
      3,
    )
    expect(filterIndexAfterSwipe({ ...base, translationX: 10, velocityX: SWIPE_VELOCITY })).toBe(1)
  })

  it('moves one step however long the swipe', () => {
    expect(filterIndexAfterSwipe({ ...base, translationX: -900, velocityX: -5000 })).toBe(3)
  })

  it('stops at either end rather than wrapping', () => {
    expect(filterIndexAfterSwipe({ ...base, index: 5, translationX: -200 })).toBe(5)
    expect(filterIndexAfterSwipe({ ...base, index: 0, translationX: 200 })).toBe(0)
  })

  it('runs the other way in a right-to-left language', () => {
    expect(filterIndexAfterSwipe({ ...base, translationX: 200, rtl: true })).toBe(3)
    expect(filterIndexAfterSwipe({ ...base, translationX: -200, rtl: true })).toBe(1)
  })
})
