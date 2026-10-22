/**
 * The "no" shake a form gives when what was typed was refused — a failed
 * sign-in. A head shaken once: out to one side and the other twice, then
 * home, the whole of it quick enough that the error under the field is
 * already there to read when it stops.
 */

/** How far each way, in points. Enough to see, not enough to blur the text. */
export const SHAKE_DISTANCE = 6

/** The whole shake, in milliseconds. */
export const SHAKE_MS = 240

export interface ShakeStep {
  /** Where the form is at the end of this step, in points along the line. */
  to: number
  ms: number
}

/** The steps of one shake, each the same length, ending where it started. */
export function shakeSteps(distance = SHAKE_DISTANCE, total = SHAKE_MS): ShakeStep[] {
  const stops = [distance, -distance, distance, -distance, 0]
  return stops.map((to) => ({ to, ms: total / stops.length }))
}
