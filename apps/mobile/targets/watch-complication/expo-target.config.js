const WATCH_APP_GROUP = require('../watchGroup')

/**
 * The watch face complication — the last piece of Surface B.
 *
 * A widget extension on the *watch*, which is what makes the App Group below
 * necessary and makes it a different group from the phone's. It is a separate
 * process, drawn while the watch app is not running, with no `WCSession` of
 * its own: only one session exists per app and the watch app owns it. So the
 * watch app writes `WatchDigest` into this container and this reads it.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'watch-widget',
  name: 'LangXComplication',
  displayName: 'LangX',
  /*
   * Spelled out, because the default is wrong here in a way that only shows
   * at install time. `@bacons/apple-targets` derives an extension's id from
   * the *app's* — `tech.newchapter.languageXchange.watch-widget` — and an
   * app extension's identifier has to be prefixed by the identifier of the
   * bundle that contains it, which for this one is the **watch app**:
   * `…languageXchange.watch`. The derived name is a sibling of that, not a
   * child, and the simulator refuses the whole watch app with "Failed to set
   * app extension placeholders" rather than naming the extension or the
   * rule.
   *
   * `.widget` and not `.complication`, which reads better and is not
   * available: Apple refuses to register that exact identifier — "An App ID
   * with identifier '…watch.complication' is not available" — while the
   * sibling string is accepted, so it is the name that is taken rather than
   * anything structural. The registered App ID is
   * `tech.newchapter.languageXchange.watch.widget` and this has to match it.
   */
  bundleIdentifier: 'tech.newchapter.languageXchange.watch.widget',
  /*
   * Declared rather than left to `appGroupsByDefault`, so that this file and
   * the watch app's name the same string and a rename cannot move one without
   * the other. A mismatch is silent: the extension reads an empty container
   * and draws its placeholder for ever.
   */
  entitlements: {
    'com.apple.security.application-groups': [WATCH_APP_GROUP],
  },
  /*
   * 9.0, matching the watch app. The accessory families this draws arrive in
   * watchOS 9 with WidgetKit's complication support, and the app's own floor
   * is there for a reason worth not undoing — see its config.
   */
  deploymentTarget: '9.0',
  /*
   * The mark, for the one family with room for it. The same splash badge the
   * phone widgets draw, so a face and a Home Screen cannot end up wearing
   * different versions of it.
   */
  images: {
    ComplicationIcon: '../../assets/splash/badge.png',
  },
})
