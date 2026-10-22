/**
 * The `transformOrigin` of a bar that grows from the start of its line.
 *
 * A scale has no notion of the reading direction: `transformOrigin: 'left'`
 * is the left in Arabic too, where the start of a row is its right. So a fill
 * that should grow the way the line reads names its edge from the direction.
 */
export function startEdgeOrigin(isRtl: boolean): 'left' | 'right' {
  return isRtl ? 'right' : 'left'
}
