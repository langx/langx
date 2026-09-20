import Foundation

/**
 Posts a wrist reply to the API, from Swift, with no app running.

 The route is `POST /conversations/:id/messages`, the REST twin of
 `message:send`. Every guard — access, quota, token accounting — is on the
 server side of it, shared with the socket, so there is nothing to re-check
 here and nothing here may start checking.

 One `URLSessionConfiguration.ephemeral`, not `.background`: a background
 session would survive the process, which sounds like the right answer and is
 not. The watch is holding a spinner waiting for a verdict, and a send that
 completes after the reply handler has timed out tells nobody anything. Better
 to fail inside the window and let the wrist say so.
 */
enum ReplySender {
  /**
   The watch's own patience, minus room to answer.

   `sendMessage`'s reply handler has about a minute before iOS gives up on it,
   but a person looking at a watch face has far less. Fifteen seconds is long
   enough for a cold radio and short enough that "not sent" arrives while they
   are still looking at it — and a send that was actually committed on the
   server is not lost by saying so, because the retry carries the same
   `clientId` and the unique index refuses the second write.
   */
  private static let timeout: TimeInterval = 15

  static func send(
    conversationId: String, body: String, clientId: String, done: @escaping (Bool) -> Void
  ) {
    guard let credentials = WatchCredentials.load(),
      let url = URL(string: "\(credentials.baseUrl)/conversations/\(conversationId)/messages"),
      let payload = try? JSONSerialization.data(
        withJSONObject: ["body": body, "clientId": clientId])
    else {
      done(false)
      return
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.httpBody = payload
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(credentials.cookie, forHTTPHeaderField: "Cookie")
    request.timeoutInterval = timeout

    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = timeout

    URLSession(configuration: configuration).dataTask(with: request) { _, response, _ in
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      /*
       Anything but 2xx is "not sent", including the refusals that are the
       server working correctly — a suspended account, a thread the sender was
       removed from. The watch has one line to say it in and no screen to
       explain it on; the phone does, and that is where somebody is being sent.
      */
      done((200..<300).contains(status))
    }.resume()
  }
}
