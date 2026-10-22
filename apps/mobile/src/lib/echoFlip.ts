/**
 * The v3 review card's flip, as numbers: which face shows at a point in the
 * turn, how far each face is turned, and how opaque it is.
 *
 * `progress` runs from 0 (the front, square to the reader) to 1 (the back,
 * square to the reader). Both faces turn together through 180°, the back
 * starting half a turn behind, so the face that is meant to be read always
 * sits between -90° and 90°.
 *
 * **The faces swap at 90°, by opacity, never by `backfaceVisibility`.** Past
 * 90° a face is seen from behind, and its text would read mirrored. Android
 * has ignored `backfaceVisibility` on views with children for years, so each
 * face is simply invisible outside its own half of the turn.
 *
 * With reduced motion nothing turns: the faces crossfade across the whole of
 * `progress` instead.
 *
 * Plain functions, no Reanimated import, so the mobile vitest can hold them;
 * each carries `'worklet'` because `useAnimatedStyle` calls them on the UI
 * thread.
 */

export type FlipFace = 'front' | 'back'

/** Where in the turn the faces swap: the card edge-on, at 90°. */
export const FLIP_SWAP = 0.5

/** The face the reader sees at `progress`. The back from the swap on. */
export function faceShown(progress: number): FlipFace {
  'worklet'
  return progress < FLIP_SWAP ? 'front' : 'back'
}

/** How far `face` is turned at `progress`, in degrees; 0 is square to the reader. */
export function faceAngle(face: FlipFace, progress: number, reduce: boolean): number {
  'worklet'
  if (reduce) return 0
  return face === 'front' ? progress * 180 : progress * 180 - 180
}

/** How opaque `face` is at `progress`: a step at the swap, or a crossfade when motion is reduced. */
export function faceOpacity(face: FlipFace, progress: number, reduce: boolean): number {
  'worklet'
  if (reduce) return face === 'front' ? 1 - progress : progress
  return faceShown(progress) === face ? 1 : 0
}
