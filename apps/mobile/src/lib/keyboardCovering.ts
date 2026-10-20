/**
 * Whether a soft keyboard is covering the bottom of the screen — the moment
 * the v3 thread folds its header band and hides the composer's chips, so a
 * small phone still shows some of the conversation being answered.
 *
 * Natively the keyboard says so itself (`Keyboard`'s show and hide events),
 * which a hardware keyboard on an iPad correctly never does. A browser sends
 * no such event, so there the focused field stands in for it — but only
 * where there is a finger: a desktop's field takes focus with no keyboard
 * on screen, and folding its header there would hide the partner for
 * nothing.
 *
 * Pure, and free of `react-native`, so vitest can load it; `useKeyboardUp`
 * passes the platform in.
 */
export function keyboardCovering(input: {
  os: string
  touch: boolean
  keyboardShown: boolean
  fieldFocused: boolean
}): boolean {
  if (input.os === 'web') return input.touch && input.fieldFocused
  return input.keyboardShown
}
