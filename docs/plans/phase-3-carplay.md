# Phase 3 — CarPlay: the chat list, read out loud

Written on 22 September 2026, the day after the entitlement arrived and the
day the JavaScript route died — the list first, then answering, a few hours
apart. What follows is what it is, what was checked, and what is not.

The phase's shape is in
[`iphone-watch-and-carplay.md`](iphone-watch-and-carplay.md) → _Surface C_ and
→ _The chat list, on every surface that can hold one_. Short version: CarPlay
apps draw Apple's templates and nothing of their own, the category is
Communication, and the car shows the same conversations the phone does with
the message **read by Siri** rather than written — never drawn, because Apple
does not allow message text on the CarPlay screen.

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
| an API client               | nothing — pushes keep the list fresh; see below      |
| eight catalogues            | `targets/_shared/Localizable.xcstrings`, compiled in |

The scene is **a fourth reader of `companionDirectory`**, the App Group blob
written for the App Intents. Two hundred lines of Swift, no new dependency,
no second definition of anything.

## What was built

| Piece                           | Where                                         |
| ------------------------------- | --------------------------------------------- |
| The scene, the list, the states | `carplay/CarPlayScene.swift`                  |
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

## What it cannot do, by construction — and how pushes make up for it

**No JavaScript runs when only the car is connected.** A
`CPTemplateApplicationScene` is not a window scene, and `ExpoAppSceneDelegate`
starts React Native for window scenes. So on a drive where nobody opens the
app there is no socket and no request.

**The pushes fill the gap, since 23 September.** A message push already
carries who sent it, which conversation, and the one line, and the
notification service extension sees every one. It now writes them into the
directory — the conversation to the top, its preview and time the new
message's, its unread count up by one, its "3 new" phrase dropped because
Swift cannot write the next one — and posts a Darwin notification the CarPlay
scene listens for. So the list moves during the drive, and what Siri reads
when a row is tapped is the message it just announced rather than the one
before. When Siri marks a thread read, the Intents extension clears its
unread count the same way; otherwise the dot would make the next tap read it
again instead of offering a reply. The app's next write replaces all of it.

No request is made for any of this, so no second credential is used and
nothing new is exposed: the push was already delivered to this phone, for
this account.

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
  `CarPlayScene.swift` in the app target's
  sources, and a `LangXIntents` target at deployment target 16.4 carrying the
  App Group, the Keychain group and the three `IntentsSupported` entries.
- **The generator refuses a sentence written in the car**, now that it scans
  `carplay/` as it scans `targets/` — and its "prose has a space" heuristic
  gained "and a letter", because `" · "` is punctuation and was flagged.
- `pnpm -r typecheck`, the mobile tests including the four new cases over the
  directory builder, `pnpm lint`, `pnpm format`, `gen:strings --check`.

**The whole app has now been built and launched — 23 September.** A Release
`xcodebuild` of the workspace for an iOS 27 simulator succeeded (the first
attempt's two failures were a `-sdk iphonesimulator` flag forced on every
target and a `.xcworkspace` a `prebuild --no-install` had removed — neither in
this change), and the app launches on an iPhone 18 Pro simulator running
iOS 27 and draws its welcome screen. That is the check that matters most for
review: the manifest now carries **two** scene roles, window and CarPlay, and
the 21 September rejection was a manifest problem.

Builds **172** and **173** of 2.6 carry all of this to App Store Connect; 173 is
in review. Its signed IPA was opened before upload: CarPlay, Siri and the
Keychain group in the app's entitlements, `LangXIntents.appex` inside with its
own, both scene roles in `Info.plist`, eight `AppIntentVocabulary.plist`s.

## The first car — 23 September, build 173 from TestFlight

**The scene attaches and the list is right.** Behic's Toyota drew the chat
list with real conversations, most recent first, each with a relative time
("6 mins ago", "2 hrs ago") in the system's own words — the blob, the decoder,
the manifest role and the entitlement all working end to end, on the first
try.

**Two things were wrong, and the fix for the first one changed the design:**

