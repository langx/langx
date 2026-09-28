import type { AlertRequest } from './alert'

/**
 * When `AlertHost` may put the next dialog on screen.
 *
 * iOS refuses to present a view controller while another is still animating
 * away, and it refuses **silently** — `ShareCardSheet` met the same rule with
 * the share sheet. `AlertHost` used to unmount its `Modal` the moment the queue
 * emptied and mount a new one when the next request came. Straight after a
 * press the two land in one render and the sheet only swaps its content, so
 * nothing showed the problem; with any real wait in between — a GPS fix, a
 * geocode — the second `Modal` asked to present during the first one's slide
 * out and was dropped. React Native records it as presented anyway, so it
 * never tries again, and the invisible request then sits at the head of the
 * queue: every dialog after it, the composer's "+" included, waits behind a
 * sheet nobody can see or answer. Sharing a location a second time was where
 * that surfaced, because by then the fix was warm and came back inside the
 * animation.
 *
 * So on iOS the host keeps its `Modal` mounted while it closes and presents
 * nothing until `onDismiss` says the slide out is over. Kept pure, apart from
 * the component, because `src/lib` is what the tests can reach.
 */
export interface AlertPresentation {
  /** What the queue in `alert.ts` wants on screen now. */
  wanted: AlertRequest<unknown> | null
  /** What the sheet draws: the wanted request, or the one sliding away. */
  drawn: AlertRequest<unknown> | null
  /** The sheet is animating away, and nothing may be presented until it has. */
  closing: boolean
}

export const NO_ALERT: AlertPresentation = { wanted: null, drawn: null, closing: false }

/**
 * The queue's head changed.
 *
 * `waitsForDismiss` is the platform: only iOS has the rule, and only iOS
 * fires `onDismiss`, so anywhere else waiting for it would wait for ever.
 */
export function alertWanted(
  state: AlertPresentation,
  wanted: AlertRequest<unknown> | null,
  waitsForDismiss: boolean,
): AlertPresentation {
  if (state.closing) return { ...state, wanted }
  // Open already, or nothing open: either way presenting now is safe. An open
  // sheet only changes what it says.
  if (wanted) return { wanted, drawn: wanted, closing: false }
  if (state.drawn && waitsForDismiss) return { wanted: null, drawn: state.drawn, closing: true }
  return NO_ALERT
}

/** The slide out finished: whatever arrived meanwhile may be presented now. */
export function alertDismissed(state: AlertPresentation): AlertPresentation {
  // A late `onDismiss` after the host's fallback timer already moved on.
  if (!state.closing) return state
  return { wanted: state.wanted, drawn: state.wanted, closing: false }
}

/** Whether the `Modal` should be presented, as opposed to merely mounted. */
export function isAlertVisible(state: AlertPresentation): boolean {
  return state.drawn !== null && !state.closing
}
