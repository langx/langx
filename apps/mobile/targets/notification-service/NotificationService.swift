import Intents
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

    guard let content else {
      contentHandler(request.content)
      return
    }
    communicate(request, content, done: contentHandler)
  }

  /**
   A message push, turned into a message.

   iOS treats a notification as an ordinary alert unless it is told who sent
   it and in which conversation, and only a *communication* notification is
   one Siri will announce — which is how a message that arrives mid-drive gets
   read aloud in the car, by Siri, rather than by anything of ours. The telling
   is an `INSendMessageIntent` for the incoming message, donated, with the
   notification rebuilt from it: the sender's name becomes the title the way
   Messages draws it, and the conversation identifier is the one the car's
   list and the Intents extension already use, so "reply" after the
   announcement lands in the same thread.

   Everything it needs is already in the push: the title is the sender's
   display name, the body is the message, and `data` carries
   `conversationId` and `senderId` (`apps/api/src/ws/fanOut.ts`). Expo puts
   `data` under the `body` key of the APNs payload, which is why it is read
   from there first.

   Any other kind of push, or one missing a field, is delivered as it came.
   So is one iOS refuses to rebuild — the app then lacks the Communication
   Notifications capability, and a plain notification is still a notification.
  */
  private func communicate(
    _ request: UNNotificationRequest,
    _ content: UNMutableNotificationContent,
    done: @escaping (UNNotificationContent) -> Void
  ) {
    let payload = request.content.userInfo
    let data = (payload["body"] as? [String: Any]) ?? (payload as? [String: Any]) ?? [:]
    guard data["kind"] as? String == "message",
      let conversationId = data["conversationId"] as? String,
      let senderId = data["senderId"] as? String,
      !content.title.isEmpty
    else {
      done(content)
      return
    }

    /*
     The car's list, and what Siri reads from it, learn about the message from
     the same push that announces it — otherwise tapping the row Siri just
     announced would read the one before. See `ConversationDirectory`.
    */
    ConversationDirectory.recordIncoming(
      conversationId: conversationId, name: content.title, preview: content.body)

    let sender = INPerson(
      personHandle: INPersonHandle(value: senderId, type: .unknown),
      nameComponents: nil,
      displayName: content.title,
      image: nil,
      contactIdentifier: nil,
      // The conversation, as `targets/intents/MessagingHandler.swift` reads a
      // person's custom identifier — so a reply resolves without a name.
      customIdentifier: conversationId)

    let intent = INSendMessageIntent(
      recipients: nil,
      outgoingMessageType: .outgoingMessageText,
      content: content.body,
      speakableGroupName: nil,
      conversationIdentifier: conversationId,
      serviceName: nil,
      sender: sender,
      attachments: nil)

    let interaction = INInteraction(intent: intent, response: nil)
    interaction.direction = .incoming
    interaction.donate { _ in
      done((try? content.updating(from: intent)) ?? content)
    }
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
