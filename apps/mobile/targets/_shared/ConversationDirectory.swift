import Foundation

/**
 The conversations the app last had on screen, as everything else in this
 binary can read them.

 **In `targets/_shared/` because it now has four readers**, and two of them
 are other processes: the App Intents query and the CarPlay scene inside the
 app, and the Intents extension that answers Siri. `@bacons/apple-targets`
 puts this folder in the app target's membership and in every extension's, so
 there is one decoder rather than one per process — which is what keeps a
 field added to the blob from meaning something different in two of them.

 The app writes this while somebody is signed in and removes it with the
 session; `packages/shared/src/companion.ts` is the one definition of the
 shape and this decodes it rather than restating it. An absent or unreadable
 blob is an empty list, which is the honest answer for a phone nobody has
 signed in on — the picker is empty, Siri matches nothing and the car says to
 go and open the app, rather than an intent failing in a way the person has to
 interpret.

 It is a separate key from the widget snapshot on purpose. That one is
 numbers and these are other people's names; see the schema for the rest of
 the argument.

 **Everything past `id` and `name` is optional here although the schema calls
 it required.** The four fields the car draws were added on 22 September, and
 a blob written by the build before that one outlives it: somebody updates the
 app, never opens it, and connects a car the next morning. A reader that
 insisted would decode nothing at all and show an empty list, which is the one
 answer that is wrong.
 */
struct DirectoryConversation {
  let id: String
  let name: String
  let unread: Int
  /// "3 new", already in the reader's language — see the schema for why the
  /// words are written by the app rather than chosen here.
  let unreadLabel: String?
  let at: Date?
  /// The chat list's own one line, which is what CarPlay reads aloud.
  let preview: String?
}

enum ConversationDirectory {
  /// Must match `app.config.ts` and `CompanionSnapshotModule.appGroup`.
  private static let appGroup = "group.tech.newchapter.languageXchange"
  /// Must match `CompanionSnapshotModule.directoryKey`.
  private static let key = "companionDirectory"

  private struct Blob: Decodable {
    let conversations: [Entry]
  }

  private struct Entry: Decodable {
    let id: String
    let name: String
    let unread: Int?
    let unreadLabel: String?
    let at: String?
    let preview: String?
  }

  /**
   The written instant, parsed the way JavaScript writes it.

   `toISOString()` always has milliseconds, which the plain internet date-time
   option rejects — the failure is a nil date and a row with no time under it,
   not an error anybody would see.
  */
  private static let instants: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

  /// The blob as it was written, for a reader that wants to know whether it
  /// has changed without decoding it — see `CarPlayScene`.
  static func blob() -> String? {
    UserDefaults(suiteName: appGroup)?.string(forKey: key)
  }

  static func load(_ json: String? = blob()) -> [DirectoryConversation] {
    guard
      let json,
      let data = json.data(using: .utf8),
      let blob = try? JSONDecoder().decode(Blob.self, from: data)
    else { return [] }

    return blob.conversations.map { entry in
      DirectoryConversation(
        id: entry.id,
        name: entry.name,
        unread: entry.unread ?? 0,
        unreadLabel: entry.unreadLabel,
        at: entry.at.flatMap { instants.date(from: $0) },
        preview: entry.preview
      )
    }
  }

  // MARK: - Writes from outside the app

  /**
   Posted across processes whenever something other than the app rewrites the
   blob. `UserDefaults.didChangeNotification` only reaches the process that
   wrote, and the writers below are the notification service extension and
   the Intents extension — neither of them the app the CarPlay scene lives in.
   */
  static let changedNotification = "tech.newchapter.languageXchange.directoryChanged"

  /// Must match `COMPANION_DIRECTORY_LIMIT` in `packages/shared/src/companion.ts`.
  private static let limit = 20

  /**
   A message the phone has only seen as a push.

   **Why a push writes here at all.** The app writes this blob when it is
   running, and on a drive it usually is not: the car's list and everything
   Siri reads from it would be as old as the last time somebody opened the
   app, while the announcement of the new message — which comes from the
   notification — is fresh. Tapping the row Siri had just announced would
   read the message *before* it. The push already carries everything a row
   needs: who (the title), which conversation, and the one line.

   The conversation moves to the top, as it does in the app; its preview and
   time are the new message's; its unread count goes up by one. Its "3 new"
   phrase is **removed rather than kept**, because Swift cannot write the next
   one — no catalogues, no plural rules — and a phrase that says 2 when there
   are 3 is worse than the unread dot alone. The app puts it back on its next
   write, which replaces all of this anyway.

   Edited as loose JSON, the way the widget snapshot is, so an extension older
   than the app never drops a field it has not learned about. **No blob, no
   write**: an absent blob means nobody is signed in, and a push must not
   conjure a list for a phone that has none.
   */
  static func recordIncoming(conversationId: String, name: String, preview: String) {
    edit { list in
      var entry =
        list.first(where: { $0["id"] as? String == conversationId })
        ?? ["id": conversationId, "name": name]
      list.removeAll { $0["id"] as? String == conversationId }
      entry["unread"] = ((entry["unread"] as? Int) ?? 0) + 1
      entry.removeValue(forKey: "unreadLabel")
      entry["preview"] = preview
      entry["at"] = instants.string(from: Date())
      list.insert(entry, at: 0)
      if list.count > limit { list.removeLast(list.count - limit) }
    }
  }

  /**
   Conversations Siri has just marked read, on the server as well.

   Without it the car would keep drawing their unread dots — and CarPlay
   decides from that dot what a tap does, so a thread already read aloud
   would be read aloud again instead of offering a reply.
   */
  static func recordRead(conversationIds: Set<String>) {
    edit { list in
      for index in list.indices where conversationIds.contains(list[index]["id"] as? String ?? "") {
        list[index]["unread"] = 0
        list[index].removeValue(forKey: "unreadLabel")
      }
    }
  }

  private static func edit(_ change: (inout [[String: Any]]) -> Void) {
    guard let defaults = UserDefaults(suiteName: appGroup),
      let json = defaults.string(forKey: key),
      let data = json.data(using: .utf8),
      var blob = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      var list = blob["conversations"] as? [[String: Any]]
    else { return }

    change(&list)
    blob["conversations"] = list
    blob["writtenAt"] = instants.string(from: Date())

    guard let updated = try? JSONSerialization.data(withJSONObject: blob),
      let string = String(data: updated, encoding: .utf8)
    else { return }
    defaults.set(string, forKey: key)

    CFNotificationCenterPostNotification(
      CFNotificationCenterGetDarwinNotifyCenter(),
      CFNotificationName(changedNotification as CFString),
      nil, nil, true)
  }
}
