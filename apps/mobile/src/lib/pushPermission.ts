/**
 * Whether the chats tab should raise the system notification dialog.
 *
 * `asked` is this device's own record that the dialog has been raised once,
 * and it is deliberately not the whole answer. It used to be written *before*
 * the request, so anything between the two — a throw inside
 * `requestPermissionsAsync`, the app being killed on the frame it opened —
 * left a flag saying "asked" about a dialog nobody ever saw. Nothing asks
 * twice: the priming card only mounts on the two onboarding exits, and this is
 * the only other asker. The phone is then silent for good, and iOS shows no
 * Notifications row for the app to flip either, because a row appears only
 * once an app has actually requested. There is no way back from the outside.
 *
 * So the flag is trusted only where it can be telling the truth. **iOS cannot
 * collect an answer without showing the dialog** — it is modal and has two
 * buttons — so a status still undetermined there means it never appeared,
 * whatever the flag says, and asking again is the only thing that can be
 * right. **Android can**: its dialog is dismissable and a dismissal leaves
 * exactly this state, so the flag stands, which is what keeps one dismissal
 * from becoming a dialog on every visit.
 *
 * Pure, and free of `react-native` and `expo-notifications` for the reason
 * `locationPermission.ts` gives: the decision is the part worth testing, and a
 * decision that imports the platform is one nothing can test.
 */
export function shouldAskForPush(input: {
  granted: boolean
  canAskAgain: boolean
  /** The OS has no answer on record — nobody has said yes or no yet. */
  undetermined: boolean
  /** This device's `pushAsked` flag. */
  asked: boolean
  platform: string
}): boolean {
  // No dialog to raise in a browser, and `expo-notifications` is what must not
  // be reached there.
  if (input.platform === 'web') return false
  // Already answered, or answerable only in the Settings app. Either way this
  // screen has nothing to offer.
  if (input.granted || !input.canAskAgain) return false
  if (!input.asked) return true
  return input.platform === 'ios' && input.undetermined
}
