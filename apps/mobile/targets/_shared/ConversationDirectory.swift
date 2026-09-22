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
}
