/**
 * Keeps the widget's unread count true while the app is closed.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'notification-service',
  name: 'LangXNotificationService',
  /*
   * App Groups are not on by default for this target type — the plugin only
   * assumes them where they are the point, and for a notification service they
   * usually are not. Here they are the entire reason it exists, so the group
   * is asked for explicitly, mirrored from `app.config.ts`.
   */
  entitlements: {
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
  frameworks: ['UserNotifications'],
  /*
   * 16.4, the app's own floor. Without this the plugin's default for a
   * notification-service target applied, which was 18.0 — so a phone on iOS 16
   * or 17 installed the app and then never ran this extension, and the widget's
   * unread count stopped moving for exactly the people who do not open the app.
   * Nothing said so; a badge that is quietly stale looks like a widget bug.
   *
   * Nothing here needs it. The newest call in `NotificationService.swift` is
   * `WidgetCenter.reloadAllTimelines()`, which is iOS 14, and the rest is
   * `UserNotifications` from iOS 10.
   */
  deploymentTarget: '16.4',
})
