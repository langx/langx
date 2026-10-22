import { describe, expect, it } from 'vitest'
import { SHAKE_DISTANCE, SHAKE_MS, shakeSteps } from './errorShake'

describe('shakeSteps', () => {
  const steps = shakeSteps()

  it('takes the whole shake and no longer', () => {
    expect(steps.reduce((sum, step) => sum + step.ms, 0)).toBe(SHAKE_MS)
  })

  it('goes no further than the distance either way', () => {
    for (const step of steps) expect(Math.abs(step.to)).toBeLessThanOrEqual(SHAKE_DISTANCE)
  })

  it('goes both ways', () => {
    expect(steps.some((step) => step.to > 0)).toBe(true)
    expect(steps.some((step) => step.to < 0)).toBe(true)
  })

  it('comes home', () => {
    expect(steps.at(-1)?.to).toBe(0)
  })
})
