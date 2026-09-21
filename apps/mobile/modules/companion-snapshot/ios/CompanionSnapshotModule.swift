import ExpoModulesCore
import WidgetKit

/**
 The app's half of the widget contract: write the blob, and tell WidgetKit.

 Deliberately dumb. It takes a JSON string that `buildCompanionSnapshot`
 already produced and stores it as-is, rather than taking fields and encoding
 them here — the shape is defined once, in `packages/shared/src/companion.ts`,
 and a second definition in Swift would be free to drift from it. What this
 file knows is *where* the blob goes, not what is in it.

 `reloadAllTimelines` on every write is what keeps the Home Screen in step
 with the app: an app-initiated reload is not rationed the way a widget's own
 refresh requests are, so the person who just read their messages sees the
 count fall rather than waiting for a budget.
 */
public class CompanionSnapshotModule: Module {
  /// Must match `com.apple.security.application-groups` in `app.config.ts`.
  private static let appGroup = "group.tech.newchapter.languageXchange"
  private static let key = "companionSnapshot"
  /// Must match `PendingRoute.swift` in the app target.
  private static let routeKey = "pendingRoute"

  public func definition() -> ModuleDefinition {
    Name("CompanionSnapshot")

    Function("write") { (json: String) in
      defaults()?.set(json, forKey: Self.key)
      reload()
    }

    /*
     Sign-out, and the one case this module exists to get right. A widget
     still showing a 42-day streak after somebody signs out is their data on
     a phone that may not be theirs; removing the key is what makes the
     widget fall back to its empty state, which is also what a fresh install
     shows.
     */
    Function("clear") {
      defaults()?.removeObject(forKey: Self.key)
      reload()
    }

    /**
     The screen an App Intent asked for, read once and cleared.

     Here rather than in a module of its own because this file is already the
     app's one door to the App Group, and a second door to the same container
     would be two places to get the suite name wrong. The intents write
     through `PendingRoute.swift` in the app target; see
     `plugins/withAppIntents.js` for why they cannot live in a module at all.

     Cleared on read, because an instruction given once that survived its own
     delivery would send somebody to Echo every time they opened the app.
     */
    Function("takePendingRoute") { () -> String? in
      guard let route = defaults()?.string(forKey: Self.routeKey) else { return nil }
      defaults()?.removeObject(forKey: Self.routeKey)
      return route
    }
  }

  private func defaults() -> UserDefaults? {
    UserDefaults(suiteName: Self.appGroup)
  }

  private func reload() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
