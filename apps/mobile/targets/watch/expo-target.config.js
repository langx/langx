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
   * No App Group is mirrored from the app here, and that is the one thing
   * about this target worth reading twice. An App Group is a container on a
   * *device*; the watch is a different device, so the group the widgets and
   * the notification service extension share with the app on the phone is not
   * reachable from here at all. What the watch knows, the phone told it.
   *
   * The complication is the exception, and it is a group between the watch app
   * and its own extension — declared in `targets/watch-complication`.
   */
  frameworks: ['SwiftUI', 'WatchConnectivity'],
  /*
   * 11.0 is where `WKApplication` and the SwiftUI App lifecycle are settled,
   * and it is old enough that no Apple Watch still paired with a supported
   * iPhone is excluded. The phone app's own floor is unaffected — a watch is
   * an accessory to it, not a gate on it.
   */
  deploymentTarget: '11.0',
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
