import { describe, expect, it } from 'vitest'
import { arcOffset, clampProgress, ringGeometry, stepsProgress } from './ringProgress'

describe('clampProgress', () => {
  it('keeps a fraction as it is', () => {
    expect(clampProgress(0)).toBe(0)
    expect(clampProgress(0.4)).toBe(0.4)
    expect(clampProgress(1)).toBe(1)
  })

  it('never draws more than full or less than empty', () => {
    expect(clampProgress(1.7)).toBe(1)
    expect(clampProgress(-0.2)).toBe(0)
    expect(clampProgress(Infinity)).toBe(1)
    expect(clampProgress(-Infinity)).toBe(0)
  })

  it('reads NaN as empty', () => {
    expect(clampProgress(NaN)).toBe(0)
  })
})

describe('stepsProgress', () => {
  it('is the share of the steps done', () => {
    expect(stepsProgress(1, 4)).toBe(0.25)
    expect(stepsProgress(2, 3)).toBeCloseTo(2 / 3, 10)
    expect(stepsProgress(3, 3)).toBe(1)
  })

  it('does not close a ring with nothing to do', () => {
    expect(stepsProgress(0, 0)).toBe(0)
    expect(stepsProgress(3, 0)).toBe(0)
    expect(stepsProgress(1, -2)).toBe(0)
    expect(stepsProgress(1, NaN)).toBe(0)
  })

  it('stops at full when more is done than there was to do', () => {
    expect(stepsProgress(5, 3)).toBe(1)
  })
})

describe('ringGeometry', () => {
  it('keeps the stroke inside the box', () => {
    const { centre, radius } = ringGeometry(84, 10)
    expect(centre).toBe(42)
    expect(radius).toBe(37)
    // The outer edge of the stroke lands exactly on the box.
    expect(centre + radius + 10 / 2).toBe(84)
  })

  it('measures the circumference of that circle', () => {
    expect(ringGeometry(44, 6).circumference).toBeCloseTo(2 * Math.PI * 19, 10)
  })

  it('never gives a negative radius', () => {
    expect(ringGeometry(4, 10).radius).toBe(0)
    expect(ringGeometry(4, 10).circumference).toBe(0)
  })
})

describe('arcOffset', () => {
  const circumference = 100

  it('hides the whole dash when empty and none of it when full', () => {
    expect(arcOffset(circumference, 0)).toBe(100)
    expect(arcOffset(circumference, 1)).toBe(0)
  })

  it('draws the fraction asked for', () => {
    expect(arcOffset(circumference, 0.25)).toBe(75)
  })

  it('clamps what it is given', () => {
    expect(arcOffset(circumference, 2)).toBe(0)
    expect(arcOffset(circumference, -1)).toBe(100)
    expect(arcOffset(circumference, NaN)).toBe(100)
  })
})
