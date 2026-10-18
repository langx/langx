import { beforeEach, describe, expect, it } from 'vitest'
import { latchV3Home, resetV3HomeLatch } from './v3Home'

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
