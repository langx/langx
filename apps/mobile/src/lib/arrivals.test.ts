import { describe, expect, it } from 'vitest'
import { createArrivals } from './arrivals'

describe('createArrivals', () => {
  it('lets a live arrival play once', () => {
    const arrivals = createArrivals(2000)
    arrivals.note('c:abc', 1000)
    expect(arrivals.take('c:abc', 1100)).toBe(true)
    // The same row remounted after a scroll is not news.
    expect(arrivals.take('c:abc', 1200)).toBe(false)
  })

  it('never plays for a row nobody saw arrive — history, a reopen, a backfill', () => {
    expect(createArrivals().take('m1', 0)).toBe(false)
  })

  it('lapses when the row mounts too late', () => {
    const arrivals = createArrivals(2000)
    arrivals.note('m1', 0)
    expect(arrivals.take('m1', 2001)).toBe(false)
  })

  it('sweeps stale entries as new ones arrive', () => {
    const arrivals = createArrivals(2000)
    arrivals.note('old', 0)
    arrivals.note('new', 5000)
    expect(arrivals.take('old', 0)).toBe(false)
    expect(arrivals.take('new', 5001)).toBe(true)
  })
})
