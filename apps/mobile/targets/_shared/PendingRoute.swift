import Foundation

/**
 Where an App Intent leaves the screen it wants opened.

 An intent that opens the app cannot navigate it. `openAppWhenRun` brings the
 app forward and stops there — and in this app "forward" means a React Native
 runtime that may be starting from cold, with no router mounted yet to be told
 anything. So the intent writes a route and the app collects it on the way up.

 The App Group rather than the app's own defaults, because it is already the
 shared surface between the app and everything Apple runs beside it, and
 because the same directory the intents read lives there. One container, one
 set of rules about what is in it.

 Read once and cleared, like `takePendingIntent` does on the JavaScript side:
 an intent is an instruction given once, and a route that survived its own
 delivery would send somebody back to Echo every time they opened the app.
 */
enum PendingRoute {
  /// Must match `app.config.ts` and `CompanionSnapshot.appGroup`.
  private static let appGroup = "group.tech.newchapter.languageXchange"
  private static let key = "pendingRoute"

  static func write(_ route: String) {
    UserDefaults(suiteName: appGroup)?.set(route, forKey: key)
  }

  static func take() -> String? {
    let defaults = UserDefaults(suiteName: appGroup)
    guard let route = defaults?.string(forKey: key) else { return nil }
    defaults?.removeObject(forKey: key)
    return route
  }
}
