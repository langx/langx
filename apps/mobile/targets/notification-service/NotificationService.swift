import UserNotifications
import WidgetKit

/**
 The only thing that keeps the Home Screen honest for somebody who never opens
 the app.

 A message push already carries the recipient's unread total as its badge —
 `modules/push/devices.ts` sends the number `GET /me/unread` would answer with,
 so the icon and the tab agree. This extension is handed that same number on
 its way past, writes it into the snapshot the widget reads, and asks WidgetKit
 for a redraw. Nothing is fetched and no session is involved: the payload was
 already delivered to this phone, for this account.

 It rewrites one field and copies the rest. The streak and the Echo count are
 the app's to refresh, and a push about a message says nothing about either.
 */
class NotificationService: UNNotificationServiceExtension {
  private var handler: ((UNNotificationContent) -> Void)?
  private var content: UNMutableNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    handler = contentHandler
    content = request.content.mutableCopy() as? UNMutableNotificationContent

    /*
     A badge of nil is every other kind of notification — a badge, a profile
     visit, the evening streak nudge — and those leave the count alone rather
     than guessing at it.
     */
    if let badge = request.content.badge?.intValue {
      updateUnread(to: badge)
    }

    contentHandler(content ?? request.content)
  }

  /*
   Thirty seconds, then iOS delivers the notification as it arrived. The
   snapshot write is synchronous and the count is already in hand, so this is
   only ever reached if the system is stopping us mid-flight — in which case
   the notification matters more than the widget being a few minutes stale.
   */
  override func serviceExtensionTimeWillExpire() {
    if let handler, let content {
      handler(content)
    }
  }

  private func updateUnread(to unread: Int) {
    guard let defaults = UserDefaults(suiteName: CompanionSnapshot.appGroup),
      let json = defaults.string(forKey: CompanionSnapshot.key),
      let data = json.data(using: .utf8),
      var object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return }

    /*
     Edited as loose JSON rather than decoded into `CompanionSnapshot` and
     re-encoded: this extension may be older than the app that wrote the blob,
     and a round trip through a struct it does not fully know would silently
     drop whatever it has not learned about yet. Touch one key, leave the rest
     byte for byte.
     */
    object["unread"] = unread
    guard let updated = try? JSONSerialization.data(withJSONObject: object),
      let string = String(data: updated, encoding: .utf8)
    else { return }

    defaults.set(string, forKey: CompanionSnapshot.key)
    WidgetCenter.shared.reloadAllTimelines()
  }
}
