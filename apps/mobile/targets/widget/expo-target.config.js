/**
 * The Home Screen, Lock Screen and StandBy widgets.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'LangXWidget',
  displayName: 'LangX',
  /*
   * The App Group is where the snapshot lives, and it is the only thing this
   * target shares with the app. Mirrored from `app.config.ts` rather than
   * written out again: two lists that must match are one list that will not.
   */
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
  frameworks: ['SwiftUI', 'WidgetKit'],
  /*
   * 17.0, not the app's own floor. `containerBackground` is required of every
   * Home Screen widget from iOS 17, and writing the pre-17 path as well would
   * double every view for the phones that will have updated by the time this
   * ships. The app itself keeps supporting older iOS; those phones simply have
   * no widget to add.
   */
  deploymentTarget: '17.0',
  /*
   * The mark the empty state draws, which is the badge the splash already
   * uses — same file, so the widget's "not signed in" face and the app's first
   * frame cannot drift apart.
   */
  images: {
    WidgetIcon: '../../assets/splash/badge.png',
  },
  colors: {
    // `colors.primary` in src/lib/theme/tokens.ts — the yellow that commits.
    $accent: '#ffc409',
    // `colors.bg`, light and dark, so the widget sits on the app's own ground.
    $widgetBackground: { color: '#ffffff', darkColor: '#1c1f24' },
  },
})
