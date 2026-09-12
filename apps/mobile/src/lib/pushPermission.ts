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

/**
 * What the "notifications on this phone" switch in Settings should read.
 *
 * It used to read the device flag alone, which defaults to on — so a phone the
 * OS has granted nothing sat there showing an on switch, promising
 * notifications that could never arrive, and giving the one person actually
 * hunting the problem no reason to touch it. Off is the truth, and it is also
 * what makes the switch usable: turning it on is how the dialog gets raised a
 * second time.
 *
 * Web keeps the old meaning. There is no push there at all and no permission
 * to reflect, so the flag is the whole answer.
 */
export function pushSwitchIsOn(input: {
  granted: boolean
  offOnThisDevice: boolean
  platform: string
}): boolean {
  if (input.platform === 'web') return !input.offOnThisDevice
  return input.granted && !input.offOnThisDevice
}

/**
 * What turning that switch **on** has to do.
 *
 * Unlike the chats tab this is somebody asking for notifications in so many
 * words, so it ignores `pushAsked` entirely: a person who taps a switch
 * labelled "notifications on this phone" has earned a dialog, whatever any
 * flag remembers. When iOS will no longer show one, the only place left that
 * can change the answer is the Settings app, and sending them there beats a
 * switch that springs back with no explanation.
 *
 * `register` rather than nothing when permission is already granted: the
 * failure that started this is a phone with permission and no device row, and
 * the row is what a push is addressed to.
 */
export function pushSwitchAction(input: {
  granted: boolean
  canAskAgain: boolean
  platform: string
}): 'register' | 'ask' | 'openSettings' | 'none' {
  if (input.platform === 'web') return 'none'
  if (input.granted) return 'register'
  return input.canAskAgain ? 'ask' : 'openSettings'
}

/**
 * What the notification guide screen has to say, as one value.
 *
 * Mirrors `locationGuideStatus`, and splits the refusals for the same reason:
 * one of them the app can still raise a dialog for, and the other only the
 * Settings app can undo. Telling somebody to "allow it" when nothing will ever
 * ask again is how a help screen becomes the problem.
 *
 * `silenced` is the fourth, and the one this permission has that location does
 * not: the OS granted notifications and LangX's own per-device switch is off.
 * Nothing is wrong with the phone and the Settings app has nothing to fix —
 * the switch one screen up is the answer, and saying "notifications are on"
 * to somebody receiving none would be a lie by omission.
 */
export type PushGuideStatus = 'granted' | 'askable' | 'blocked' | 'silenced' | 'web'

export function pushGuideStatus(input: {
  granted: boolean
  canAskAgain: boolean
  /** LangX's own switch for this phone, not the OS's. */
  offOnThisDevice: boolean
  platform: string
}): PushGuideStatus {
  // First, and not as a variety of `blocked`: there is no push on the web at
  // all, so every instruction the other branches give names a screen that does
  // not exist there.
  if (input.platform === 'web') return 'web'
  if (!input.granted) return input.canAskAgain ? 'askable' : 'blocked'
  return input.offOnThisDevice ? 'silenced' : 'granted'
}

/**
 * The same decision, made from what the OS and this device currently say.
 *
 * `platform` is a parameter rather than something this module reads, and that
 * is `locationPermission.ts`'s reason exactly: a dynamic import of
 * `react-native` compiles to Metro's `importAll`, which touches every named
 * export on the barrel — including the deprecated getters that exist only to
 * throw. `noDynamicReactNativeImport.test.ts` is what keeps it that way.
 */
export async function readPushGuideStatus(platform: string): Promise<PushGuideStatus> {
  // Imported here rather than at the top, like `readLocationGuideStatus` does
  // with `./location`: `devicePush` reaches the API client and the API client
  // reaches `react-native`, and this module has to stay loadable by the tests
  // that cover the decision above.
  const { pushEnabledOnThisDevice } = await import('./devicePush')
  const offOnThisDevice = !(await pushEnabledOnThisDevice())
  // Answered before `expo-notifications` is reached, which is precisely what
  // must not happen in a browser.
  if (platform === 'web') return pushGuideStatus({ ...NO_PERMISSION, offOnThisDevice, platform })

  const Notifications = await import('expo-notifications')
  const permission = await Notifications.getPermissionsAsync()
  return pushGuideStatus({
    granted: permission.granted,
    canAskAgain: permission.canAskAgain,
    offOnThisDevice,
    platform,
  })
}

/** What the web has, and the shape `pushGuideStatus` answers `web` to anyway. */
const NO_PERMISSION = { granted: false, canAskAgain: false }
