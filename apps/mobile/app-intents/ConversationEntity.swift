import AppIntents
import Foundation

/**
 One conversation, as something Siri and the Shortcuts app can name.

 The `id` is the conversation's, because that is what the route needs, and the
 display representation is the other person's name, because that is what
 somebody says out loud. Nothing else travels: an entity is a handle for
 picking, not a copy of the thread — which is why the unread count and the
 preview the car uses stop at `DirectoryConversation`.
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
    ConversationDirectory.load()
      .filter { identifiers.contains($0.id) }
      .map { ConversationEntity(id: $0.id, name: $0.name) }
  }

  func entities(matching string: String) async throws -> [ConversationEntity] {
    ConversationDirectory.load()
      .filter { $0.name.range(of: string, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
      .map { ConversationEntity(id: $0.id, name: $0.name) }
  }

  func suggestedEntities() async throws -> [ConversationEntity] {
    ConversationDirectory.load().map { ConversationEntity(id: $0.id, name: $0.name) }
  }
}
