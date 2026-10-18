/**
 * The arithmetic behind `ProgressRing`, apart from the component so it can be
 * tested: vitest cannot load Reanimated or react-native-svg, and the part
 * worth checking — that a ring never draws more than full or less than empty,
 * and that "1 of 4" is a quarter — is plain numbers.
 *
 * `clampProgress` and `arcOffset` run inside an animated-props worklet as well
 * as in tests, so both carry `'worklet'`: a function a worklet calls without
 * one is the SIGABRT 2.0.0 shipped.
 */

/** A fraction from 0 to 1, whatever the caller handed over. */
export function clampProgress(value: number): number {
  'worklet'
  // `NaN` is neither below 0 nor above 1, so it is caught first: 0 / 0 from
  // a list that has not loaded yet is an empty ring, not a broken one.
  if (Number.isNaN(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/**
 * How full "`done` of `total`" is. Nothing to do is an empty ring rather
 * than a full one: a ring that closes on its own, before anything happened,
 * claims a success nobody earned.
 */
export function stepsProgress(done: number, total: number): number {
  if (!(total > 0)) return 0
  return clampProgress(done / total)
}

export interface RingGeometry {
  /** The centre, on both axes, inside a square `size` wide. */
  centre: number
  radius: number
  circumference: number
}

/**
 * A ring that fits its box exactly. The stroke is centred on the circle's
 * path, so half of it lies outside the radius: taking the whole stroke off
 * the size before halving keeps the outer edge on the box rather than
 * clipped by it.
 */
export function ringGeometry(size: number, stroke: number): RingGeometry {
  const radius = Math.max(0, (size - stroke) / 2)
  return { centre: size / 2, radius, circumference: 2 * Math.PI * radius }
}

/**
 * The `strokeDashoffset` that leaves `progress` of the circle drawn, with the
 * dash pattern set to one circumference on and one off.
 */
export function arcOffset(circumference: number, progress: number): number {
  'worklet'
  return circumference * (1 - clampProgress(progress))
}
