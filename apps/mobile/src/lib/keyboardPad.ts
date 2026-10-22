/**
 * The arithmetic and the bookkeeping behind `KeyboardResizeHost`, the Android
 * pad that stands in for the window resize edge-to-edge took away.
 *
 * Kept free of React Native so it can be tested: the component reads the
 * keyboard events and the focused input, and asks this file what the pad
 * should be.
 */

/**
 * How far the keyboard reaches into the padded view, less the navigation-bar
 * inset every screen already leaves at the bottom. Zero when it reaches no
 * further than that — a window that still resizes (Android 14 and below), or
 * a keyboard that is already gone.
 */
export function keyboardPad({
  viewBottom,
  keyboardTop,
  bottomInset,
}: {
  viewBottom: number
  keyboardTop: number
  bottomInset: number
}): number {
  return Math.max(0, viewBottom - keyboardTop - bottomInset)
}

/**
 * The pad, and how long nothing has been focused while it stood.
 *
 * `shown` is the latest keyboard event's number — the caller numbers them, one
 * up per show and per hide — so a measurement that comes back after the
 * keyboard it measured has gone again can be recognised and dropped.
 */
export interface KeyboardPadState {
  pad: number
  shown: number
  idleTicks: number
}

export const KEYBOARD_PAD_IDLE: KeyboardPadState = { pad: 0, shown: 0, idleTicks: 0 }

/**
 * How many checks in a row must find no focused input before the pad is
 * dropped. Two, not one: moving focus from one field to the next — or from
 * `chat/new`'s composer to the thread's that replaces it — passes through a
 * moment with nothing focused, and the keyboard stays up across it.
 */
export const KEYBOARD_PAD_IDLE_TICKS = 2

/** How often the pad checks that something is still being typed into. */
export const KEYBOARD_PAD_CHECK_MS = 250

export type KeyboardPadEvent =
  /** `keyboardDidShow`, numbered: a measurement is on its way. */
  | { type: 'show'; shown: number }
  /** The measurement taken for show number `shown`, back from the native side. */
  | { type: 'measured'; shown: number; pad: number }
  /** `keyboardDidHide`, numbered like a show. */
  | { type: 'hide'; shown: number }
  /** The periodic check while padded: is any text input focused? */
  | { type: 'check'; inputFocused: boolean }

/**
 * The pad lives only as long as the keyboard it was measured for and the input
 * that keyboard types into.
 *
 * Keyboard events alone used to decide it, and they can arrive late or out of
 * order on Android: a measurement resolving after the hide that followed it,
 * or a hide that comes late or not at all — React Native only looks for one
 * on a layout pass of the root view. Either way the whole app stayed padded with no keyboard on screen: the
 * tab bar sat a keyboard's height up the screen with a blank band under it,
 * or, on a tab navigator still laid out at full height, was cut off below the
 * padded edge altogether. So a late measurement is ignored, and a pad with
 * nothing focused under it is let go.
 */
export function nextKeyboardPad(
  state: KeyboardPadState,
  event: KeyboardPadEvent,
): KeyboardPadState {
  switch (event.type) {
    case 'show':
      return { ...state, shown: event.shown, idleTicks: 0 }
    case 'measured':
      // A keyboard that has hidden (or shown again) since is not this one.
      if (event.shown !== state.shown) return state
      return { ...state, pad: event.pad, idleTicks: 0 }
    case 'hide':
      // Numbered too, so a measurement still in flight is stale on arrival.
      return { pad: 0, shown: event.shown, idleTicks: 0 }
    case 'check': {
      if (state.pad === 0) return state
      if (event.inputFocused) return state.idleTicks === 0 ? state : { ...state, idleTicks: 0 }
      const idleTicks = state.idleTicks + 1
      return idleTicks >= KEYBOARD_PAD_IDLE_TICKS
        ? { ...state, pad: 0, idleTicks: 0 }
        : { ...state, idleTicks }
    }
  }
}
