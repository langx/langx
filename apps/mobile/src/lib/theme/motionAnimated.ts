import { Easing } from 'react-native'
import { CURVE } from './motionValues'

/**
 * `motion.ts`'s curves, built with React Native's `Easing` rather than
 * Reanimated's, for the launch path: `Button`, `PressableScale`, the toast and
 * everything else that must not evaluate Reanimated on import (see
 * `motionValues.ts`). Same control points, so an `Animated` press and a
 * Reanimated one land on the same curve.
 *
 * Imports only `react-native` and `motionValues`; a Reanimated import here
 * would put Reanimated on the launch path through every file that reads it.
 */

/** A strong ease-out: the movement is at its fastest when the eye arrives. */
export const EASE_OUT = Easing.bezier(...CURVE.out)
/** Fast out of the gate, then a long soft landing: text rising into place. */
export const EASE_RISE = Easing.bezier(...CURVE.rise)
/** A small overshoot, for the one thing on a screen that is thrown. */
export const EASE_POP = Easing.bezier(...CURVE.pop)
