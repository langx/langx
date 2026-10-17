import { describe, expect, it } from 'vitest'
import { loadState, NO_NUMBER, statText } from './loadState'

const idle = { isError: false, fetchStatus: 'idle' }

describe('loadState', () => {
  it('is loading while the first request is on its way', () => {
    expect(loadState({ data: undefined, isError: false, fetchStatus: 'fetching' })).toBe('loading')
  })

  /**
   * The whole point: a number that really is zero is an answer. Checking
   * truthiness here would turn every new account's tiles into dashes.
   */
  it('treats a loaded zero, an empty list and an empty string as ready', () => {
    expect(loadState({ data: 0, ...idle })).toBe('ready')
    expect(loadState({ data: [], ...idle })).toBe('ready')
    expect(loadState({ data: '', ...idle })).toBe('ready')
    expect(loadState({ data: { pages: [] }, ...idle })).toBe('ready')
  })

  it('treats null as an answer too — the server said there is nothing', () => {
    expect(loadState({ data: null, ...idle })).toBe('ready')
  })

  it('keeps what it has when a refetch fails or pauses', () => {
    expect(loadState({ data: { n: 3 }, isError: true, fetchStatus: 'idle' })).toBe('ready')
    expect(loadState({ data: { n: 3 }, isError: false, fetchStatus: 'paused' })).toBe('ready')
  })

  it('stops pretending to load when the request failed with nothing to show', () => {
    expect(loadState({ data: undefined, isError: true, fetchStatus: 'idle' })).toBe('unavailable')
  })

  /** Offline, a query is not sent at all: it waits, and would pulse for ever. */
  it('stops pretending to load when the request is waiting for a network', () => {
    expect(loadState({ data: undefined, isError: false, fetchStatus: 'paused' })).toBe(
      'unavailable',
    )
  })

  /**
   * A query that is switched off (no handle to look up) has nothing coming:
   * calling it "loading" would be a skeleton that never leaves.
   */
  it('is not loading for a query that is switched off', () => {
    expect(loadState({ data: undefined, ...idle })).toBe('unavailable')
  })

  it('stays unavailable while a retry after a failure is in flight', () => {
    expect(loadState({ data: undefined, isError: true, fetchStatus: 'fetching' })).toBe(
      'unavailable',
    )
  })
})

describe('statText', () => {
  /** A real zero is drawn as a zero: it is what loaded data that is zero looks like. */
  it('draws a zero as 0', () => {
    expect(statText(0)).toBe('0')
  })

  it('draws a number with the formatter it is given', () => {
    expect(statText(1234, (n) => n.toLocaleString('en'))).toBe('1,234')
    expect(statText(0, (n) => `${n} cards`)).toBe('0 cards')
  })

  it('draws the dash, not a zero, for a number that is not there', () => {
    expect(statText(undefined)).toBe(NO_NUMBER)
    expect(statText(undefined, (n) => `${n} cards`)).toBe(NO_NUMBER)
  })
})
