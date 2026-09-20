import Foundation
import Security

/**
 Where the phone keeps what it needs to send a reply without JavaScript.

 A reply dictated on the wrist reaches an iPhone that may be asleep. iOS wakes
 the app in the *background* for it, and what wakes is the process, not the
 React Native runtime in any useful state — so the send has to be possible
 from Swift alone, from a cold start, which means the session cookie has to be
 somewhere Swift can read on launch.

 The Keychain rather than the App Group's `UserDefaults`, which is where the
 widget snapshot lives. That blob is counts and names; this is a credential,
 and the difference is what an attacker with the file system gets. No access
 group is asked for: this module runs inside the app's own process, so it
 reads its own Keychain and nothing has to be shared with anything.

 `kSecAttrAccessibleAfterFirstUnlock` and not the stricter
 `WhenUnlocked`: the whole point is a phone locked in a pocket. A wrist reply
 to a phone that has been locked since a reboot fails, which is a narrow
 enough window to accept and the only one where "not sent" is honest anyway.
 */
enum WatchCredentials {
  private static let service = "tech.newchapter.languageXchange.watch"
  private static let account = "session"

  struct Stored {
    let baseUrl: String
    let cookie: String
  }

  static func save(baseUrl: String, cookie: String) {
    guard let data = try? JSONEncoder().encode(["baseUrl": baseUrl, "cookie": cookie]) else {
      return
    }
    clear()
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
    ]
    SecItemAdd(query as CFDictionary, nil)
  }

  static func load() -> Stored? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
      let data = item as? Data,
      let fields = try? JSONDecoder().decode([String: String].self, from: data),
      let baseUrl = fields["baseUrl"], let cookie = fields["cookie"]
    else { return nil }
    return Stored(baseUrl: baseUrl, cookie: cookie)
  }

  /**
   Sign-out, and the reason this is a function rather than an overwrite.

   A stale cookie here would let a watch still showing the previous account's
   threads send a message *as* them, from a phone that may have been handed
   on. The app clears this in the same breath it clears the session and the
   widget snapshot.
   */
  static func clear() {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    SecItemDelete(query as CFDictionary)
  }
}
