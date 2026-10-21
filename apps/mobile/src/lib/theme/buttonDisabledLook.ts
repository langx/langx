import type { V3Colors } from './tokens'

/** The `Button` variants drawn as a filled pill, rather than an outline. */
export const FILLED_BUTTON_VARIANTS = ['primary', 'blue', 'ink', 'hue'] as const

/**
 * The grounds a button is drawn on: the page, and the grey block a settings
 * group, a sheet's card or an admin panel sits in. A disabled look has to read
 * on both, so `contrast.test.ts` measures it against each.
 */
export const BUTTON_GROUNDS = ['bg', 'surface'] as const

/**
 * A filled button that cannot be pressed yet, under v3: an outline in the
 * muted grey, with a muted label, see-through to whatever it sits on.
 *
 * Not the fill at half opacity. Half a yellow over the dark ground is olive —
 * a colour of its own, which reads as a different button rather than this one
 * asleep — and half a blue or ink pill loses its label's contrast.
 *
 * Not a grey fill either. `surface` is the grey block itself, so on a card or
 * an admin panel the pill vanished; even `track`, the step darker that the
 * progress rings use, is only 1.2:1 against `surface`. A muted outline is
 * above 3:1 on both grounds, which is what a control's edge needs, and the
 * label is the same `muted` that already reads on both.
 */
export function disabledButtonLook(colors: V3Colors): {
  face: string
  label: string
  border: string
} {
  return { face: 'transparent', label: colors.muted, border: colors.muted }
}
