import CarPlay
import UIKit

/**
 The chat list, on a car screen — and Siri for everything said out loud.

 **Why this is Swift and not JavaScript.** `react-native-carplay` renders
 Apple's templates from the JS side, which would have reused the socket, the
 cookie, the API client and the catalogues the app already has. It does not
 link: it mounts React through `RCTRootContentView`, which the New
 Architecture removed. The record is in
 `docs/plans/iphone-watch-and-carplay.md` → _Phase 0 ran on 21 September_.

 What made the native branch cheap is that the four things the plan said would
 have to be rebuilt in Swift were built for the watch first: a blob the app
 writes into the App Group, a REST twin of `message:send`, a string catalogue
 the app target compiles, and one definition of the payload shape. This file
 is the fourth reader of the first of those, not a second copy of the app.

 **Every row is a `CPMessageListItem`, which means this file never hears a
 tap.** That is Apple's arrangement for messaging apps, and the reason for it
 is the rule it enforces: message text is not allowed on the CarPlay screen.
 Selecting an unread conversation hands Siri its identifier and Siri reads it
 — through `INSearchForMessagesIntent` in `targets/intents/` — then offers a
 reply, dictated, which arrives there as `INSendMessageIntent`. Selecting a
 read one goes straight to a dictated reply. The compose button in the bar
 starts a new message the same way.

 It replaced, on 23 September, a version that spoke messages itself with
 `AVSpeechSynthesizer`. That one stayed silent in the first car it reached,
 answered a tap with nothing, and then — asked to open the conversation —
 would have needed a screen with the message on it, which Apple does not
 permit. Siri already does all three properly.

 **It draws what the phone last wrote.** Connecting a car creates a
 `CPTemplateApplicationScene`, not a window scene, and `ExpoAppSceneDelegate`
 starts React Native for window scenes only. So on a drive where the app is
 never opened the list is as fresh as the last time somebody looked at their
 phone — the bargain the widgets and the watch make too. What it gets for
 free is living in the app's *process*: when the app is open, the write that
 feeds the widgets reaches this scene as a notification and the list updates
 while it is on screen. A message that arrives mid-drive is announced by Siri
 from the notification rather than by this list; see
 `targets/notification-service/`.
 */
@available(iOS 14.0, *)
@objc(CarPlaySceneDelegate)
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
  private var interfaceController: CPInterfaceController?
  /*
   The chat tab's own name, as the watch's list is titled — not the app's.
   The first car it was seen in, on 23 September, drew "LangX" as a large
   heading beside the app's own icon in the rail: the brand twice, and the
   one word that says what this screen is nowhere.
  */
  private let list: CPListTemplate = {
    let list = CPListTemplate(title: String(localized: "tabs.chats"), sections: [])
    /*
     A new message by voice, from the car's own compose button: it has no
     handler of its own — tapping it starts Siri's compose flow, which ends
     in the same `INSendMessageIntent` a reply does.
    */
    list.trailingNavigationBarButtons = [CPMessageComposeBarButton()]
    return list
  }()
  private var writes: NSObjectProtocol?
  /*
   What is on the screen, so an unrelated write does not redraw it.

   `UserDefaults.didChangeNotification` is posted for the whole process, and
   this app writes defaults for reasons that have nothing to do with the car;
   redrawing twenty rows for each of them would be waste on a screen somebody
   is glancing at while driving.
  */
  private var drawn: String?
  private var everDrawn = false

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    reload()

    /*
     The app and this scene are one process, so the defaults it writes are the
     defaults this reads and the change notification arrives here. Without it
     a list drawn when the car connected would stay as it was for the length
     of the drive, including after the person read something on their phone at
     a red light.
    */
    writes = NotificationCenter.default.addObserver(
      forName: UserDefaults.didChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.reload()
    }

    interfaceController.setRootTemplate(list, animated: false, completion: nil)
  }

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didDisconnectInterfaceController interfaceController: CPInterfaceController
  ) {
    self.interfaceController = nil
    if let writes { NotificationCenter.default.removeObserver(writes) }
    writes = nil
  }

  /**
   Three states, the same three every other companion surface has.

   **No blob** means nobody is signed in on this phone, or the app has never
   run since it was installed, and the answer is to go and open it — not an
   empty list, which would say there is nobody to talk to. **An empty list**
   means the account has no conversations. **Rows** is the ordinary case.
  */
  private func reload() {
    let blob = ConversationDirectory.blob()
    guard !everDrawn || blob != drawn else { return }
    drawn = blob
    everDrawn = true

    let conversations = ConversationDirectory.load(blob)

    if conversations.isEmpty {
      let placeholder = CPListItem(
        text: String(localized: "chats.emptyTitle"),
        detailText: String(localized: "watch.openOnPhone")
      )
      /*
       A row that does nothing still has to say it did: CarPlay leaves the
       spinner on the row for ever if the handler never calls back.
      */
      placeholder.handler = { _, completion in completion() }
      list.updateSections([CPListSection(items: [placeholder])])
      return
    }

    list.updateSections([CPListSection(items: conversations.map(row))])
  }

  /**
   One conversation, as Siri will be handed it.

   The identifier is the conversation's, and it comes back to the Intents
   extension as `conversationIdentifiers` when Siri reads and as
   `conversationIdentifier` when it replies — which is how both land in this
   thread rather than in whichever one a spoken name happens to match.

   `unread` is not decoration: CarPlay draws the dot from it **and** decides
   from it what a tap does — read the conversation when there is something to
   read, compose a reply when there is not.

   Under the name is what is waiting, "3 new", as a phrase the app wrote,
   because Swift has neither the eight catalogues nor their plural rules. At
   the trailing edge is when, formatted here, because it has to be right when
   the row is drawn rather than when the blob was written. Never the message:
   that is Siri's to say.
  */
  private func row(for conversation: DirectoryConversation) -> CPMessageListItem {
    CPMessageListItem(
      conversationIdentifier: conversation.id,
      text: conversation.name,
      leadingConfiguration: CPMessageListItemLeadingConfiguration(
        leadingItem: .none, leadingImage: nil, unread: conversation.unread > 0),
      trailingConfiguration: nil,
      detailText: conversation.unreadLabel,
      trailingText: conversation.at.map(CarPlayScene.when)
    )
  }
}

/// Namespaced so the formatter is made once rather than per row per redraw —
/// `RelativeDateTimeFormatter` is expensive to build and cheap to reuse.
@available(iOS 14.0, *)
enum CarPlayScene {
  private static let relative: RelativeDateTimeFormatter = {
    let formatter = RelativeDateTimeFormatter()
    formatter.unitsStyle = .abbreviated
    return formatter
  }()

  static func when(_ date: Date) -> String {
    relative.localizedString(for: date, relativeTo: Date())
  }
}
