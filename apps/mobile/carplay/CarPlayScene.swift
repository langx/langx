import AVFoundation
import CarPlay
import NaturalLanguage
import UIKit

/**
 The chat list, on a car screen.

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

 **It draws what the phone last wrote, and that is the whole contract.**
 Connecting a car creates a `CPTemplateApplicationScene`; it does not create a
 window scene, and `ExpoAppSceneDelegate` starts React Native for window
 scenes only. So on a drive where the app is never opened there is no
 JavaScript, no socket and no request — the list is as fresh as the last time
 somebody looked at their phone. That is the same bargain the widgets and the
 watch make, and it is why the rows carry their own words: nothing here can
 ask the app anything.

 The one thing it does get for free is that it lives in the app's *process*.
 When the app is open, the write that feeds the widgets reaches this scene as
 a notification and the car list updates while it is on screen.
 */
@available(iOS 14.0, *)
@objc(CarPlaySceneDelegate)
final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate,
  CPInterfaceControllerDelegate
{
  private var interfaceController: CPInterfaceController?
  /*
   The chat tab's own name, as the watch's list is titled — not the app's.
   The first car it was seen in, on 23 September, drew "LangX" as a large
   heading beside the app's own icon in the rail: the brand twice, and the
   one word that says what this screen is nowhere.
  */
  private let list = CPListTemplate(title: String(localized: "tabs.chats"), sections: [])
  private let speaker = CarPlaySpeaker()
  private var writes: NSObjectProtocol?
  /*
   What is on the screen, so an unrelated write does not redraw it.

   `UserDefaults.didChangeNotification` is posted for the whole process, and
   this app writes defaults for reasons that have nothing to do with the car.
   Redrawing anyway would be cheap — twenty rows — except while a message is
   being read out: a rebuilt row is a new `CPListItem`, and the one whose
   indicator is on would lose it mid-sentence.
  */
  private var drawn: String?
  private var everDrawn = false
  /// The conversation that is open, so leaving it — and only it — stops the voice.
  private var conversationScreen: CPListTemplate?

  func templateApplicationScene(
    _ templateApplicationScene: CPTemplateApplicationScene,
    didConnect interfaceController: CPInterfaceController
  ) {
    self.interfaceController = interfaceController
    interfaceController.delegate = self
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
    speaker.stop()
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
   One conversation.

   The second line is what is waiting and when — "3 new · 7h" — and **not the
   message**. Apple took the message popup out of CarPlay in iOS 18 and reads
   messages aloud instead; a row carrying the body would be asking somebody to
   read while driving, which is the thing the whole surface is arranged to
   avoid. A tap opens the conversation, and the body is spoken there, by the
   synthesizer, from the same one line the chat list shows.

   The count comes as a phrase the app wrote, because Swift has neither the
   eight catalogues nor their plural rules; the time is formatted here,
   because it has to be right at the moment the row is drawn rather than at
   the moment the blob was written.
  */
  private func row(for conversation: DirectoryConversation) -> CPListItem {
    let parts = [conversation.unreadLabel, conversation.at.map(CarPlayScene.when)]
    let item = CPListItem(
      text: conversation.name,
      detailText: parts.compactMap { $0 }.joined(separator: " · ")
    )

    item.handler = { [weak self] _, completion in
      defer { completion() }
      self?.open(conversation)
    }
    return item
  }

  /**
   One conversation, and its last message read out as the screen opens.

   **A screen, because that is what a tap on a chat means.** The first
   version read the message in place, from the list, and the first person to
   drive with it tapped a row, saw nothing open, and concluded — correctly,
   from where he sat — that the rows could not be tapped. On a phone a
   conversation is somewhere you go; the car keeps that.

   **What is on it is one row, not the message.** Apple took the message
   popup out of CarPlay in iOS 18 and reads messages aloud instead, so the
   body is spoken rather than drawn. The row is how to hear it again, with
   what is waiting and when underneath — the same line the list showed — and
   its playing indicator is up for as long as the voice is.

   **Every tap answers.** The indicator goes up the moment reading is asked
   for, before any audio exists, and if the audio never starts the driver is
   told so. A conversation with nothing to read says that too.
  */
  private func open(_ conversation: DirectoryConversation) {
    guard let interfaceController else { return }

    let parts = [conversation.unreadLabel, conversation.at.map(CarPlayScene.when)]
    let listen = CPListItem(
      text: String(localized: "carplay.listen"),
      detailText: parts.compactMap { $0 }.joined(separator: " · ")
    )
    listen.handler = { [weak self, weak listen] _, completion in
      defer { completion() }
      guard let self, let listen else { return }
      self.read(conversation, on: listen)
    }

    let screen = CPListTemplate(title: conversation.name, sections: [CPListSection(items: [listen])])
    conversationScreen = screen
    interfaceController.pushTemplate(screen, animated: true) { [weak self, weak listen] _, _ in
      guard let self, let listen else { return }
      self.read(conversation, on: listen)
    }
  }

  private func read(_ conversation: DirectoryConversation, on item: CPListItem) {
    guard let preview = conversation.preview else {
      showReadFailed()
      return
    }
    item.isPlaying = true
    speaker.speak(
      preview,
      whenDone: { [weak item] in item?.isPlaying = false },
      whenFailed: { [weak self, weak item] in
        item?.isPlaying = false
        self?.showReadFailed()
      })
  }

  /// Back from a conversation stops its voice: the driver has left it.
  func templateDidDisappear(_ aTemplate: CPTemplate, animated: Bool) {
    guard aTemplate === conversationScreen else { return }
    conversationScreen = nil
    speaker.stop()
  }

  /**
   The one thing this surface says in a sentence of its own.

   An alert, because it is the only template every CarPlay category may
   present over a list, and because it goes away with one tap. Not presented
   over another one — two failures in a row are the same news.
  */
  private func showReadFailed() {
    guard let interfaceController, interfaceController.presentedTemplate == nil else { return }
    let alert = CPAlertTemplate(
      titleVariants: [String(localized: "carplay.readFailed")],
      actions: [
        CPAlertAction(title: String(localized: "common.ok"), style: .default) {
          [weak interfaceController] _ in
          interfaceController?.dismissTemplate(animated: true, completion: nil)
        }
      ])
    interfaceController.presentTemplate(alert, animated: true, completion: nil)
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

/**
 The message, read out.

 `AVSpeechSynthesizer` rather than the app's own voice service, for three
 reasons in this order: it is instant and works with no signal, which is what
 a car needs; it spends none of the `chatVoices` quota, so a free account can
 drive; and it touches no plan limit, so nothing has to change on the website
 or in the GitBook docs. Our voices stay where they are good — Echo, and
 reading a phrase on purpose.

 **The language is Apple's guess, not ours.** The app picks a voice language
 with `detectSpeechLanguage`, which runs `franc` against the two languages the
 pair is actually using — a quarter of a megabyte of trigram tables that the
 chat screen loads on demand and that must not be loaded at startup for every
 iOS user, and a pair of languages this blob does not carry.
 `NLLanguageRecognizer` is on the device already and answers from the text
 alone. It will be wrong sometimes, on short messages most of all, and the
 cost of being wrong is one sentence read in the wrong accent.

 **Whether it is audible is the one thing that cannot be settled at a desk.**
 A CarPlay scene can be active while the app itself is in the background, and
 activating an audio session there needs the `audio` background mode — added
 by `plugins/withCarPlay.js` on Behic's decision, with the cost it names. The
 first car it reached, on 23 September, still stayed silent; the session
 configuration below is the second attempt, and a failure is now reported to
 the driver rather than swallowed.
 */
@available(iOS 14.0, *)
final class CarPlaySpeaker: NSObject, AVSpeechSynthesizerDelegate {
  /*
   `nonisolated(unsafe)` because `AVSpeechSynthesizerDelegate` is declared
   `NS_SWIFT_SENDABLE`, which makes this class `Sendable` and the synthesizer
   inside it a warning. The claim it makes is true here and kept true below:
   everything that touches these properties runs on the main queue —
   `speak` and `stop` are called from CarPlay's own handlers, and the two
   delegate callbacks hop before they do anything.
  */
  nonisolated(unsafe) private let synthesizer = AVSpeechSynthesizer()
  nonisolated(unsafe) private var whenDone: (() -> Void)?
  nonisolated(unsafe) private var whenFailed: (() -> Void)?
  /// Whether the synthesizer said it began — the only evidence of sound this
  /// side of the car's speakers there is.
  nonisolated(unsafe) private var started = false
  /*
   Which utterance the two callbacks below are allowed to act on.

   Tapping a second row while the first is still being read cancels the first,
   and the cancellation arrives *after* the second has started. Without this
   the arriving callback would take the new row's indicator down and hand the
   audio session back under the sentence it had just started — a tap that
   silences itself, and only sometimes, because it is a race.
  */
  nonisolated(unsafe) private var current: AVSpeechUtterance?

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  func speak(
    _ text: String, whenDone: @escaping () -> Void, whenFailed: @escaping () -> Void
  ) {
    if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
    clear()

    /*
     `.voicePrompt` with `.duckOthers` and `.interruptSpokenAudioAndMixWithOthers`
     is what a navigation prompt does, and it is the configuration Apple's
     forums point to when `AVSpeechSynthesizer` is silent in CarPlay — which is
     what the first build did in the first car, with `.spokenAudio`. The music
     stays on, quieter, and comes back; a podcast pauses rather than talking
     over the message.

     Thrown rather than ignored now. A session that cannot be activated is a
     message nobody will hear, and the driver is owed being told.
    */
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(
        .playback, mode: .voicePrompt,
        options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers])
      try session.setActive(true)
    } catch {
      whenDone()
      whenFailed()
      return
    }

    let utterance = AVSpeechUtterance(string: text)
    utterance.voice = AVSpeechSynthesisVoice(language: language(of: text))
    current = utterance
    started = false
    self.whenDone = whenDone
    self.whenFailed = whenFailed
    synthesizer.speak(utterance)

    /*
     Three seconds for the synthesizer to say it started. It usually says so
     within a fraction of one; when it never does, the utterance is dropped
     and the failure reported, instead of a playing indicator that stays up
     over silence. What this cannot see is sound that started and then never
     reached the car's speakers — that is the car's audio routing, and the
     forum thread above has no answer to it either.
    */
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
      guard let self, self.current === utterance, !self.started else { return }
      self.fail()
    }
  }

  /// The car went away mid-sentence. Nothing is left speaking, and no row is
  /// left looking as though it still is.
  func stop() {
    if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
    current = nil
    clear()
    deactivate()
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance
  ) {
    DispatchQueue.main.async {
      if utterance === self.current { self.started = true }
    }
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance
  ) {
    DispatchQueue.main.async { self.done(utterance) }
  }

  func speechSynthesizer(
    _ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance
  ) {
    DispatchQueue.main.async { self.done(utterance) }
  }

  private func done(_ utterance: AVSpeechUtterance) {
    guard utterance === current else { return }
    current = nil
    clear()
    deactivate()
  }

  private func clear() {
    whenDone?()
    whenDone = nil
    whenFailed = nil
  }

  /// Gives up on the current utterance and says so — once.
  private func fail() {
    let failed = whenFailed
    whenFailed = nil
    current = nil
    if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
    clear()
    deactivate()
    failed?()
  }

  private func deactivate() {
    // Handing the session back is what lets the car's music come up to its
    // own volume again; without the option it returns silently or not at all.
    try? AVAudioSession.sharedInstance().setActive(
      false, options: [.notifyOthersOnDeactivation])
  }

  private func language(of text: String) -> String {
    if let guess = NLLanguageRecognizer.dominantLanguage(for: text)?.rawValue { return guess }
    return Locale.preferredLanguages.first ?? "en-US"
  }
}
