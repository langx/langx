import { describe, expect, it } from 'vitest'
import { listState } from './listState'

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
    expect(listState({ isPending: true, isError: true, itemCount: 0 })).toBe('empty')
  })
})
