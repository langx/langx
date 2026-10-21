import { describe, expect, it } from 'vitest'
import { STRIP_HOLD_MS, holdForStrips, stripSettled } from './stripHold'

describe('stripSettled', () => {
  it('waits for a query that is out', () => {
    expect(stripSettled({ enabled: true, isPending: true, fetchStatus: 'fetching' })).toBe(false)
  })

  it('is settled once the query has answered or failed', () => {
    expect(stripSettled({ enabled: true, isPending: false, fetchStatus: 'idle' })).toBe(true)
  })

  it('does not wait for a strip that was never asked for', () => {
    // A disabled query stays pending for ever.
    expect(stripSettled({ enabled: false, isPending: true, fetchStatus: 'idle' })).toBe(true)
  })

  it('does not wait for a request held back by the network', () => {
    expect(stripSettled({ enabled: true, isPending: true, fetchStatus: 'paused' })).toBe(true)
  })
})

describe('holdForStrips', () => {
  it('holds a list that has answered while a strip has not', () => {
    expect(holdForStrips({ listReady: true, stripsSettled: false, capped: false })).toBe(true)
  })

  it('lets go when the strips answer', () => {
    expect(holdForStrips({ listReady: true, stripsSettled: true, capped: false })).toBe(false)
  })

  it('lets go at the cap, strips or not', () => {
    expect(holdForStrips({ listReady: true, stripsSettled: false, capped: true })).toBe(false)
  })

  it('has nothing to hold while the list itself is loading', () => {
    expect(holdForStrips({ listReady: false, stripsSettled: false, capped: false })).toBe(false)
  })

  it('caps the wait well under half a second', () => {
    expect(STRIP_HOLD_MS).toBeLessThanOrEqual(400)
  })
})
