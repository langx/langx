import Foundation
import SwiftUI
import WatchConnectivity

/**
 Everything the watch knows, and the only thing that talks to the phone.

 A dependent watch app has no session and makes no network call, so this is
 not a cache in front of an API — it is the whole model. What the phone last
 said is what the watch believes, and when the phone has said nothing the
 honest screen is "open LangX on your iPhone" rather than an empty list.

 `receivedApplicationContext` is read on activation and not only awaited as a
 delegate callback. iOS keeps the last context across launches, so a watch app
 opened cold already has an answer — without this read it would show the
 unreachable state for a second on every launch and look broken.
 */
@MainActor
final class WatchStore: NSObject, ObservableObject {
  @Published private(set) var payload: WatchPayload?
  @Published private(set) var reachable = false

  /// Keyed by conversation, so two threads can be in flight without either
  /// one's outcome being drawn on the other.
  @Published private(set) var sending: [String: SendState] = [:]

  enum SendState: Equatable {
    case sending
    case sent
    case failed
  }

  override init() {
    super.init()
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  var conversations: [WatchPayload.Conversation] {
    payload?.conversations ?? []
  }

  func conversation(id: String) -> WatchPayload.Conversation? {
    conversations.first { $0.id == id }
  }

  /**
   Send a reply, and say what happened.

   `clientId` is minted here rather than on the phone, and that is what makes
   the retry safe: a `sendMessage` whose reply handler never fires is
   indistinguishable from one that was never delivered, so the id has to exist
   before the first attempt and be reused by the second. The server's unique
   index refuses the duplicate write — see the REST send twin.

   An unreachable phone is refused here rather than attempted. `sendMessage`
   to an unreachable counterpart fails after a wait, and a wrist showing a
   spinner for ten seconds before saying "not sent" is worse than saying it at
   once.
   */
  func reply(to conversationId: String, body: String) {
    let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    guard WCSession.isSupported(), WCSession.default.isReachable else {
      sending[conversationId] = .failed
      return
    }

    sending[conversationId] = .sending
    let message: [String: Any] = [
      "conversationId": conversationId,
      "body": trimmed,
      "clientId": UUID().uuidString,
    ]

    WCSession.default.sendMessage(
      message,
      replyHandler: { [weak self] reply in
        let ok = (reply["ok"] as? Bool) ?? false
        Task { @MainActor in self?.sending[conversationId] = ok ? .sent : .failed }
      },
      errorHandler: { [weak self] _ in
        Task { @MainActor in self?.sending[conversationId] = .failed }
      }
    )
  }

  private func apply(_ context: [String: Any]) {
    let json = (context["payload"] as? String) ?? ""
    Task { @MainActor in
      self.payload = WatchPayload.decode(json)
      /*
       A fresh list is a fresh slate. Without this a thread answered a minute
       ago still reads "Sent" after the reply has arrived on the phone and
       come back as an ordinary message — the outcome of a send that is now
       visible in the thread itself.
      */
      self.sending.removeAll()
    }
  }
}

extension WatchStore: WCSessionDelegate {
  nonisolated func session(
    _ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    let context = session.receivedApplicationContext
    let isReachable = session.isReachable
    Task { @MainActor in
      self.reachable = isReachable
      if !context.isEmpty { self.apply(context) }
    }
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any])
  {
    Task { @MainActor in self.apply(context) }
  }

  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    let isReachable = session.isReachable
    Task { @MainActor in self.reachable = isReachable }
  }
}
