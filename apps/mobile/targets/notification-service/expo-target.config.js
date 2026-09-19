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
})
