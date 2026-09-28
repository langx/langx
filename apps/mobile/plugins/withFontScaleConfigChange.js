const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins')

/**
 * Keeps the app where it was when somebody changes the system font size.
 *
 * Android destroys and recreates an activity for any configuration change it
 * does not declare it handles. Expo's template declares orientation, screen
 * size, `uiMode` and a few more, but not `fontScale` — so moving the font
 * slider in Settings recreated `MainActivity`, which restarts React and drops
 * the navigation state: the reader came back to Discover, whatever they had
 * open. Found on the Android device pass of 28 September 2026.
 *
 * Declared here instead, React Native gets the change through
 * `onConfigurationChanged`, updates its display metrics and emits a
 * dimensions change, so text is re-measured at the new scale in place — the
 * same path the template already relies on for `uiMode` (dark mode).
 *
 * A plugin because `android/` is generated: a hand edit to the manifest is
 * gone at the next `expo prebuild --clean`. Additive and idempotent — it only
 * appends `fontScale` if the list does not already have it, so a later
 * template that adds it itself makes this a no-op worth deleting.
 *
 * A native change: it moves the runtime fingerprint, so it reaches people
 * with a store build, not an OTA.
 */
const CHANGES = ['fontScale']

function withFontScaleConfigChange(config) {
  return withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults)
    const current = (activity.$['android:configChanges'] ?? '').split('|').filter(Boolean)
    const missing = CHANGES.filter((change) => !current.includes(change))
    if (missing.length > 0) activity.$['android:configChanges'] = [...current, ...missing].join('|')
    return config
  })
}

module.exports = withFontScaleConfigChange
