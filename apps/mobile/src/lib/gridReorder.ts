/**
 * Holding a tile in a wrapping grid and dragging it to a new place.
 *
 * `dragReorder`'s sibling for the photo gallery, whose tiles wrap onto a second
 * row — so a tile moves in two directions and a neighbour making room can step
 * from the end of one row to the start of the next. Slots are measured rather
 * than computed from a column count, because the count is whatever the width
 * of the screen leaves room for.
 *
 * **Every function carries `'worklet'`**, for the reason `dragReorder.ts`
 * gives: they run on the UI thread, from the gesture's callbacks.
 */

/** Where a tile sits in the grid, from its own `onLayout`. */
export interface Slot {
  x: number
  y: number
}

/**
 * The slot the dragged tile would take if it were dropped now: the one whose
 * position is nearest to where the tile has been carried.
 */
export function nearestSlot(slots: readonly Slot[], from: number, dx: number, dy: number): number {
  'worklet'
  const start = slots[from]
  if (!start) return from
  const x = start.x + dx
  const y = start.y + dy

  let best = from
  let bestDistance = Infinity
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    if (!slot) continue
    const distance = (slot.x - x) ** 2 + (slot.y - y) ** 2
    if (distance < bestDistance) {
      best = i
      bestDistance = distance
    }
  }
  return best
}

/** The slot the tile at `index` occupies while `from` is held over `to`. */
export function shiftedIndex(index: number, from: number, to: number): number {
  'worklet'
  if (index === from) return to
  if (from < index && index <= to) return index - 1
  if (to <= index && index < from) return index + 1
  return index
}

/** How far the tile at `index` is drawn from its own slot to reach `target`. */
export function offsetTo(
  slots: readonly Slot[],
  index: number,
  target: number,
): { x: number; y: number } {
  'worklet'
  const own = slots[index]
  const there = slots[target]
  if (!own || !there) return { x: 0, y: 0 }
  return { x: there.x - own.x, y: there.y - own.y }
}

/** The list with the item at `from` moved to `to`, everything else in order. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item === undefined) return [...items]
  next.splice(to, 0, item)
  return next
}
