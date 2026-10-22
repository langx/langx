import { describe, expect, it } from 'vitest'
import { STRIP_HOLD_MS, firstStripHoldPhase, holdForStrips, stripSettled } from './stripHold'

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

describe('firstStripHoldPhase', () => {
  it('may hold a list that starts on its skeleton', () => {
    expect(firstStripHoldPhase(true)).toBe('loading')
  })

  it('never holds a list drawn from the cache', () => {
    expect(firstStripHoldPhase(false)).toBe('done')
  })
})

describe('holdForStrips', () => {
  const first = { firstLoad: true, listReady: true, stripsSettled: false, capped: false }

  it('holds a list leaving its skeleton while a strip has not answered', () => {
    expect(holdForStrips(first)).toBe(true)
  })

  it('lets go when the strips answer', () => {
    expect(holdForStrips({ ...first, stripsSettled: true })).toBe(false)
  })

  it('lets go at the cap, strips or not', () => {
    expect(holdForStrips({ ...first, capped: true })).toBe(false)
  })

  it('has nothing to hold while the list itself is loading', () => {
    expect(holdForStrips({ ...first, listReady: false })).toBe(false)
  })

  it('does not re-arm once the list has been shown', () => {
    // A strip refetching under a new sort is pending again; the list stays.
    expect(holdForStrips({ ...first, firstLoad: false })).toBe(false)
  })

  it('caps the wait well under half a second', () => {
    expect(STRIP_HOLD_MS).toBeLessThanOrEqual(400)
  })
})
