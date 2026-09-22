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
 and the difference is what an attacker with the file system gets.

 **It is written into a Keychain access group since 22 September**, which it
 did not need while the only reader was this process. The Intents extension
 that answers Siri in the car is a different process with a Keychain of its
 own, and a group is the smallest thing that lets it read this one item —
 smaller than the bearer token the plan had costed, which would have been a
 second credential with a second lifetime. The group is the app's own
 identifier with the team prefix, so nothing outside this bundle is in it.

 The group is named in `Info.plist` rather than here: `$(AppIdentifierPrefix)`
 is a build variable Xcode expands, and Swift cannot know the team. The key is
 written into both plists by `plugins/withSiriMessaging.js`, and
 `targets/intents/IntentSession.swift` reads it the same way.

 `kSecAttrAccessibleAfterFirstUnlock` and not the stricter
 `WhenUnlocked`: the whole point is a phone locked in a pocket. A wrist reply
 to a phone that has been locked since a reboot fails, which is a narrow
 enough window to accept and the only one where "not sent" is honest anyway.
 */
enum WatchCredentials {
  private static let service = "tech.newchapter.languageXchange.watch"
  private static let account = "session"
  private static let accessGroupKey = "LangXKeychainAccessGroup"

  /**
   The group, or nothing at all.

   A build made before the plugin landed has no such key, and the answer then
   is the Keychain this process has always used — the watch reply keeps
   working and only Siri is short a credential. Better than refusing to store
   anything because one plist key is missing.
  */
  private static func accessGroup() -> String? {
    Bundle.main.object(forInfoDictionaryKey: accessGroupKey) as? String
  }

  /// The query every call below starts from, with the group when there is one.
  private static func query(_ extra: [String: Any] = [:]) -> [String: Any] {
    var query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
    ]
    if let group = accessGroup() { query[kSecAttrAccessGroup as String] = group }
    for (key, value) in extra { query[key] = value }
    return query
  }

  struct Stored {
    let baseUrl: String
    let cookie: String
  }

  static func save(baseUrl: String, cookie: String) {
    guard let data = try? JSONEncoder().encode(["baseUrl": baseUrl, "cookie": cookie]) else {
      return
    }
    clear()
    SecItemAdd(
      query([
        kSecValueData as String: data,
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
      ]) as CFDictionary, nil)
  }

  static func load() -> Stored? {
    var item: CFTypeRef?
    guard
      SecItemCopyMatching(
        query([
          kSecReturnData as String: true,
          kSecMatchLimit as String: kSecMatchLimitOne,
        ]) as CFDictionary, &item) == errSecSuccess,
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
    SecItemDelete(query() as CFDictionary)
    /*
     And the one a build before the access group wrote, which is a different
     item in a different group and would otherwise survive a sign-out on the
     phone that updates between the two. A stale cookie is exactly the thing
     this function exists to remove.
    */
    SecItemDelete(
      [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
      ] as CFDictionary)
  }
}
