import Foundation
import WatchConnectivity

/**
 The phone's end of the link to the watch.

 One object for the lifetime of the process, because `WCSession.default` has
 one delegate and iOS may hand it a message before any screen exists. It does
 two things: push the unread list out, and take a reply back.

 **The reply path does not go through JavaScript.** This is the correction the
 plan needed. It says a reply from the wrist goes out "on the socket the app
 already holds" — but WatchConnectivity wakes a closed app in the *background*,
 where there is no socket, no React runtime worth waiting for, and a few
 seconds of wall clock. So the reply is sent from here, over the REST twin
 added for exactly this, with a cookie read from the Keychain.

 **`updateApplicationContext`, not `sendMessage`, for the payload.** The
 context is a single dictionary iOS replaces and redelivers when the watch
 next comes up, so a watch that was off during three arriving messages wakes
 holding the current state rather than replaying three stale ones. That is
 also why nothing here queues: there is only ever one latest answer.
 */
final class PhoneSession: NSObject, WCSessionDelegate {
  static let shared = PhoneSession()

  /// The last payload handed over before the session finished activating.
  private var pending: String?

  private var session: WCSession? {
    WCSession.isSupported() ? WCSession.default : nil
  }

  func activate() {
    guard let session else { return }
    session.delegate = self
    if session.activationState != .activated {
      session.activate()
    }
  }

  func send(_ json: String) {
    guard let session else { return }
    guard session.activationState == .activated else {
      // Activation is asynchronous and the app writes its first payload on
      // launch, so this is the ordinary case rather than an error path.
      pending = json
      activate()
      return
    }
    // A failure here is a watch that keeps its previous answer for a while,
    // which the payload's own `writtenAt` already admits to. Nothing is worth
    // throwing at JavaScript over.
    try? session.updateApplicationContext(["payload": json])
  }

  /**
   Sign-out. The watch is emptied rather than left holding the last account's
   threads — the same rule the widget's `clear` follows, and the same reason:
   what is on a screen after sign-out is a claim about somebody who is no
   longer here.
   */
  func clear() {
    send("")
  }

  // MARK: - WCSessionDelegate

  func session(
    _ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    guard activationState == .activated, let queued = pending else { return }
    pending = nil
    send(queued)
  }

  /*
   Both are required on iOS and both exist for switching watches. The session
   is reactivated immediately so the new watch is paired to a live delegate
   rather than one that answers nothing until the app is next opened.
   */
  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  func session(
    _ session: WCSession, didReceiveMessage message: [String: Any],
    replyHandler: @escaping ([String: Any]) -> Void
  ) {
    guard let conversationId = message["conversationId"] as? String,
      let body = message["body"] as? String,
      let clientId = message["clientId"] as? String
    else {
      replyHandler(["ok": false])
      return
    }

    ReplySender.send(conversationId: conversationId, body: body, clientId: clientId) { ok in
      replyHandler(["ok": ok])
    }
  }
}
