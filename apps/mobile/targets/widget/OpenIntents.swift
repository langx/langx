import AppIntents

/**
 "Open my review" — the first of the plan's three intents.

 It routes and nothing else, which is the whole reason it can exist without
 any of the machinery the third one needs: no account is read, no network is
 touched, and the app does the rest exactly as it does when the widget is
 tapped.

 **Why this lives in the widget extension.** App Intents are found through
 metadata a build step extracts, and that step runs for an app or an
 extension — **not** for the static library a CocoaPods-based Expo module
 compiles into. An intent declared in a module builds, links, and is then
 invisible to Shortcuts, to Siri and to the Action Button, with nothing
 anywhere to say why. The extension is the one target in this project that
 already compiles Swift *and* already carries the string catalogue these
 titles come from; putting them in the app target instead would mean teaching
 a config plugin to add both, which was tried first and is a great deal of
 machinery for the same result.

 `openAppWhenRun` from an extension opens the extension's containing app,
 which is the app.

 `openAppWhenRun` is the honest setting: this is an "open something" action
 and there is nothing to report back. A parameterised summary would promise a
 result it does not produce.
 */
@available(iOS 16.0, *)
struct OpenEchoReviewIntent: AppIntent {
  static var title: LocalizedStringResource = "intents.openEcho"
  static var description = IntentDescription("intents.openEchoDetail")
  static var openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult {
    PendingRoute.write("/echo")
    return .result()
  }
}

/**
 "Open my messages".

 The second of the three in everything but its parameter: the plan asks for
 *a named conversation*, which needs a directory of names in the App Group
 and an `AppEntity` to resolve against it. This is the half that needs
 neither, and it is worth having on its own — the Action Button's most useful
 setting for a messaging app is the one that opens the messages.
 */
@available(iOS 16.0, *)
struct OpenChatsIntent: AppIntent {
  static var title: LocalizedStringResource = "intents.openChats"
  static var description = IntentDescription("intents.openChatsDetail")
  static var openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult {
    PendingRoute.write("/chats")
    return .result()
  }
}
