import { describe, expect, it } from 'vitest'
import { dropIndex, makeRoom, slotOffset } from './dragReorder'

/** Three rows of different heights, the way wrapped level chips leave them. */
const heights = [100, 60, 80]

describe('dragging a row to a new place', () => {
  it('stays put until it passes half of a neighbour', () => {
    expect(dropIndex(heights, 0, 0)).toBe(0)
    // The first row's centre is at 50; the second's is at 130.
    expect(dropIndex(heights, 0, 79)).toBe(0)
    expect(dropIndex(heights, 0, 81)).toBe(1)
  })

  it('can cross more than one row in a single drag', () => {
    expect(dropIndex(heights, 0, 500)).toBe(2)
    expect(dropIndex(heights, 2, -500)).toBe(0)
  })

  it('moves the rows in between by the height of the one being dragged', () => {
    expect(makeRoom(heights, 1, 0, 2)).toBe(-100)
    expect(makeRoom(heights, 2, 0, 2)).toBe(-100)
    expect(makeRoom(heights, 0, 2, 0)).toBe(80)
    expect(makeRoom(heights, 2, 0, 1)).toBe(0)
    expect(makeRoom(heights, 0, 0, 2)).toBe(0)
  })

  it('comes to rest exactly on the slot it was dropped on', () => {
    expect(slotOffset(heights, 0, 0)).toBe(0)
    expect(slotOffset(heights, 0, 2)).toBe(140)
    expect(slotOffset(heights, 2, 0)).toBe(-160)
    expect(slotOffset(heights, 1, 0)).toBe(-100)
  })
})
