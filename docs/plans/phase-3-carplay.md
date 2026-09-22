# Phase 3 — CarPlay: the chat list, read out loud

Written on 22 September 2026, the day after the entitlement arrived and the
day the JavaScript route died. What follows is what it is, what was checked,
and the four things that are not.

The phase's shape is in
[`iphone-watch-and-carplay.md`](iphone-watch-and-carplay.md) → _Surface C_ and
→ _The chat list, on every surface that can hold one_. Short version: CarPlay
apps draw Apple's templates and nothing of their own, the category is
Communication, and the car shows the same conversations the phone does with
the message **spoken** rather than written.

## Why it is Swift

`react-native-carplay` mounts React into the car scene through
`RCTRootContentView`, which the New Architecture removed — the link fails, and
that is phase 0's no-go. The plan's estimate of what the native branch would
then cost was: rebuild the socket, the cookie, the API client and the
catalogues in Swift.

None of that was paid, because the watch had already paid all four in a
different currency:

| The plan said it would need | What it uses instead                                 |
| --------------------------- | ---------------------------------------------------- |
| the socket                  | nothing — it draws the blob the app already writes   |
| the session cookie          | nothing — it makes no request                        |
| an API client               | nothing, yet; see _What is not built_                |
| eight catalogues            | `targets/_shared/Localizable.xcstrings`, compiled in |

The scene is **a fourth reader of `companionDirectory`**, the App Group blob
written for the App Intents. Two hundred lines of Swift, no new dependency,
no second definition of anything.

## What was built

| Piece                           | Where                                     |
| ------------------------------- | ----------------------------------------- |
| The scene, the list, the states | `carplay/CarPlayScene.swift`              |
| Reading a message out           | `CarPlaySpeaker`, same file               |
| The blob it reads               | `app-intents/ConversationDirectory.swift` |
| The four fields the car needs   | `packages/shared/src/companion.ts`        |
| Entitlement, manifest, sources  | `plugins/withCarPlay.js`                  |

**One list, three states**, the same three every companion surface here has.
No blob means nobody is signed in on this phone and the answer is to open the
app; an empty list means an account with no conversations; rows are the
ordinary case.

**The row is the person, what is waiting, and when** — "Mateo", "3 new · 7h".
The message is **not** on it. Apple took the message popup out of CarPlay in
iOS 18 and reads messages aloud instead, so a row carrying the body would be
asking somebody to read while driving. Tapping speaks it.

**The count arrives as a phrase, the time is computed on the spot.** `3 new`
is written by the app in the reader's language, with the plural rule the
catalogues hold, exactly as the widgets are handed their labels — Swift has
neither. The time is not: a phrase written into the blob would still say "7h"
an hour later, so the instant travels and `RelativeDateTimeFormatter` says it
in the system's own words.

**The list updates while the car is on.** The CarPlay scene is in the app's
process, so the write that feeds the widgets arrives here as
`UserDefaults.didChangeNotification` and the rows redraw. That only happens
while the app is actually running — see the limit below.

## What it cannot do, by construction

**No JavaScript runs when only the car is connected.** A `CPTemplateApplication
Scene` is not a window scene, and `ExpoAppSceneDelegate` starts React Native
for window scenes. So on a drive where nobody opens the app there is no
socket, no request and no fresh data: the list is as old as the last time the
phone was looked at. This is the bargain every surface in this plan makes —
the widgets make it too — and it is why the rows carry their own words.

It is also the strongest argument for the one thing left unbuilt below: a
Swift GET would fix the staleness, and the credential for it already exists.

## What was checked

- **The Swift compiles against the iOS 27 SDK at the app's own floor**:
  `swiftc -typecheck -target arm64-apple-ios16.4-simulator` over the scene and
  the directory, clean, no warnings. That is what settles the API surface —
  `CPListItem.handler`, `updateSections`, the speech delegate's two callbacks.
- **`expo prebuild` produces the three things iOS needs**: the
  `CPTemplateApplicationSceneSessionRoleApplication` role beside the window
  role in `Info.plist`, `com.apple.developer.carplay-communication` in the
  entitlements, and `CarPlayScene.swift` in the app target's sources.
- **The generator refuses a sentence written in the car**, now that it scans
  `carplay/` as it scans `targets/` — and its "prose has a space" heuristic
  gained "and a letter", because `" · "` is punctuation and was flagged.
- `pnpm -r typecheck`, the mobile tests including the four new cases over the
  directory builder, `pnpm lint`, `pnpm format`, `gen:strings --check`.

**A full `xcodebuild` of the workspace was attempted on this Mac and did not
complete.** It stops in two places, neither of which names anything in this
change: the Pods' _Copy XCFrameworks_ step for the prebuilt React, and the
watch complication — that second one because the command forced
`-sdk iphonesimulator` on every target in the scheme, which is a mistake in
the command rather than in the target. The app target never got far enough to
compile the scene, so the sentence above is the honest one: the Swift
type-checks against the SDK, and it has not been through an app build.

## What was not checked, and what it would take

- **A car, or the simulator's car.** Nothing here has been seen on a CarPlay
  screen. The simulator can show one — _I/O → External Displays → CarPlay_ —
  and that is one click on the Mac that is running it.
- **Whether the message is audible.** A CarPlay scene can be active while the
  app itself is in the background, and activating an audio session there needs
  the `audio` background mode. It is deliberately **not** added: it would also
  let every other sound in the app keep playing after somebody leaves it,
  which is a product decision rather than a build setting. If the car is
  silent, that is the line to add and the question to ask first.
- **The live refresh.** The notification path is in-process and ordinary, and
  it has not been watched happening.
- **Signing with the new entitlement.** The entitlement was granted for the
  App ID on 21 September, but a provisioning profile minted before that does
  not carry it. The first build after this lands needs its profile
  regenerated, and it fails at signing rather than at compile if it is not —
  with a message about an entitlement, not about the plugin.

## What is not built: answering

Replying is Siri's, and that is Apple's rule: a CarPlay communication app
never draws a keyboard, so a dictated answer comes through SiriKit's
`INSendMessageIntent`. That is the one piece of this surface still unwritten,
and the plan has always costed it as _a bearer token in a shared Keychain, an
Intents extension, and a security review_.

**Half of that cost may not apply here**, and it is worth probing before it is
paid. The Siri send path is expensive because an Intents extension is a
_separate process_ with its own container. The CarPlay scene is not: it is the
app, and the session cookie that `setWatchCredentials` already writes for the
watch reply is readable from it without an access group, a bearer token or a
new grant. A "Reply" that started dictation without SiriKit is not possible;
a car list that refreshes itself, and a send path for whatever eventually
dictates, both are.

Nothing here contradicts the security review the token deserves. It changes
what that review has to be _for_: the Intents extension, and only it.

## The two traps this cost

**Expo composes mods backwards.** `withInfoPlist` wraps the mod registered
before it, so the plugin listed _last_ touches the file _first_. `withCarPlay`
is therefore listed **before** `withSceneLifecycle` in `app.config.ts` and
acts after it. Registered the obvious way round it found an Info.plist with no
scene manifest at all, and — because the guard is loud — said so instead of
writing a car-only manifest and leaving the phone to launch into nothing,
which is the 21 September crash again.

**A Swift class named in a plist is found by its Objective-C name.**
`UISceneDelegateClassName` is looked up as `<module>.<class>` unless the class
carries `@objc(…)`. `CarPlaySceneDelegate` carries it, so the plist holds the
bare name. Get this wrong and the scene never connects: no error, no screen,
no clue.
