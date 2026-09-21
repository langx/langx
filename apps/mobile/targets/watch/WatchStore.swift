import Foundation
import SwiftUI
import WatchConnectivity
import WidgetKit

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

  /**
   What the wearer chose the complication should show.

   Published rather than read from the container on demand: a computed
   property backed by `UserDefaults` would be a disk read on every render,
   and SwiftUI renders often. The container is still where it lives — the
   complication is a different process and cannot see this property — so this
   is a cache of it, seeded once at launch and written through.
  */
  @Published private(set) var complicationShows: WatchDigest.Shows = WatchDigest.load()?.shows ?? .unread

  func setComplicationShows(_ shows: WatchDigest.Shows) {
    complicationShows = shows
    writeDigest(shows: shows)
  }

  /**
   Write the digest and ask the face to redraw.

   Called on every payload and whenever the wearer changes the choice. A
   payload with no `streak` leaves the last one in place rather than erasing
   it: the field is optional precisely because an older phone build does not
   send it, and a complication that blanked whenever the phone was behind
   would be worse than one that is a day stale.

   No payload at all is different, and is handled by `clear` at sign-out:
   there the number must go, because it belonged to somebody.
  */
  private func writeDigest(shows: WatchDigest.Shows? = nil) {
    let previous = WatchDigest.load()
    let unread = (payload?.conversations ?? []).reduce(0) { $0 + $1.unread }
    WatchDigest.save(
      WatchDigest(
        version: WatchDigest.version,
        unread: unread,
        streak: payload?.streak ?? previous?.streak,
        shows: shows ?? previous?.shows ?? .unread))
    WidgetCenter.shared.reloadAllTimelines()
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
      /*
       And the complication, which is a different process and cannot see any
       of the above. `WatchDigest` is the two numbers it draws; writing it
       here rather than when the complication asks is the only order that
       works, because an extension the system wakes on its own schedule has
       no way to ask anybody anything.
      */
      self.writeDigest()
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
