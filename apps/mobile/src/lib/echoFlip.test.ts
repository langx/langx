import { describe, expect, it } from 'vitest'
import { faceAngle, faceOpacity, faceShown, FLIP_SWAP } from './echoFlip'

const steps = Array.from({ length: 101 }, (_, i) => i / 100)

describe('the Echo card flip', () => {
  it('shows the front until the card is edge-on, and the back from then on', () => {
    expect(faceShown(0)).toBe('front')
    expect(faceShown(FLIP_SWAP - 0.001)).toBe('front')
    expect(faceShown(FLIP_SWAP)).toBe('back')
    expect(faceShown(1)).toBe('back')
  })

  it('swaps at 90°, where both faces are edge-on', () => {
    expect(faceAngle('front', FLIP_SWAP, false)).toBe(90)
    expect(faceAngle('back', FLIP_SWAP, false)).toBe(-90)
  })

  it('starts on the front and ends on the back, both square to the reader', () => {
    expect(faceAngle('front', 0, false)).toBe(0)
    expect(faceAngle('back', 1, false)).toBe(0)
    expect(faceOpacity('front', 0, false)).toBe(1)
    expect(faceOpacity('back', 0, false)).toBe(0)
    expect(faceOpacity('front', 1, false)).toBe(0)
    expect(faceOpacity('back', 1, false)).toBe(1)
  })

  it('never lets a face be seen from behind, where its text would read mirrored', () => {
    for (const p of steps) {
      for (const face of ['front', 'back'] as const) {
        if (faceOpacity(face, p, false) > 0) {
          expect(Math.abs(faceAngle(face, p, false))).toBeLessThanOrEqual(90)
        }
      }
    }
  })

  it('shows exactly one face at every point of the turn', () => {
    for (const p of steps) {
      expect(faceOpacity('front', p, false) + faceOpacity('back', p, false)).toBe(1)
    }
  })

  it('crossfades without turning when motion is reduced', () => {
    for (const p of steps) {
      expect(faceAngle('front', p, true)).toBe(0)
      expect(faceAngle('back', p, true)).toBe(0)
      expect(faceOpacity('front', p, true) + faceOpacity('back', p, true)).toBeCloseTo(1)
    }
    expect(faceOpacity('back', 0.25, true)).toBeCloseTo(0.25)
  })
})
