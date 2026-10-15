import { describe, expect, it } from 'vitest'
import { moveItem, nearestSlot, offsetTo, shiftedIndex } from './gridReorder'

/** Five 58-point tiles, three to a row, the way a narrow phone wraps them. */
const slots = [
  { x: 0, y: 0 },
  { x: 67, y: 0 },
  { x: 134, y: 0 },
  { x: 0, y: 67 },
  { x: 67, y: 67 },
]

describe('dragging a tile in a wrapping grid', () => {
  it('stays put until it is nearer another slot than its own', () => {
    expect(nearestSlot(slots, 0, 30, 0)).toBe(0)
    expect(nearestSlot(slots, 0, 40, 0)).toBe(1)
  })

  it('crosses onto the next row', () => {
    expect(nearestSlot(slots, 2, -70, 70)).toBe(4)
    expect(nearestSlot(slots, 4, 500, -500)).toBe(2)
  })

  it('moves the tiles in between one slot towards where the dragged one left', () => {
    expect([0, 1, 2, 3, 4].map((i) => shiftedIndex(i, 0, 3))).toEqual([3, 0, 1, 2, 4])
    expect([0, 1, 2, 3, 4].map((i) => shiftedIndex(i, 4, 1))).toEqual([0, 2, 3, 4, 1])
    expect([0, 1, 2].map((i) => shiftedIndex(i, 1, 1))).toEqual([0, 1, 2])
  })

  it('steps a tile from the end of one row to the start of the next', () => {
    // Tile 2 makes room for 0 dropped on 3: it goes from the top right to
    // where 1 was, and 3 wraps back up into the corner.
    expect(offsetTo(slots, 3, shiftedIndex(3, 0, 3))).toEqual({ x: 134, y: -67 })
  })

  it('writes the order the person let go of', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c'])
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})
