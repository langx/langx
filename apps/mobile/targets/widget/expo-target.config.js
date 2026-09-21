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
  /*
   * `AppIntents` was here for `OpenIntents.swift` and is gone with it. The
   * intents moved to the app target on 21 September, because that is the only
   * target an `AppShortcutsProvider` can live in — see
   * `plugins/withAppIntents.js`. Declaring them in both places would put two
   * of every action in the Shortcuts app.
   */
  frameworks: ['SwiftUI', 'WidgetKit'],
  /*
   * 16.4, which is the app's own floor — a phone that cannot install the app
   * has nothing to add a widget to, so there is no reason to sit above it.
   *
   * It was 17.0 first, because `containerBackground` is required of every Home
   * Screen widget from iOS 17 and does not exist before it, and writing the
   * second path looked like doubling every view. It was one `@ViewBuilder`
   * extension — `widgetGround` in `LangXWidget.swift` — and the views did not
   * change at all. The cost of the 17.0 floor was the part nobody sees: a
   * phone on iOS 16 had the app and no widget, and was told nothing about why,
   * which is exactly how the watch app went missing at `deploymentTarget: 11`.
   */
  deploymentTarget: '16.4',
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
