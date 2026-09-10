/**
 * Whether a key press in a composer should send rather than insert a newline.
 *
 * Enter sends, Shift+Enter starts a new line — what every chat client on the
 * web does, and the reason the rule cannot simply be "Enter sends": the
 * composer is `multiline`, which react-native-web renders as a `<textarea>`,
 * where Enter is how you write a second line.
 *
 * `onSubmitEditing` does not help there. On a single-line input react-native-web
 * fires it for Enter; on a textarea it never fires at all, which is why the
 * chat composer had an `onSubmitEditing` handler that had never once run in a
 * browser.
 */
export function shouldSubmitOnEnter(key: string, shiftKey: boolean): boolean {
  return key === 'Enter' && !shiftKey
}

/**
 * Whether the return key should send on a native build rather than open a line.
 *
 * True only on a desktop: the app also ships as a "Designed for iPad" binary
 * that runs on Apple Silicon Macs, where there is no on-screen keyboard at all
 * and the return key is the only one a person reaches for. On a phone or a
 * tablet it stays a newline — the send button is right there, and a thumb has
 * no way to say "not that Enter".
 *
 * The rule cannot be `shouldSubmitOnEnter`'s on native, because iOS hands the
 * text view a bare "\n" with no modifier state attached: Shift+Enter and Enter
 * are the same event. So on a Mac every return sends, and a second line is
 * written by pasting one.
 *
 * Web is excluded even on a desktop, because there the key handler above is
 * both available and better — it can tell the two Enters apart.
 */
export function enterSendsOnNative(platform: string, isDesktop: boolean): boolean {
  return platform !== 'web' && isDesktop
}
