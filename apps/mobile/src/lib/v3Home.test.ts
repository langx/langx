import { beforeEach, describe, expect, it } from 'vitest'
import { V3_HOME_WAIT_MS, latchV3Home, resetV3HomeLatch, v3HomeWaitLeft } from './v3Home'

describe('latchV3Home', () => {
  beforeEach(() => resetV3HomeLatch())

  it('has no answer until the config has settled', () => {
    expect(latchV3Home({ settled: false, on: true })).toBeUndefined()
  })

  it('takes the first settled answer', () => {
    expect(latchV3Home({ settled: true, on: true })).toBe(true)
  })

  it('keeps that answer when a later refetch says otherwise', () => {
    latchV3Home({ settled: true, on: true })
    expect(latchV3Home({ settled: true, on: false })).toBe(true)
  })

  it('keeps today’s tabs for a launch whose config failed, even once it recovers', () => {
    expect(latchV3Home({ settled: true, on: false })).toBe(false)
    expect(latchV3Home({ settled: true, on: true })).toBe(false)
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

  it('decides off, for good, when the wait runs out before the config answers', () => {
    v3HomeWaitLeft(10_000)
    const over = v3HomeWaitLeft(10_000 + V3_HOME_WAIT_MS) === 0
    // A request still out has no data, so `on` is false.
    expect(latchV3Home({ settled: over, on: false })).toBe(false)
    // The slow answer arriving afterwards does not rearrange the bar.
    expect(latchV3Home({ settled: true, on: true })).toBe(false)
  })
})
