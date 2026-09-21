import { type CompanionDirectory, type CompanionSnapshot } from '@langx/shared'
import { requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'
import { clearFlag, FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../../src/lib/localFlags'

/**
 * The one door between the app and the widgets, on both platforms.
 *
 * The two halves reach the same shape by different roads, because the two
 * systems draw a widget differently. **iOS** runs the widget in its own
 * process, which cannot see the app's storage and cannot run its JavaScript,
 * so the blob goes into an App Group container that a Swift reader decodes.
 * **Android** renders the widget from the app's own JS in a headless task, so
 * there is nothing to hand across a process boundary — the blob is stored
 * where the app already stores things and the widget reads it directly.
 *
 * What both share is the shape: `packages/shared/src/companion.ts` is the
 * definition, and neither half restates it.
 *
 * `requireOptionalNativeModule` rather than `requireNativeModule`: the iOS
 * module exists only on iOS, and only in a build made since it was added. Web
 * and any older binary running a newer JS bundle over the air get `null`, and
 * every call below stays a no-op — so call sites stay unconditional and
 * nothing has to know which platform it is on.
 */
interface CompanionSnapshotNativeModule {
  write: (json: string) => void
  clear: () => void
  /** Present only on a build made since the App Intents landed. */
  takePendingRoute?: () => string | null
  /** Present only on a build made since the conversation intent landed. */
  writeDirectory?: (json: string) => void
  clearDirectory?: () => void
}

const native = requireOptionalNativeModule<CompanionSnapshotNativeModule>('CompanionSnapshot')

const isAndroid = Platform.OS === 'android'

/**
 * Redraw whatever is on the Home Screen.
 *
 * Android only, and imported where it is used rather than at module scope:
 * `react-native-android-widget` binds to a native module that does not exist
 * on iOS or on web, and the web build must not pull it into the bundle at all.
 * The same reason `expo-notifications` is imported lazily — see
 * `docs/decisions.md`.
 *
 * Failures are swallowed on purpose. A widget that did not redraw is a widget
 * a few minutes stale; it is never a reason for a sign-out to fail or for a
 * screen to throw.
 */
async function redrawAndroidWidgets(snapshot: CompanionSnapshot | null): Promise<void> {
  if (!isAndroid) return
  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget')
    const { renderFor, WIDGET_NAMES } = await import('../../widgets/CompanionWidget')
    await Promise.all(
      Object.values(WIDGET_NAMES).map((widgetName) =>
        requestWidgetUpdate({ widgetName, renderWidget: () => renderFor(widgetName, snapshot) }),
      ),
    )
  } catch {
    // See above.
  }
}

/** Hand the widgets a fresh reading. */
export function writeCompanionSnapshot(snapshot: CompanionSnapshot): void {
  native?.write(JSON.stringify(snapshot))
  if (!isAndroid) return
  void writeJsonFlag(FLAG_KEYS.companionSnapshot, snapshot).then(() =>
    redrawAndroidWidgets(snapshot),
  )
}

/**
 * Forget everything. Called on sign-out, in the same breath as the session:
 * a widget that goes on showing somebody's streak after they sign out is their
 * data left on a Home Screen that may not be theirs.
 *
 * The redraw is deliberately sequenced after the clear rather than beside it.
 * On Android the widget reads the same store this is emptying, so a redraw
 * started first would have an even chance of drawing what was just removed.
 */
export function clearCompanionSnapshot(): void {
  native?.clear()
  if (!isAndroid) return
  void clearFlag(FLAG_KEYS.companionSnapshot).then(() => redrawAndroidWidgets(null))
}

/**
 * Hand the App Intents the people they may be asked about.
 *
 * iOS only, and not because Android could not have one — because nothing on
 * Android asks. The Wear app and the tile read their own payload, and the
 * Android widgets draw numbers. A no-op everywhere else, like everything in
 * this file.
 */
export function writeCompanionDirectory(directory: CompanionDirectory): void {
  native?.writeDirectory?.(JSON.stringify(directory))
}

/** Sign-out. Separate from the snapshot's `clear`, and called beside it. */
export function clearCompanionDirectory(): void {
  native?.clearDirectory?.()
}

/**
 * What the Android widget task handler draws. Null is a real answer with a
 * real meaning — nobody is signed in, or this phone has not opened the app
 * since the widget was added — and both widgets draw the same empty state for
 * it. It is never a zero: a zero is a claim about somebody's streak, and we do
 * not have one to make.
 */
export function readCompanionSnapshot(): Promise<CompanionSnapshot | null> {
  return readJsonFlag<CompanionSnapshot>(FLAG_KEYS.companionSnapshot)
}

/**
 * The screen an App Intent asked for, or null.
 *
 * Read once and cleared by the native side. `?.()` twice over: the module is
 * absent on Android and on the web, and the function is absent on an iOS
 * build made before the intents existed — an older binary running a newer
 * bundle over the air is the ordinary case here, not the exotic one.
 */
export function takePendingRoute(): string | null {
  return native?.takePendingRoute?.() ?? null
}
