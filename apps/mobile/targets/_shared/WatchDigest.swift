import Foundation

/**
 The one number a watch face shows, and the only thing the complication knows.

 **Why this exists at all.** A complication is a widget extension: a separate
 process, drawn by the system while the watch app is not running, with no
 access to the app's memory and no `WCSession` of its own — only one session
 exists per app and the app owns it. So the watch app writes down what it was
 told, and the complication reads it. This file is both halves of that, in one
 place, because the two sides of a container agreeing is the whole contract.

 **The group is between the two watch targets, and nothing else.** Not the
 phone's: an App Group is a container on a device, and the watch is a
 different device — the phone's group is not reachable from here, which is the
 note `targets/watch/expo-target.config.js` opens with. This one is shared by
 `LangXWatch` and `LangXComplication`, both of which live on the wrist.

 **Deliberately not the payload.** The payload is names and sentences and can
 be a few hundred kilobytes; a complication draws one glyph. Writing the whole
 thing into a container the system reads on its own schedule would be paying
 the cost of the app's model to answer a question with one number in it.
 */
struct WatchDigest: Codable {
  /// Bumped when a field changes meaning, read the same way the payload's is:
  /// a digest from a newer watch app than this extension is no digest at all.
  static let version = 1

  /// Must match both `expo-target.config.js` files under `targets/`.
  static let appGroup = "group.tech.newchapter.languageXchange.watch"
  static let key = "watchDigest"

  let version: Int
  /// Everything waiting, across every thread.
  let unread: Int
  /// Absent until a payload carries one — see `WatchPayload.streak`.
  let streak: Int?
  /// What the wearer chose to see. The app owns the choice; the complication
  /// only reads it, so a face does not change under somebody mid-glance.
  let shows: Shows

  enum Shows: String, Codable {
    case unread
    case streak
  }

  static func load(from defaults: UserDefaults? = UserDefaults(suiteName: appGroup))
    -> WatchDigest?
  {
    guard let json = defaults?.string(forKey: key), let data = json.data(using: .utf8),
      let digest = try? JSONDecoder().decode(WatchDigest.self, from: data),
      digest.version == version
    else { return nil }
    return digest
  }

  static func save(_ digest: WatchDigest, to defaults: UserDefaults? = UserDefaults(suiteName: appGroup)) {
    guard let data = try? JSONEncoder().encode(digest), let json = String(data: data, encoding: .utf8)
    else { return }
    defaults?.set(json, forKey: key)
  }

  /// Sign-out, and the same rule the phone's blob follows: a face showing a
  /// number from an account nobody is signed into is worse than an empty one.
  static func clear(from defaults: UserDefaults? = UserDefaults(suiteName: appGroup)) {
    defaults?.removeObject(forKey: key)
  }
}
