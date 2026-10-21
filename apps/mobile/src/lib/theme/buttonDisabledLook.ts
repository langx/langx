import type { V3Colors } from './tokens'

/** The `Button` variants drawn as a filled pill, rather than an outline. */
export const FILLED_BUTTON_VARIANTS = ['primary', 'blue', 'ink', 'hue'] as const

/**
 * A filled button that cannot be pressed yet, under v3: the grey block with a
 * muted label, as the composer's idle send is drawn.
 *
 * Not the fill at half opacity. Half a yellow over the dark ground is olive —
 * a colour of its own, which reads as a different button rather than this one
 * asleep — and half a blue or ink pill loses its label's contrast. The grey
 * keeps `muted` on `surface`, a pair `contrast.test.ts` holds to 4.5:1 in both
 * schemes, and it is the look every other unavailable thing in v3 already has.
 */
export function disabledButtonLook(colors: V3Colors): {
  face: string
  label: string
  border: string
} {
  return { face: colors.surface, label: colors.muted, border: colors.surface }
}
