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
