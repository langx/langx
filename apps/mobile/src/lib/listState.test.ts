import { describe, expect, it } from 'vitest'
import { listState, queryFailed } from './listState'

describe('listState', () => {
  it('shows a skeleton only while there is nothing for this query key yet', () => {
    expect(listState({ isPending: true, isError: false, itemCount: 0 })).toBe('skeleton')
  })

  it('shows content as soon as there are rows', () => {
    expect(listState({ isPending: false, isError: false, itemCount: 3 })).toBe('content')
  })

  /**
   * An infinite query fetching page two is not pending, but even if a caller
   * conflates the two flags the rows already on screen must not be replaced
   * by placeholders.
   */
  it('keeps showing content while another page loads', () => {
    expect(listState({ isPending: true, isError: false, itemCount: 20 })).toBe('content')
  })

  it('leaves an empty successful result to the caller`s empty state', () => {
    expect(listState({ isPending: false, isError: false, itemCount: 0 })).toBe('empty')
  })

  /** A failed refetch is pending-with-nothing; a pulse there promises data that is not coming. */
  it('does not pulse forever over an error', () => {
    expect(listState({ isPending: true, isError: true, itemCount: 0 })).toBe('failed')
  })

  /** The whole point of the variant: "it did not load" is not "there is nothing". */
  it('separates a failed request from an empty answer', () => {
    expect(listState({ isPending: false, isError: true, itemCount: 0 })).toBe('failed')
  })

  /** A query held back for want of a network is the same news, arriving earlier. */
  it('treats a paused query as failed rather than as a first load', () => {
    expect(listState({ isPending: true, isError: false, itemCount: 0, isPaused: true })).toBe(
      'failed',
    )
  })

  /** Rows already on screen outlast both. */
  it('keeps rows over an error or a pause', () => {
    expect(listState({ isPending: false, isError: true, itemCount: 4 })).toBe('content')
    expect(listState({ isPending: true, isError: false, itemCount: 4, isPaused: true })).toBe(
      'content',
    )
  })
})

describe('queryFailed', () => {
  it('is true for an error', () => {
    expect(queryFailed({ isError: true, fetchStatus: 'idle' })).toBe(true)
  })

  /** The whole reason it exists: a paused query looks like a slow one. */
  it('is true for a query waiting on a network that is not there', () => {
    expect(queryFailed({ isError: false, fetchStatus: 'paused' })).toBe(true)
  })

  it('is false while a request is actually in flight', () => {
    expect(queryFailed({ isError: false, fetchStatus: 'fetching' })).toBe(false)
  })
})
