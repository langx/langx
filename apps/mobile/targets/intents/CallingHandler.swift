import Foundation
import Intents

/**
 "Call Maria on LangX", from the car or from Siri anywhere else.

 Apple requires it of a CarPlay communication app that places VoIP calls: 2.9
 was rejected under guideline 2.1(a) for supporting CallKit and the messaging
 intents but not `INStartCallIntent`.

 **The call itself is placed by the app, not here.** An Intents extension has
 no media engine and no socket, and a call is both. So this resolves the
 person exactly as `MessagingHandler` resolves a recipient — the same
 directory, the same rule that nothing is guessed — then leaves a route in the
 App Group and answers `continueInApp`. iOS opens the app, `usePendingRoute`
 collects `/chat/<id>?call=…`, and the thread places the call through the same
 gate its call button uses, so a thread that is still locked says so rather
 than ringing.
 */
final class CallingHandler: NSObject, INStartCallIntentHandling {
  func resolveContacts(
    for intent: INStartCallIntent,
    with completion: @escaping ([INStartCallContactResolutionResult]) -> Void
  ) {
    guard let contacts = intent.contacts, !contacts.isEmpty else {
      completion([INStartCallContactResolutionResult.needsValue()])
      return
    }

    // One person per call: a LangX call is between two people.
    let conversations = ConversationDirectory.load()
    let matches = MessagingHandler.matches(for: contacts[0], in: conversations)
    switch matches.count {
    case 0:
      completion([INStartCallContactResolutionResult.unsupported(forReason: .noContactFound)])
    case 1:
      completion([
        INStartCallContactResolutionResult.success(
          with: MessagingHandler.person(for: matches[0]))
      ])
    default:
      completion([
        INStartCallContactResolutionResult.disambiguation(
          with: matches.map(MessagingHandler.person))
      ])
    }
  }

  /// A voice call unless video was asked for — and never video in a car,
  /// where Siri does not ask for it.
  func resolveCallCapability(
    for intent: INStartCallIntent,
    with completion: @escaping (INStartCallCallCapabilityResolutionResult) -> Void
  ) {
    let capability: INCallCapability =
      intent.callCapability == .videoCall ? .videoCall : .audioCall
    completion(INStartCallCallCapabilityResolutionResult.success(with: capability))
  }

  func handle(
    intent: INStartCallIntent, completion: @escaping (INStartCallIntentResponse) -> Void
  ) {
    guard let contact = intent.contacts?.first,
      let conversationId = contact.customIdentifier
        ?? MessagingHandler.matches(for: contact, in: ConversationDirectory.load()).first?.id
    else {
      completion(INStartCallIntentResponse(code: .failure, userActivity: nil))
      return
    }

    let media = intent.callCapability == .videoCall ? "video" : "audio"
    PendingRoute.write("/chat/\(conversationId)?call=\(media)")

    let activity = NSUserActivity(activityType: NSStringFromClass(INStartCallIntent.self))
    completion(INStartCallIntentResponse(code: .continueInApp, userActivity: activity))
  }
}
