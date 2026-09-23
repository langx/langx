/**
 * Holding a row and dragging it to a new place in a short list.
 *
 * The same shape as `swipeAction`: the geometry is plain maths here, so where a
 * row lands and how its neighbours make room are testable without a renderer.
 * Rows are measured rather than assumed, because the learning list's rows are
 * not one height — the level chips wrap onto a second line at narrow widths.
 *
 * **Every function carries `'worklet'`.** They are called from
 * `Gesture.Pan().onUpdate`/`.onEnd`, which run on the UI thread, and a plain
 * function reached from there throws — which on the UI runtime is `SIGABRT`,
 * not a red box. `swipeAction.ts` says how that was learned.
 */

/**
 * How long a row is held before it lifts, in milliseconds.
 *
 * Moving the finger sooner fails the drag rather than starting it, which is
 * what leaves a flick that begins on the handle to the scroll view.
 */
export const LIFT_AFTER_MS = 180

/**
 * The index the dragged row would take if it were dropped now.
 *
 * It passes a neighbour once its centre passes that neighbour's centre — half
 * way, in either direction, which is where every reorderable list on the phone
 * already makes the swap.
 */
export function dropIndex(heights: readonly number[], from: number, dy: number): number {
  'worklet'
  let top = 0
  for (let i = 0; i < from; i++) top += heights[i] ?? 0
  const centre = top + (heights[from] ?? 0) / 2 + dy

  let to = 0
  let y = 0
  for (let i = 0; i < heights.length; i++) {
    const height = heights[i] ?? 0
    if (i !== from && y + height / 2 < centre) to++
    y += height
  }
  return to
}

/** How far a row that is not being dragged steps aside to make room. */
export function makeRoom(
  heights: readonly number[],
  index: number,
  from: number,
  to: number,
): number {
  'worklet'
  if (index === from) return 0
  const height = heights[from] ?? 0
  if (from < index && index <= to) return -height
  if (to <= index && index < from) return height
  return 0
}

/** Where the dragged row comes to rest, as an offset from where it started. */
export function slotOffset(heights: readonly number[], from: number, to: number): number {
  'worklet'
  let offset = 0
  for (let i = from + 1; i <= to; i++) offset += heights[i] ?? 0
  for (let i = to; i < from; i++) offset -= heights[i] ?? 0
  return offset
}
