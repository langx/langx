import { beforeEach, describe, expect, it } from 'vitest'
import { V3_HOME_WAIT_MS, latchV3Home, resetV3HomeLatch, v3HomeWaitLeft } from './v3Home'

describe('latchV3Home', () => {
  beforeEach(() => resetV3HomeLatch())

  // The 3.0 TestFlight build runs the redesign whatever the server says.
  it('is v3 before the config settles and when the server flag is off', () => {
    expect(latchV3Home({ settled: false, on: false })).toBe(true)
    expect(latchV3Home({ settled: true, on: false })).toBe(true)
  })
})

describe('v3HomeWaitLeft', () => {
  beforeEach(() => resetV3HomeLatch())

  it('caps the launch’s wait for the config at about a second and a half', () => {
    expect(V3_HOME_WAIT_MS).toBeLessThanOrEqual(1_500)
    expect(v3HomeWaitLeft(10_000)).toBe(V3_HOME_WAIT_MS)
    expect(v3HomeWaitLeft(10_000 + V3_HOME_WAIT_MS - 1)).toBe(1)
    expect(v3HomeWaitLeft(10_000 + V3_HOME_WAIT_MS)).toBe(0)
    expect(v3HomeWaitLeft(10_000 + V3_HOME_WAIT_MS * 10)).toBe(0)
  })

  it('runs one clock from the first caller, not one per screen', () => {
    v3HomeWaitLeft(10_000)
    // A screen that mounts a second later has half a second left, not 1.5.
    expect(v3HomeWaitLeft(11_000)).toBe(V3_HOME_WAIT_MS - 1_000)
  })
})
