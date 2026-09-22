import Intents

/**
 What Siri talks to.

 An Intents extension is handed an intent and asks this class for an object
 that knows how to answer it. There is one such object here — `MessagingHandler`
 — because the three intents this extension declares are one feature: the car
 sends a message, finds the ones that arrived, and marks them read.

 Returning the same handler for an intent it does not implement would be a
 crash at the moment Siri asks, so the type is checked rather than assumed.
 The `Info.plist` beside this file is the other half of that contract: it
 names exactly the three.
 */
final class IntentHandler: INExtension {
  private let messaging = MessagingHandler()

  override func handler(for intent: INIntent) -> Any? {
    switch intent {
    case is INSendMessageIntent, is INSearchForMessagesIntent, is INSetMessageAttributeIntent:
      return messaging
    default:
      return nil
    }
  }
}
