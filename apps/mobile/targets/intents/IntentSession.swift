import Foundation
import Security

/**
 The one authenticated client this extension has.

 **Why it is a copy of `modules/watch-link/ios/ReplySender.swift` and not a
 call into it.** That file is compiled into a CocoaPod, which is its own Swift
 module inside the app's process; an extension is a different process and
 cannot link a pod of the app's. `targets/_shared` is the folder that solves
 this for code both sides can hold — and a credential reader belongs to the
 side that reads it, not to every widget in the bundle. So the shape below is
 deliberately the same and deliberately separate, and the three constants it
 shares with the writer are named in both files.

 Everything it can do is one request to a route the app itself uses, so every
 guard — membership, quota, token accounting — is on the server side of it,
 shared. Nothing here re-checks anything and nothing here may start.
 */
enum IntentSession {
  /// Must match `WatchCredentials.service` in `modules/watch-link/ios`.
  private static let service = "tech.newchapter.languageXchange.watch"
  /// Must match `WatchCredentials.account`.
  private static let account = "session"
  /// Must match the key `plugins/withSiriMessaging.js` writes into both plists.
  private static let accessGroupKey = "LangXKeychainAccessGroup"

  /**
   Siri's patience, minus room to answer.

   An intent handler has a few seconds before the system gives up on it and
   tells the person it could not do that. Ten leaves room for a cold radio in
   a moving car and still fails inside the window — and a send that did commit
   is not lost by saying so, because the retry carries the same `clientId` and
   the unique index refuses the second write.
  */
  private static let timeout: TimeInterval = 10

  struct Credentials {
    let baseUrl: String
    let cookie: String
  }

  static func credentials() -> Credentials? {
    guard
      let group = Bundle.main.object(forInfoDictionaryKey: accessGroupKey) as? String
    else { return nil }

    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecAttrAccessGroup as String: group,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
      let data = item as? Data,
      let fields = try? JSONDecoder().decode([String: String].self, from: data),
      let baseUrl = fields["baseUrl"], let cookie = fields["cookie"]
    else { return nil }
    return Credentials(baseUrl: baseUrl, cookie: cookie)
  }

  /// `POST /conversations/<id>/messages`, the REST twin of `message:send`.
  static func send(
    conversationId: String, body: String, clientId: String, done: @escaping (Bool) -> Void
  ) {
    post(
      path: "/conversations/\(conversationId)/messages",
      payload: ["body": body, "clientId": clientId],
      done: done)
  }

  /// `POST /conversations/<id>/read`, which is what "mark it as read" means.
  static func markRead(conversationId: String, done: @escaping (Bool) -> Void) {
    post(path: "/conversations/\(conversationId)/read", payload: [:], done: done)
  }

  /// One message as `GET /conversations/<id>/messages` hands it out — the
  /// four fields reading one aloud needs, and nothing the decoder could trip on.
  struct RemoteMessage: Decodable {
    let _id: String
    let body: String
    let createdAt: String
    let deleted: Bool?
    let hidden: Bool?
  }

  private struct MessagePage: Decodable {
    let items: [RemoteMessage]
  }

  /**
   The newest `limit` messages of a thread, oldest first, as the route returns
   them — or nil, which the caller treats as "say what the phone last wrote".

   A shorter timeout than a send's. A send that is slow is still worth
   waiting for; a read that is slow is Siri saying nothing in a moving car,
   and the one line already on the phone is a better answer than that.
  */
  static func recentMessages(
    conversationId: String, limit: Int, done: @escaping ([RemoteMessage]?) -> Void
  ) {
    guard let credentials = credentials(),
      let url = URL(
        string: "\(credentials.baseUrl)/conversations/\(conversationId)/messages?limit=\(limit)")
    else {
      done(nil)
      return
    }

    var request = URLRequest(url: url)
    request.setValue(credentials.cookie, forHTTPHeaderField: "Cookie")
    request.timeoutInterval = readTimeout

    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = readTimeout

    URLSession(configuration: configuration).dataTask(with: request) { data, response, _ in
      guard let data, (response as? HTTPURLResponse)?.statusCode == 200,
        let page = try? JSONDecoder().decode(MessagePage.self, from: data)
      else {
        done(nil)
        return
      }
      done(page.items)
    }.resume()
  }

  private static let readTimeout: TimeInterval = 5

  private static func post(
    path: String, payload: [String: String], done: @escaping (Bool) -> Void
  ) {
    guard let credentials = credentials(),
      let url = URL(string: "\(credentials.baseUrl)\(path)"),
      let data = try? JSONSerialization.data(withJSONObject: payload)
    else {
      done(false)
      return
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.httpBody = data
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(credentials.cookie, forHTTPHeaderField: "Cookie")
    request.timeoutInterval = timeout

    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = timeout

    URLSession(configuration: configuration).dataTask(with: request) { _, response, _ in
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      /*
       Anything but 2xx is a failure Siri says out loud, including the
       refusals that are the server working correctly — a suspended account, a
       thread this person was removed from. Siri has one sentence to say it in
       and the phone has a screen; this is not the place to explain.
      */
      done((200..<300).contains(status))
    }.resume()
  }
}
