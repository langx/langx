import 'expo-router/entry'
import { Platform } from 'react-native'

/**
 * The app's entry point, which used to be `expo-router/entry` itself.
 *
 * It is a file of our own now for one reason: Android's widgets are drawn by a
 * headless JS task, and the task has to be registered before Android can ask
 * for one — which is earlier than any screen or layout runs. `package.json`
 * points `main` here, and this file's first line is still the router's entry,
 * so nothing about how the app starts has changed.
 *
 * Guarded and imported lazily, both deliberately.
 * `registerWidgetTaskHandler` reaches for `AppRegistry.registerHeadlessTask`,
 * which react-native-web does not have, and the library binds to a native
 * module that exists on no other platform. A static import would put both into
 * the web bundle. Same reasoning as the lazy `expo-notifications` imports —
 * see `docs/decisions.md`.
 */
if (Platform.OS === 'android') {
  void (async () => {
    const { registerWidgetTaskHandler } = await import('react-native-android-widget')
    const { widgetTaskHandler } = await import('./widgets/widgetTaskHandler')
    registerWidgetTaskHandler(widgetTaskHandler)
  })()
}
