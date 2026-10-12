import Intents

/**
 What Siri talks to.

 An Intents extension is handed an intent and asks this class for an object
 that knows how to answer it. `MessagingHandler` answers three of them, which
 are one feature: the car sends a message, finds the ones that arrived, and
 marks them read. `CallingHandler` answers the fourth, starting a call, which
 Apple requires of a CarPlay app that places VoIP calls.

 Returning the same handler for an intent it does not implement would be a
 crash at the moment Siri asks, so the type is checked rather than assumed.
 The `Info.plist` beside this file is the other half of that contract: it
 names exactly the four.
 */
final class IntentHandler: INExtension {
  private let messaging = MessagingHandler()
  private let calling = CallingHandler()

  override func handler(for intent: INIntent) -> Any? {
    switch intent {
    case is INSendMessageIntent, is INSearchForMessagesIntent, is INSetMessageAttributeIntent:
      return messaging
    case is INStartCallIntent:
      return calling
    default:
      return nil
    }
  }
}
