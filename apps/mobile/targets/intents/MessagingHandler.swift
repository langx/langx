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
    let conversations = ConversationDirectory.load()

    /*
     A reply to a conversation the car handed Siri — a `CPMessageListItem`
     tapped, read, then answered — arrives carrying that conversation's
     identifier and no recipients at all. Siri leaves filling them in to us.

     It is resolved to the person, not waved through as `notRequired`, which
     is what this did at first. That kept Siri from asking "to whom?", but it
     also left the confirmation with nobody to address: the first drive with
     it, on 23 September, got a bare "send it?" with neither the name nor the
     dictated words on it — a message confirmed blind. With a recipient Siri
     has the sheet it draws for every message: to whom, and what it says.
    */
    if let identifier = intent.conversationIdentifier,
      let conversation = conversations.first(where: { $0.id == identifier })
    {
      completion([
        INSendMessageRecipientResolutionResult.success(
          with: MessagingHandler.person(for: conversation))
      ])
      return
    }

    guard let recipients = intent.recipients, !recipients.isEmpty else {
      completion([INSendMessageRecipientResolutionResult.needsValue()])
      return
    }

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

   **Everything that is waiting, up to five per conversation, fetched when
   asked.** The directory holds one line per conversation — it is the chat
   list, not a history — so reading from it alone meant three messages sent
   while somebody drove were heard as the last one. After the 23 September
   drive the ask was exactly that: tapping a person should say what they
   said, all of it. So an unread conversation asks the server for its newest
   messages, as many as are waiting and no more than `maxRead`, and hands
   Siri the ones that have words; a photo or a voice note has nothing to read
   aloud and is skipped rather than announced as a blank.

   **The directory's line is the fallback, not a second opinion.** No signal,
   a slow answer, a thread with nothing but pictures in its unread stretch —
   each ends in what the phone last wrote, which is what this said before and
   is never nothing. A conversation with nothing unread is only ever that
   line: its newest message may be the driver's own, and Siri would read it
   out as the other person's.
  */
  func handle(
    intent: INSearchForMessagesIntent,
    completion: @escaping (INSearchForMessagesIntentResponse) -> Void
  ) {
    /*
     Asked about particular conversations — which is what a tap on a car row
     is — the answer is those conversations, read or not: the driver chose
     one, and "no new messages" about the thread they are looking at would be
     a strange thing to hear. Asked in general, "read my messages", the answer
     is what is waiting.
    */
    let requested = Set(intent.conversationIdentifiers ?? [])
    let conversations = ConversationDirectory.load()
      .filter { requested.isEmpty ? $0.unread > 0 : requested.contains($0.id) }

    let group = DispatchGroup()
    let lock = NSLock()
    var fetched: [String: [IntentSession.RemoteMessage]] = [:]

    for conversation in conversations where conversation.unread > 0 {
      group.enter()
      IntentSession.recentMessages(
        conversationId: conversation.id, limit: min(conversation.unread, MessagingHandler.maxRead)
      ) { messages in
        let readable = (messages ?? []).filter {
          $0.deleted != true && $0.hidden != true
            && !$0.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        lock.lock()
        if !readable.isEmpty { fetched[conversation.id] = readable }
        lock.unlock()
        group.leave()
      }
    }

    group.notify(queue: .main) {
      let messages = conversations.flatMap { conversation -> [INMessage] in
        if let remote = fetched[conversation.id] {
          return remote.map { MessagingHandler.message($0, in: conversation) }
        }
        guard let preview = conversation.preview else { return [] }
        return [
          MessagingHandler.message(
            identifier: MessagingHandler.messageIdentifier(for: conversation.id, message: "last"),
            content: preview, sent: conversation.at, in: conversation)
        ]
      }

      let response = INSearchForMessagesIntentResponse(code: .success, userActivity: nil)
      response.messages = messages
      completion(response)
    }
  }

  /// Enough to catch up on a short burst, few enough to still be listening to
  /// at a red light — and a longer backlog is what the phone is for.
  private static let maxRead = 5

  private static func message(
    _ remote: IntentSession.RemoteMessage, in conversation: DirectoryConversation
  ) -> INMessage {
    message(
      identifier: messageIdentifier(for: conversation.id, message: remote._id),
      content: remote.body, sent: instants.date(from: remote.createdAt), in: conversation)
  }

  /*
   With its conversation's identifier, so that Siri's "Reply?" after reading
   it comes back as an `INSendMessageIntent` for this thread.
  */
  private static func message(
    identifier: String, content: String, sent: Date?, in conversation: DirectoryConversation
  ) -> INMessage {
    INMessage(
      identifier: identifier,
      conversationIdentifier: conversation.id,
      content: content,
      dateSent: sent,
      sender: person(for: conversation),
      recipients: nil,
      groupName: nil,
      messageType: .text,
      serviceName: nil)
  }

  /// `createdAt` as the API writes it — `toISOString()`, milliseconds and all.
  private static let instants: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

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
        // Read on the server, so read in the car too — or its unread dot would
        // make the next tap read it aloud again instead of offering a reply.
        if ok { ConversationDirectory.recordRead(conversationIds: [conversationId]) }
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
    // The car's own conversation, when the reply started from one.
    if let identifier = intent.conversationIdentifier,
      ConversationDirectory.load().contains(where: { $0.id == identifier })
    {
      return identifier
    }
    guard let recipient = intent.recipients?.first else { return nil }
    if let identifier = recipient.customIdentifier { return identifier }
    return matches(for: recipient, in: ConversationDirectory.load()).first?.id
  }

  /// A message handed to Siri, named so its conversation can be found again
  /// when Siri marks it read: the thread before the colon, the message after.
  private static func messageIdentifier(for conversationId: String, message: String) -> String {
    "\(conversationId):\(message)"
  }

  private static func conversationId(fromMessage identifier: String) -> String? {
    let conversationId = identifier.split(separator: ":").first.map(String.init)
    return conversationId?.isEmpty == false ? conversationId : nil
  }
}
