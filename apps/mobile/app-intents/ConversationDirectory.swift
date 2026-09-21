import AppIntents
import Foundation

/**
 The people an intent may be asked to open a conversation with.

 The app writes this while somebody is signed in and removes it with the
 session; `packages/shared/src/companion.ts` is the one definition of the
 shape and this decodes it rather than restating it. An absent or unreadable
 blob is an empty list, which is the honest answer for a phone nobody has
 signed in on — the picker is empty and Siri matches nothing, rather than an
 intent failing in a way the person has to interpret.

 It is a separate key from the widget snapshot on purpose. That one is
 numbers and these are other people's names; see the schema for the rest of
 the argument.
 */
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
  }

  static func load() -> [ConversationEntity] {
    guard
      let json = UserDefaults(suiteName: appGroup)?.string(forKey: key),
      let data = json.data(using: .utf8),
      let blob = try? JSONDecoder().decode(Blob.self, from: data)
    else { return [] }

    return blob.conversations.map { ConversationEntity(id: $0.id, name: $0.name) }
  }
}

/**
 One conversation, as something Siri and the Shortcuts app can name.

 The `id` is the conversation's, because that is what the route needs, and the
 display representation is the other person's name, because that is what
 somebody says out loud. Nothing else travels: an entity is a handle for
 picking, not a copy of the thread.
 */
@available(iOS 16.0, *)
struct ConversationEntity: AppEntity, Identifiable {
  let id: String
  let name: String

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "intents.conversationType"
  static var defaultQuery = ConversationQuery()

  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(name)") }
}

/**
 How the system finds a conversation to hand the intent.

 `EntityStringQuery` rather than plain `EntityQuery`, and that is the half
 that makes speech work: `entities(matching:)` is what turns "the chat with
 Mateo" into an entity. Without it the action exists and can only be filled in
 by tapping a name in the Shortcuts app.

 `suggestedEntities` is what the picker lists, and it is the same twenty the
 app wrote — Apple needs a finite list to match a spoken phrase against, which
 is the reason `COMPANION_DIRECTORY_LIMIT` exists at all.

 The matching is case- and diacritic-insensitive because it is matching
 speech: somebody saying a name is not spelling it, and `José` and `jose` are
 the same person asked for twice.
 */
@available(iOS 16.0, *)
struct ConversationQuery: EntityStringQuery {
  func entities(for identifiers: [ConversationEntity.ID]) async throws -> [ConversationEntity] {
    ConversationDirectory.load().filter { identifiers.contains($0.id) }
  }

  func entities(matching string: String) async throws -> [ConversationEntity] {
    ConversationDirectory.load().filter {
      $0.name.range(of: string, options: [.caseInsensitive, .diacriticInsensitive]) != nil
    }
  }

  func suggestedEntities() async throws -> [ConversationEntity] {
    ConversationDirectory.load()
  }
}