- **"None of them can be tapped" — "I can't get into the chat for it to read"
  — and then what Behic actually wanted:** no automatic reading, a dictated
  new message when he wants one, and a new message read aloud when it
  arrives. The first build spoke the message itself with
  `AVSpeechSynthesizer`, which stayed silent in the car, and silence was its
  only failure path, so the list looked dead. A screen to "enter" the chat
  would have needed the message drawn on it — and **Apple does not permit
  message text on the CarPlay screen**.

  So the rows are now `CPMessageListItem`s, Apple's own row for messaging
  apps, and every one of those wishes is Siri's: tapping an unread
  conversation has Siri read it (through `INSearchForMessagesIntent`, filtered
  to that conversation's identifier) and offer a dictated reply
  (`INSendMessageIntent`, carrying the same identifier, so no name has to be
  spoken — the extension fills the recipient in from it); tapping a read one goes straight to a reply; the bar's
  `CPMessageComposeBarButton` starts a new message; and a message arriving
  mid-drive is a **communication notification** — rebuilt in the notification
  service extension from an `INSendMessageIntent` — which is the kind Siri
  announces. The app itself no longer plays anything in the car, so the
  `audio` background mode added the day before is gone again with it.

- **The title.** "LangX" drawn as a large heading beside the app's own icon in
  the rail — the brand twice, and nothing saying what the screen is. It is
  now `tabs.chats`, the title the watch's list uses.

What this still cannot see is sound that started and never reached the car's
speakers. That is the car's routing, the forum thread has no answer to it, and
if the next test ends there it is the one problem here with no known fix.

## What was not checked, and what it would take

- **A car, or the simulator's car.** Nothing here has been seen on a CarPlay
  screen. **Xcode 27 has no Simulator.app** — the simulator UI is
  `DeviceHub.app` — and the CarPlay display is not a port `simctl io` exposes:
  it is opened from DeviceHub's own menu, which a script can only click with
  the Accessibility permission, a system security setting nobody should grant
  in passing. So the first CarPlay screen is Behic's, in a real car, on build
  173 from TestFlight.
- **Siri has never been asked anything.** The extension compiles and the app
  declares the three intents; whether Siri routes a tapped row's read and
  reply to it, and whether the resolver's name matching is any good out loud,
  is unseen.
- **Announcements.** A communication notification is only announced in the
  car if Announce Notifications is on for LangX (Settings → Notifications →
  Announce Notifications → CarPlay), and only if iOS accepts the rebuilt
  notification — which it does only with the Communication Notifications
  capability on the App ID.
- **The live refresh.** The notification path is in-process and ordinary, and
  it has not been watched happening.
- **Signing.** Four things have to be true in the developer portal before
  the next build signs, and none of them can be done from here:
  1. The CarPlay entitlement, granted for the App ID on 21 September — a
     profile minted before that date does not carry it.
  2. **Siri**, which is a capability on the App ID and is new as of this
     change.
  3. **Communication Notifications**, on the same App ID — switched on
     23 September; in builds from 176.
  4. A **new App ID for the Intents extension**,
     `tech.newchapter.languageXchange.intent`, with the App Group on it —
     `eas-cli` cannot patch App Groups, which is the manual pass recorded in
     `phase-1-mac-handoff.md`. The Keychain group needs no portal work; it is
     derived from the team prefix.

  All three fail at _signing_, with a message about an entitlement rather than
  about any file in this change. The runbook says so too.

**The second drive, on build 176, found the confirmation blind.** After
dictating a reply, Siri's "send it?" showed neither the recipient nor the
words — a message confirmed without seeing it. A reply from a car row reaches
the extension with a conversation identifier and **no recipients**, and the
handler answered that with `notRequired()`: no "to whom?", but also nobody on
the confirmation. Apple's own answer to the same question is that the
extension should fill the recipients in from the identifier, so it now
resolves them to the conversation's person, and Siri has the sheet it draws
for any message — to whom, and what it says. Not yet seen in a car.

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
