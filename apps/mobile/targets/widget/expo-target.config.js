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
    /*
     * `colors.bg`, light and dark, so the widget sits on the app's own ground.
     *
     * **`light`/`dark`, not `color`/`darkColor`.** The other spelling is
     * accepted silently and writes a colour set with an empty `colors` array,
     * so `Color("…")` resolves to nothing and draws black — invisible on a
     * dark widget and wrong on a light one. This entry carried the wrong keys
     * from the day it was written and nobody saw it, because the views used a
     * system material instead of asking for it.
     */
    $widgetBackground: { light: '#ffffff', dark: '#1c1f24' },
    /*
     * `colors.fill` — the ground each of the three numbers sits on, one step
     * up from the widget's own background. A pair rather than a single value
     * for the reason the pair above exists: a widget follows the system
     * appearance, so a dark tile written as one colour is a black card on a
     * white widget in the morning.
     */
    tile: { light: '#f4f5f7', dark: '#23272d' },
    /*
     * `colors.bg` again, but as a colour set Swift can ask for by name — the
     * `$widgetBackground` above is the Info.plist key WidgetKit reads, not
     * something a view can reference. Used as the container background so the
     * widgets sit on the app's own ground, as the mockups draw them, and so
     * that `tile` reads against it exactly as `fill` reads against `bg` in the
     * app. A system material would be more native and would also make the
     * activity map's empty squares invisible, which is the whole map.
     */
    ground: { light: '#ffffff', dark: '#1c1f24' },
    /*
     * `colors.ink` — the busiest day on the activity map. The app's own map
     * uses it rather than a fourth step of blue, because at this size two more
     * steps of one hue stop being tellable apart.
     */
    ink: { light: '#17191c', dark: '#f2f3f5' },
    /*
     * `colors.border` — the empty square on the activity map.
     *
     * The app's own map uses `fill` there, and that is right at its size and
     * on its card. At a widget's twelve points, on the widget's own ground,
     * `fill` is one step away from the background and the grid disappears —
     * which is the failure `ActivityMap.tsx` warns about in so many words. So
     * the empty square takes the token whose job is *visible separation*, and
     * the map stays a calendar rather than a scatter of dots.
     */
    cell: { light: '#e8eaec', dark: '#2c3036' },
  },
})
