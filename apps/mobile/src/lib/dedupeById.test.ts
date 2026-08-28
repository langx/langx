import { describe, expect, it } from 'vitest'
import { dedupeById } from './dedupeById'

describe('dedupeById', () => {
  it('keeps the first of a repeated id', () => {
    const items = [
      { _id: 'a', v: 1 },
      { _id: 'b', v: 2 },
      { _id: 'a', v: 3 },
    ]
    expect(dedupeById(items)).toEqual([
      { _id: 'a', v: 1 },
      { _id: 'b', v: 2 },
    ])
  })

  it('leaves a list without repeats untouched', () => {
    const items = [{ _id: 'a' }, { _id: 'b' }]
    expect(dedupeById(items)).toEqual(items)
  })

  it('handles an empty list', () => {
    expect(dedupeById([])).toEqual([])
  })
})
