# Phase 3 — CarPlay: the chat list, read out loud

Written on 22 September 2026, the day after the entitlement arrived and the
day the JavaScript route died — the list first, then answering, a few hours
apart. What follows is what it is, what was checked, and what is not.

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

| Piece                           | Where                                         |
| ------------------------------- | --------------------------------------------- |
| The scene, the list, the states | `carplay/CarPlayScene.swift`                  |
| Reading a message out           | `CarPlaySpeaker`, same file                   |
| The blob every surface reads    | `targets/_shared/ConversationDirectory.swift` |
| The four fields the car needs   | `packages/shared/src/companion.ts`            |
| Entitlement, manifest, sources  | `plugins/withCarPlay.js`                      |
| Answering, by voice             | `targets/intents/`                            |
| The Siri capability and the key | `plugins/withSiriMessaging.js`                |

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
  `swiftc -typecheck -target arm64-apple-ios16.4-simulator` over the scene,
  the extension and the directory, clean, no warnings. That is what settles
  the API surface — `CPListItem.handler`, `updateSections`, the speech
  delegate's two callbacks, and every resolution result the three intent
  protocols want.
- **`expo prebuild` produces what iOS needs**: the
  `CPTemplateApplicationSceneSessionRoleApplication` role beside the window
  role in `Info.plist`, `com.apple.developer.carplay-communication`,
  `com.apple.developer.siri` and the Keychain group in the entitlements,
  `audio` in `UIBackgroundModes`, `CarPlayScene.swift` in the app target's
  sources, and a `LangXIntents` target at deployment target 16.4 carrying the
  App Group, the Keychain group and the three `IntentsSupported` entries.
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
  app itself is in the background, so activating an audio session there needs
  the `audio` background mode. It **is** added, by Behic's decision on
  22 September, and it is not free: with it, any sound the app is playing
  keeps playing when somebody leaves the app — Echo and the chat screen's
  read-aloud are the two that can be. Android is untouched; `expo-audio` keeps
  `enableBackgroundPlayback: false`, which is what keeps
  `FOREGROUND_SERVICE_MEDIA_PLAYBACK` out of the Android manifest.
- **Siri has never been asked anything.** The extension compiles and the app
  declares the three intents; whether Siri routes a spoken reply to it, and
  whether the resolver's name matching is any good out loud, is unseen.
- **The live refresh.** The notification path is in-process and ordinary, and
  it has not been watched happening.
- **Signing.** Three things have to be true in the developer portal before
  the next build signs, and none of them can be done from here:
  1. The CarPlay entitlement, granted for the App ID on 21 September — a
     profile minted before that date does not carry it.
  2. **Siri**, which is a capability on the App ID and is new as of this
     change.
  3. A **new App ID for the Intents extension**,
     `tech.newchapter.languageXchange.intent`, with the App Group on it —
     `eas-cli` cannot patch App Groups, which is the manual pass recorded in
     `phase-1-mac-handoff.md`. The Keychain group needs no portal work; it is
     derived from the team prefix.

  All three fail at _signing_, with a message about an entitlement rather than
  about any file in this change. The runbook says so too.

## Answering, which is Siri's

A CarPlay communication app never draws a keyboard — Apple does not allow one
while driving — so the reply is dictated to Siri and arrives as an
`INSendMessageIntent`. SiriKit's messaging domain is handled by an **Intents
extension**, in its own process, which is why `targets/intents/` exists.

It answers three intents, which is the set Apple asks a CarPlay messaging app
for:

| Intent                        | What it does                                                       |
| ----------------------------- | ------------------------------------------------------------------ |
| `INSendMessageIntent`         | resolves the spoken name against the directory and posts the reply |
| `INSearchForMessagesIntent`   | hands Siri the unread previews to read out                         |
| `INSetMessageAttributeIntent` | marks those conversations read                                     |

**Nothing is guessed.** One name match sends, several ask Siri to
disambiguate, none is unsupported. A handler that picked the first of two
people called Maria would be a message sent to the wrong person by somebody
who cannot see it happen.

**The credential is the one that already existed, in a group.** The plan had
costed this as a bearer token: Better Auth's bearer plugin, a token written at
sign-in, a second thing to revoke. None of that was needed. The watch reply
already keeps the session cookie in the Keychain, and an extension can read
that item if both sides name a **Keychain access group**. So the change is one
entitlement on each side and one plist key naming the group — the same
session, the same item, one more process of ours reading it.

That is a real widening and it is the smallest one available: the group is the
app's own identifier with the team prefix, nothing outside this bundle is in
it, and the item is still cleared at sign-out. The bearer token the plan
described would have been a _second_ credential with a second lifetime to get
wrong. Recorded here rather than in `docs/decisions.md` until somebody has
seen it work.

**What the car screen does not do is start Siri.** There is no public API for
it, and Apple's arrangement is the car's own voice button. So the CarPlay list
speaks on a tap and answering is a separate sentence the driver says — which
is why the two halves of this phase could be built hours apart without one
waiting for the other.

**Sending happens with the phone locked**, deliberately: `IntentsRestrictedWhile
Locked` is empty in the extension's `Info.plist`. The whole point is a phone in
a pocket.

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
