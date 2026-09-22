import SwiftUI

/**
 The Apple Watch app.

 One store for the whole app, created here and handed down, because there is
 one `WCSession` and it has one delegate. Everything else in this target is a
 view over what that store holds — see `docs/plans/iphone-watch-and-carplay.md`
 → _Surface B_ for why the app is dependent rather than independent, which is
 the decision the whole target follows from.
 */
@main
struct LangXWatchApp: App {
  @StateObject private var store = WatchStore()

  var body: some Scene {
    WindowGroup {
      ChatList()
        .environmentObject(store)
    }
  }
}
