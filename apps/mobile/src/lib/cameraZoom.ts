/**
 * The chat camera's pinch zoom, as plain numbers.
 *
 * The gesture keeps one value, `factor`: the magnification the person feels,
 * 1 meaning none. A pinch multiplies it by the fingers' spread, so the
 * picture grows exactly as much as the hand does, and the platform then turns
 * it into expo-camera's `zoom` prop (0…1). The two natives read that prop
 * differently, which is why the factor is the state and the prop is derived:
 *
 *   iOS      videoZoomFactor = max ^ zoom          (exponential)
 *   Android  zoomRatio = max(1, zoom × maxRatio)   (linear; below 1/max is dead)
 *
 * JS never learns either maximum, so both are estimates of a typical wide
 * lens. On a device whose real maximum differs, a pinch still multiplies the
 * picture by the spread; only the point where it stops moves.
 *
 * Every function is a worklet so the gesture runs it on the UI thread. The
 * directive is only a string to vitest, which imports this file directly.
 */
export const ZOOM = {
  /** `videoMaxZoomFactor` of a 1080p wide-lens format, as an order of magnitude. */
  iosMaxEstimate: 100,
  /** CameraX `maxZoomRatio` of a typical rear camera (digital). */
  androidMaxEstimate: 8,
  /** Where the pinch stops: past about 10x a phone's digital zoom is mush. */
  maxFactor: 10,
  /** Let go under this and the zoom lands exactly on 1. */
  snapToOne: 1.04,
  /**
   * How far off an end the factor has to move before reaching that end buzzes
   * again — one tick per arrival, not a rattle while the fingers hover on it.
   */
  rearm: 1.05,
  /** What a screen reader's swipe up or down multiplies or divides by. */
  step: 2,
} as const

export type ZoomPlatform = 'ios' | 'android'

/** The factor after one pinch event, clamped to 1…`maxFactor`. */
export function pinchFactor(factor: number, scaleChange: number): number {
  'worklet'
  const next = factor * scaleChange
  return Math.min(ZOOM.maxFactor, Math.max(1, next))
}

/** The `zoom` prop that gives `factor` on this platform, in 0…1. */
export function zoomProp(factor: number, os: ZoomPlatform): number {
  'worklet'
  if (factor <= 1) return 0
  const zoom =
    os === 'ios'
      ? // The inverse of max ^ zoom.
        Math.log(factor) / Math.log(ZOOM.iosMaxEstimate)
      : // The inverse of zoom × max. Starts at 1/max, so the first step already moves.
        factor / ZOOM.androidMaxEstimate
  return Math.min(1, Math.max(0, zoom))
}

/** Where a released pinch rests: a hair over 1 is 1, so "not zoomed" is exact. */
export function settleFactor(factor: number): number {
  'worklet'
  return factor < ZOOM.snapToOne ? 1 : factor
}

/** At either end of the range: the place a pinch stops and buzzes once. */
export function atZoomEdge(factor: number): boolean {
  'worklet'
  return factor <= 1 || factor >= ZOOM.maxFactor
}

/** Far enough from both ends for the next arrival at one to buzz again. */
export function clearOfZoomEdge(factor: number): boolean {
  'worklet'
  return factor >= ZOOM.rearm && factor <= ZOOM.maxFactor / ZOOM.rearm
}

/** A screen reader's increment (+1) or decrement (−1): one `step`, clamped. */
export function stepFactor(factor: number, direction: 1 | -1): number {
  'worklet'
  return pinchFactor(factor, direction === 1 ? ZOOM.step : 1 / ZOOM.step)
}
