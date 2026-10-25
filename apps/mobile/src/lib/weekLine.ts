/**
 * The geometry of the profile's week as two lines (`WeeklyChartV3`). Kept out
 * of the component so the shape can be tested without a renderer.
 */

export interface LinePoint {
  x: number
  y: number
}

/**
 * One point per day, each at the centre of its seventh of the width so it
 * sits over its day letter, which is laid out in seven equal columns below.
 * `peak` is shared by both series, so neither outgrows the other; `pad` keeps
 * the peak's dot inside the drawing.
 */
export function linePoints(
  values: readonly number[],
  { width, height, peak, pad }: { width: number; height: number; peak: number; pad: number },
): LinePoint[] {
  const step = width / values.length
  const span = height - pad * 2
  return values.map((value, index) => ({
    x: step * (index + 0.5),
    y: pad + span - (Math.max(0, value) / (peak || 1)) * span,
  }))
}

/**
 * A smooth path through the points. Each segment's two control points sit at
 * the segment's middle x and at its own ends' y, so the tangent is flat at
 * every day: the curve never dips under a zero day or above the peak, which a
 * Catmull-Rom spline would, and a week of zeros stays on the floor.
 */
export function smoothPath(points: readonly LinePoint[]): string {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  let d = `M${first!.x},${first!.y}`
  let prev = first!
  for (const point of rest) {
    const mid = (prev.x + point.x) / 2
    d += ` C${mid},${prev.y} ${mid},${point.y} ${point.x},${point.y}`
    prev = point
  }
  return d
}

/** The same path closed down to `floor`, for the shaded area under a line. */
export function areaPath(points: readonly LinePoint[], floor: number): string {
  if (points.length === 0) return ''
  const first = points[0]!
  const last = points[points.length - 1]!
  return `${smoothPath(points)} L${last.x},${floor} L${first.x},${floor} Z`
}
