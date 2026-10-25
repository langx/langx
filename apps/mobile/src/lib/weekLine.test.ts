import { describe, expect, it } from 'vitest'
import { areaPath, linePoints, smoothPath } from './weekLine'

const box = { width: 70, height: 60, peak: 4, pad: 5 }

describe('linePoints', () => {
  it('puts each day over the centre of its column', () => {
    expect(linePoints([0, 0, 0, 0, 0, 0, 0], box).map((p) => p.x)).toEqual([
      5, 15, 25, 35, 45, 55, 65,
    ])
  })

  it('puts zero on the floor and the peak at the top, inside the padding', () => {
    const [zero, half, peak] = linePoints([0, 2, 4], { ...box, width: 30 })
    expect(zero!.y).toBe(55)
    expect(half!.y).toBe(30)
    expect(peak!.y).toBe(5)
  })

  it('draws a week of zeros flat on the floor rather than dividing by zero', () => {
    const points = linePoints([0, 0, 0], { ...box, peak: 0 })
    for (const point of points) expect(point.y).toBe(55)
  })
})

describe('smoothPath', () => {
  it('starts at the first day and ends at the last', () => {
    const d = smoothPath([
      { x: 5, y: 55 },
      { x: 15, y: 5 },
    ])
    expect(d).toBe('M5,55 C10,55 10,5 15,5')
  })

  it('keeps every control point between its segment’s two days', () => {
    const points = linePoints([0, 4, 0, 1, 3, 0, 2], box)
    const ys = [...smoothPath(points).matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((m) => Number(m[1]))
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(box.pad)
      expect(y).toBeLessThanOrEqual(box.height - box.pad)
    }
  })

  it('draws nothing for no days', () => {
    expect(smoothPath([])).toBe('')
    expect(areaPath([], 60)).toBe('')
  })
})

describe('areaPath', () => {
  it('closes the line down to the floor', () => {
    const d = areaPath(
      [
        { x: 5, y: 55 },
        { x: 15, y: 5 },
      ],
      60,
    )
    expect(d).toBe('M5,55 C10,55 10,5 15,5 L15,60 L5,60 Z')
  })
})
