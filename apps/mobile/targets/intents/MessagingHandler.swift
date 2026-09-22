import Foundation
import Intents

/**
 Answering from the car, which is the half of CarPlay that cannot be drawn.

 A CarPlay communication app never draws a keyboard — Apple does not allow
 one while driving — so a reply is dictated to Siri, and Siri delivers it here
 as an `INSendMessageIntent`. The same rule is why this extension also answers
 `INSearchForMessagesIntent`: "read my messages" is Siri reading what this
 hands back, rather than the app reading anything itself.

 **The directory is the whole address book.** A spoken name is matched against
 the twenty conversations the app last had on screen, decoded by the same
 `ConversationDirectory` the car screen and the App Intents use. Somebody who
 has never opened the app has an empty one, and every answer below is then
 "not now, open the app" — which is honest, and better than Siri inventing a
 recipient.

 **Nothing is guessed.** One match sends, several ask Siri to disambiguate,
 none is unsupported. An intent handler that picked the first of two people
 called Maria would be a message sent to the wrong person while somebody is
 driving and cannot see it happen.
 */
final class MessagingHandler: NSObject, INSendMessageIntentHandling,
  INSearchForMessagesIntentHandling, INSetMessageAttributeIntentHandling
{
  // MARK: - Sending

  func resolveRecipients(
    for intent: INSendMessageIntent,
    with completion: @escaping ([INSendMessageRecipientResolutionResult]) -> Void
  ) {
    guard let recipients = intent.recipients, !recipients.isEmpty else {
      completion([INSendMessageRecipientResolutionResult.needsValue()])
      return
    }

    let conversations = ConversationDirectory.load()
    completion(
      recipients.map { recipient in
        let matches = MessagingHandler.matches(for: recipient, in: conversations)
        switch matches.count {
        case 0:
          return INSendMessageRecipientResolutionResult.unsupported(forReason: .noHandleForLabel)
        case 1:
          return INSendMessageRecipientResolutionResult.success(
            with: MessagingHandler.person(for: matches[0]))
        default:
          return INSendMessageRecipientResolutionResult.disambiguation(
            with: matches.map(MessagingHandler.person))
        }
      })
  }

  func resolveContent(
    for intent: INSendMessageIntent, with completion: @escaping (INStringResolutionResult) -> Void
  ) {
    guard let content = intent.content, !content.isEmpty else {
      completion(INStringResolutionResult.needsValue())
      return
    }
    completion(INStringResolutionResult.success(with: content))
  }

  /**
   Whether this can be done at all, asked before the words are dictated.

   `failureRequiringAppLaunch` rather than `failure` when there is no
   credential, because the two are different sentences from Siri and only one
   of them is true: nobody is signed in on this phone, and the fix is to open
   the app rather than to try again.
  */
  func confirm(
    intent: INSendMessageIntent, completion: @escaping (INSendMessageIntentResponse) -> Void
  ) {
    let code: INSendMessageIntentResponseCode =
      IntentSession.credentials() == nil ? .failureRequiringAppLaunch : .ready
    completion(INSendMessageIntentResponse(code: code, userActivity: nil))
  }

  func handle(
    intent: INSendMessageIntent, completion: @escaping (INSendMessageIntentResponse) -> Void
  ) {
    guard let content = intent.content, !content.isEmpty,
      let conversationId = MessagingHandler.conversationId(for: intent)
    else {
      completion(INSendMessageIntentResponse(code: .failure, userActivity: nil))
      return
    }

    /*
     A fresh id per attempt, unlike the watch's, which is minted on the wrist
     and reused across retries. Siri does not retry a handled intent: it tells
     the person it failed and they say it again, which is a new message and
     should be one.
    */
    IntentSession.send(
      conversationId: conversationId, body: content, clientId: UUID().uuidString
    ) { sent in
      completion(
        INSendMessageIntentResponse(code: sent ? .success : .failure, userActivity: nil))
    }
  }

  // MARK: - Reading

  /**
   What arrived, for Siri to read out.

   Only conversations with something unread, and only the one line each that
   the phone last wrote — this blob is the chat list, not a history. It is the
   same line the car draws and the watch shows, chosen by `previewFor` on the
   server, so a photo is "📷 Photo" here as well.
  */
  func handle(
    intent: INSearchForMessagesIntent,
    completion: @escaping (INSearchForMessagesIntentResponse) -> Void
  ) {
    let messages = ConversationDirectory.load()
      .filter { $0.unread > 0 }
      .compactMap { conversation -> INMessage? in
        guard let preview = conversation.preview else { return nil }
        return INMessage(
          identifier: MessagingHandler.messageIdentifier(for: conversation.id),
          content: preview,
          dateSent: conversation.at,
          sender: MessagingHandler.person(for: conversation),
          recipients: nil)
      }

    let response = INSearchForMessagesIntentResponse(code: .success, userActivity: nil)
    response.messages = messages
    completion(response)
  }

  /**
   "Mark them as read", which is the only attribute worth answering.

   The identifiers are the ones handed out above, so the conversation is the
   part before the colon. Several can arrive at once — Siri reads a batch and
   then marks the batch — so the answer waits for all of them and is a failure
   if any failed, which is the only claim that is true of a partial success.
  */
  func handle(
    intent: INSetMessageAttributeIntent,
    completion: @escaping (INSetMessageAttributeIntentResponse) -> Void
  ) {
    let conversations = Set(
      (intent.identifiers ?? []).compactMap(MessagingHandler.conversationId(fromMessage:)))

    guard intent.attribute == .read, !conversations.isEmpty else {
      completion(INSetMessageAttributeIntentResponse(code: .failure, userActivity: nil))
      return
    }

    let group = DispatchGroup()
    var failed = false
    let lock = NSLock()

    for conversationId in conversations {
      group.enter()
      IntentSession.markRead(conversationId: conversationId) { ok in
        lock.lock()
        failed = failed || !ok
        lock.unlock()
        group.leave()
      }
    }

    group.notify(queue: .main) {
      completion(
        INSetMessageAttributeIntentResponse(code: failed ? .failure : .success, userActivity: nil))
    }
  }

  // MARK: - Names and ids

  /**
   A spoken name against the names the app drew.

   Case- and diacritic-insensitive for the reason `ConversationQuery` gives:
   somebody saying a name is not spelling it. A recipient Siri has already
   resolved carries the conversation id as its `customIdentifier`, so that is
   checked first — it is the one match that cannot be ambiguous.
  */
  private static func matches(
    for recipient: INPerson, in conversations: [DirectoryConversation]
  ) -> [DirectoryConversation] {
    if let identifier = recipient.customIdentifier,
      let exact = conversations.first(where: { $0.id == identifier })
    {
      return [exact]
    }

    let spoken = recipient.displayName
    guard !spoken.isEmpty else { return [] }
    return conversations.filter {
      $0.name.range(of: spoken, options: [.caseInsensitive, .diacriticInsensitive]) != nil
    }
  }

  private static func person(for conversation: DirectoryConversation) -> INPerson {
    INPerson(
      personHandle: INPersonHandle(value: conversation.id, type: .unknown),
      nameComponents: nil,
      displayName: conversation.name,
      image: nil,
      contactIdentifier: nil,
      customIdentifier: conversation.id)
  }

  private static func conversationId(for intent: INSendMessageIntent) -> String? {
    guard let recipient = intent.recipients?.first else { return nil }
    if let identifier = recipient.customIdentifier { return identifier }
    return matches(for: recipient, in: ConversationDirectory.load()).first?.id
  }

  /// The one message a conversation has here, named so it can be found again.
  private static func messageIdentifier(for conversationId: String) -> String {
    "\(conversationId):last"
  }

  private static func conversationId(fromMessage identifier: String) -> String? {
    let conversationId = identifier.split(separator: ":").first.map(String.init)
    return conversationId?.isEmpty == false ? conversationId : nil
  }
}
