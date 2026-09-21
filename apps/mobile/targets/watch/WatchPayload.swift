import Foundation

/**
 The watch's reader for what the phone sends.

 Mirrors `watchPayloadSchema` in `packages/shared/src/watch.ts`, which is the
 definition; this is a reader of it. The same rule the widget's
 `CompanionSnapshot` follows applies and bites harder here: anything added
 there has to be optional on this side until a build carrying both has
 shipped, because watchOS installs app updates on its own schedule and a watch
 can run weeks behind the phone it is paired to.

 Only the watch app reads this, so it lives beside it rather than in
 `targets/_shared` — that directory is copied into every target, and the
 phone's widget has no use for a list of conversations.
 */
struct WatchPayload: Codable {
  /// Must match `WATCH_PAYLOAD_VERSION`.
  static let version = 1

  struct Message: Codable, Identifiable {
    let id: String
    let body: String
    /// Whose it is, so a thread reads without a name on every row.
    let mine: Bool
    let at: String
  }

  struct Conversation: Codable, Identifiable {
    let id: String
    let name: String
    let unread: Int
    let messages: [Message]
  }

  let version: Int
  let writtenAt: String
  let conversations: [Conversation]
  /**
   The streak, for the complication.

   Optional here and optional in the schema, and the obligation is the one at
   the top of this file: watchOS installs the watch app on its own schedule,
   so a watch running yesterday's build can be handed a payload carrying this
   and a watch running today's can be handed one without. The complication
   falls back to the unread count, which every payload has.
  */
  let streak: Int?

  /**
   Decode what arrived, or nil.

   Nil covers three different things on purpose — nothing has been sent yet, a
   blob from a newer phone build than this watch understands, and the empty
   string the phone sends on sign-out — because the watch's answer to all
   three is the same: do not trust this screen, go and look at the phone. An
   empty `conversations` list is a *different* answer and means nothing is
   unread, which is why it is not folded in here.
  */
  static func decode(_ json: String) -> WatchPayload? {
    guard !json.isEmpty, let data = json.data(using: .utf8),
      let payload = try? JSONDecoder().decode(WatchPayload.self, from: data),
      payload.version == version
    else { return nil }
    return payload
  }
}
