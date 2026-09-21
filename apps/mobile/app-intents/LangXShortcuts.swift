import AppIntents

/**
 The two things somebody can say to this app out loud.

 An `AppShortcut` is an `AppIntent` plus the sentences Siri will match against
 it, and it is also what puts the action in Spotlight and on the Shortcuts
 app's front page without anybody adding it by hand. The intents themselves —
 `OpenIntents.swift` — are unchanged by being listed here; a shortcut adds a
 way in, not a behaviour.

 **Three rules govern this file, and two of them fail silently.**

 1. A provider has to live in the **main app target**, and every intent it
    names has to be reachable from there. In an extension it compiles and is
    never heard. That requirement is the whole reason
    `plugins/withAppIntents.js` exists.
 2. Every phrase must contain `\(.applicationName)` **exactly once**. iOS does
    not reject one that does not; it declines to match it, for ever.
 3. The phrases are localized from `AppShortcuts.xcstrings` and from nothing
    else — `Localizable` is not consulted for them, even though the
    `shortTitle`s below come out of it. `src/i18n/siriPhrases.ts` is where the
    sentences are written and `scripts/generate-xcstrings.ts` writes the
    catalogue; the literals here are the English ones, and the generator
    checks that each is a key it emitted.

 The one thing that is not silent: leaving a phrase out of the catalogue
 entirely makes Siri answer in English to a Turkish speaker, which is at
 least visible the first time somebody tries it.
 */
@available(iOS 16.0, *)
struct LangXShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: OpenEchoReviewIntent(),
      phrases: [
        "Open my \(.applicationName) review",
        "Start my \(.applicationName) review",
      ],
      // Out of `Localizable.xcstrings`, which the plugin adds to this target
      // alongside these files — the same key the intent's own title uses, so
      // the tile and the spoken action cannot end up named differently.
      shortTitle: "intents.openEcho",
      // Deliberately an old symbol. A name that does not exist on the
      // running system draws nothing and says nothing, and this target's
      // floor is 16.4 — so the newer spelling of this glyph is off limits
      // however much better it looks in the gallery.
      systemImageName: "arrow.triangle.2.circlepath"
    )
    AppShortcut(
      intent: OpenChatsIntent(),
      phrases: [
        "Open my \(.applicationName) messages",
        "Show my \(.applicationName) chats",
      ],
      shortTitle: "intents.openChats",
      systemImageName: "bubble.left.and.bubble.right"
    )
  }
}
