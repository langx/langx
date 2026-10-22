import { describe, expect, it } from 'vitest'
import { startEdgeOrigin } from './startEdge'

describe('startEdgeOrigin', () => {
  it('grows from the left in a left-to-right language', () => {
    expect(startEdgeOrigin(false)).toBe('left')
  })

  it('grows from the right in a right-to-left one', () => {
    expect(startEdgeOrigin(true)).toBe('right')
  })
})
