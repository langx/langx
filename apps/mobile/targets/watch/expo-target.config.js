const WATCH_APP_GROUP = require('../watchGroup')

/**
 * The Apple Watch app — Surface B of docs/plans/iphone-watch-and-carplay.md.
 *
 * Dependent, not independent: no session, no network call, no credential of
 * its own. Everything it shows arrives from the phone over WatchConnectivity,
 * and everything it sends goes back the same way. That decision is the reason
 * this target asks for so little.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'watch',
  name: 'LangXWatch',
  displayName: 'LangX',
  /*
   * **The phone's App Group is not mirrored here, and cannot be.** An App
   * Group is a container on a *device*; the watch is a different device, so
   * the group the widgets and the notification service extension share with
   * the app is not reachable from the wrist at all. What the watch knows, the
   * phone told it over WatchConnectivity.
   *
   * This group is a different one: between the watch app and
   * `LangXComplication`, two targets on the same watch. The app writes down
   * what the phone told it and the complication — a separate process, drawn
   * while the app is not running, with no session of its own — reads it.
   * Declared in `targets/watchGroup.js` so both files name one string.
   */
  entitlements: {
    'com.apple.security.application-groups': [WATCH_APP_GROUP],
  },
  frameworks: ['SwiftUI', 'WatchConnectivity'],
  /*
   * 9.0, which is the floor this target's own code sets: `NavigationStack`,
   * `.navigationDestination` and `TextFieldLink` all arrive in watchOS 9, and
   * nothing here needs anything newer. The phone app's own floor is
   * unaffected — a watch is an accessory to it, not a gate on it.
   *
   * It was 11.0 first, on the reasoning that no watch still paired with a
   * supported iPhone would be excluded. That is wrong: watchOS 11 dropped
   * Series 5, Series 4 and the first SE, which stop at watchOS 10 and stay
   * paired for years after. The way it fails is the reason to write this
   * down — the phone simply never offers the watch app. It is absent from
   * Watch → Available Apps, with no error, on a build that installs and runs
   * perfectly on the phone, so it reads as a broken build rather than an
   * excluded device. Found against build 163, on a watch running watchOS 10.
   */
  deploymentTarget: '9.0',
  /*
   * The watch app needs an icon of its own, and nothing local says so. It
   * builds, installs and runs without one; `altool` rejects the upload:
   * "No icons found for watch application 'LangX.app/Watch/LangXWatch.app'"
   * and a missing `CFBundleIconName` for the watch bundle. That validation
   * runs only against a finished archive, so the gap cost build 162 — the
   * whole compile and submit — to surface.
   *
   * The phone's own 1024 master, because a watch app wearing a different mark
   * than the phone it belongs to is a bug nobody files. `@bacons/apple-targets`
   * writes the asset catalogue and the Info.plist key from this one file.
   */
  icon: '../../assets/icons/default.png',
})
