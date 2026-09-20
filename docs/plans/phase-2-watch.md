# Phase 2 — the watch apps, as built

Written and run on 19–20 September 2026, the day after the widgets shipped in
2.5. It covers **both** wrists: the plan is Apple-only and put Wear OS in
_Not in this plan_, which was right about the constraints being separate and
wrong about the design being separate — every decision Surface B makes is
true on either watch, so there is one app here, not two. The design is in [`iphone-watch-and-carplay.md`](iphone-watch-and-carplay.md)
→ _Surface B_; this file is the record of what the code actually does, which is
not the same document in three places.

Like [`phase-1-mac-handoff.md`](phase-1-mac-handoff.md), it is a claim-by-claim
record. Nothing here should be read as verified except what the table marks
verified.

## Three things the plan got wrong

All three were found by writing the code, and none could have been known when
the plan was written on an iPhone-only desk.

**An App Group does not reach the watch.** The plan implies the complication
reads the same snapshot the Home Screen widgets do. It cannot: an App Group is
a container on one _device_, and the watch is a different device. Everything
the watch knows travels over WatchConnectivity as
`updateApplicationContext` — a single dictionary iOS replaces and redelivers,
so a watch that was off while three messages arrived wakes holding the current
state instead of replaying three stale ones.

**There is no socket to send a reply on.** The plan says a reply is "handed to
the phone over `WatchConnectivity`, which sends it on the socket the app
already holds". A backgrounded iOS app holds no socket. WatchConnectivity
wakes the app in the background, where there is no socket and no React runtime
worth waiting for — a few seconds of native runtime and a `URLSession`. So the
reply goes out from Swift over a REST twin of `message:send`, which the plan
had scheduled for CarPlay in phase 3. The watch got there first.

**There were no notification categories at all.** The plan says the actions
declared through `expo-notifications`' categories already appear on a wrist. No
`setNotificationCategoryAsync` call exists anywhere in the app. Mirroring is
free, as the plan says; the quick-reply action is not, and is **not built** —
see _What is not here_.

## How it is put together

```
phone                                   watch
─────                                   ─────
useWatchLink                            WatchStore (WCSessionDelegate)
  buildWatchPayload  ──updateApplicationContext──▶  UnreadList / ThreadView
  setWatchCredentials → Keychain
PhoneSession (WCSessionDelegate)  ◀──sendMessage──  reply, clientId minted here
  ReplySender → POST /conversations/:id/messages
```

**The watch never causes a fetch.** The payload is rebuilt whenever the unread
list changes, so a version that filled in missing threads would turn every
arriving message into ten requests on a phone in somebody's pocket. It carries
what the app already holds — always at least the message that made the thread
unread, and the cached tail when there is one. This is why the thread screen
can show one message where the phone shows twenty, and it is deliberate.

**The cookie lives in the Keychain, not the App Group.** The widget snapshot is
counts and names; this is a credential. No access group is asked for, because
the sending code runs inside the app's own process. `kSecAttrAccessibleAfterFirstUnlock`
and not `WhenUnlocked`: the whole point is a phone locked in a pocket.

**`clientId` is minted on the wrist**, before the first attempt. A
`sendMessage` whose reply handler never fires is indistinguishable from one
never delivered, so the phone's retry reuses the id and the server's unique
index refuses the second write. There is a test for it on the REST route.

**No words travel.** The widgets are handed three already-translated labels
because they sit beside numbers the app computed. The watch draws its own
chrome and gets it from `targets/_shared/Localizable.xcstrings`, which
`scripts/generate-xcstrings.ts` fills from the same eight catalogues — see
_The string generator_ below.

## The string generator

The gap the plan left deliberately, and the watch is what closed it, because
the watch is the first native surface with words of its own.

`src/i18n/nativeKeys.ts` names the keys Swift may ask for; the generator copies
exactly those into an Apple string catalogue that every target sees.
`pnpm gen:strings --check` runs in CI and fails on a stale catalogue.

Two deviations from the plan worth recording:

- **The catalogue is committed, not generated during `prebuild`.** A prebuild
  hook needs a TypeScript loader inside Expo's own process, and a committed
  file puts eight translations in the diff where a reviewer can judge them.
- **The lint rule is not an eslint rule.** eslint cannot read Swift. The check
  lives in the generator instead and flags any string literal in `targets/**`
  containing a space unless it is a generated key — prose has spaces, bundle
  ids and date formats do not. It was proved to fire before being relied on.

## What was checked, and how

A **Release** build on an iPhone 17 Pro simulator paired with an Apple Watch
Series 11 (46 mm), both on the machine's own local API against `langx_dev`,
signed in as the seeded `test_anna`.

| Claim                                         | Result                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| The watch target builds                       | ✅ `LangXWatch` compiles; embedded at `LangX.app/Watch/LangXWatch.app`                   |
| Words come from the generated catalogue       | ✅ Title, empty state and the entry placeholder all resolved from `.xcstrings`           |
| No payload draws the honest state             | ✅ "Open LangX on your iPhone" before the phone had spoken                               |
| A signed-in phone feeds the watch             | ✅ The unread thread appeared with the partner's real name and last message              |
| Tapping a row opens the thread                | ✅ Own messages right-aligned, the other side left                                       |
| Reply is offered only when the phone is there | ✅ Button enabled with `isReachable` true                                                |
| The system entry sheet opens                  | ✅ Dictation / scribble / keyboard, chosen by the wearer                                 |
| **A reply from the wrist reaches the server** | ✅ `POST /conversations/:id/messages` → 200, row in `langx_dev` at the moment of the tap |
| The sent message comes back to the watch      | ✅ New payload redrew the thread with it                                                 |
| Outcome states draw                           | ✅ "Sending…" then cleared by the fresh payload                                          |
| Sign-out empties the watch                    | ⬜ **not exercised**                                                                     |
| **A reply with the phone app force-quit**     | ✅ 20 September — see below                                                              |

The background row was the one that mattered, and it stayed blank until the
app was actually killed and the reply sent anyway. `simctl terminate` left
zero processes; the wrist sent; `POST /conversations/:id/messages` answered
200 and the row appeared in `langx_dev` at the moment of the tap.

That the _native_ path did it is not a guess either: the REST twin has exactly
one caller on each platform — `ReplySender.swift` and
`ReplyListenerService.kt` — and no JavaScript anywhere asks for that route.
iOS did relaunch the app a moment later, which is what the `get-session` and
`profiles/me` requests beside it are; the send itself could only have come
from Swift.

So `OnCreate` activating the session and the Keychain read on a cold launch
are observed rather than inferred. Sign-out is still not exercised.

### Right-to-left put the chevron on the clock

Found on 20 September, shooting the store screenshots in all eight languages —
which is the only reason it was found at all, because nothing before that had
run the watch app in Arabic.

watchOS draws the time in the top-right corner and never mirrors it. SwiftUI
mirrors the navigation bar with the layout direction, so in Arabic the back
chevron was drawn **on top of the clock** and an Arabic wearer lost both: no
readable time, and no visible way back.

The fix pins the navigation bar — and only the bar — left-to-right, then hands
the screens back the direction that was read before the override. Two things
are worth knowing about it. A chevron on the left is not what an Arabic reader
expects, and that is the price: the alternative is a control nobody can see.
And a `navigationDestination` inherits the **stack's** environment rather than
the view the modifier is attached to, so the thread screen needs the direction
given to it a second time — without that, the first version of the fix left
the list right-to-left and the thread left-to-right.

Verified by capture in both directions: chevron clear of the clock and the
names, bubbles and title still right-to-left in Arabic, and English unchanged.

## The Wear OS half

The same app. One `watchPayloadSchema` blob, one REST send twin, one list of
keys; `useWatchLink` calls both modules unconditionally and each is a no-op
off its own platform, which is how the two stay one feature rather than two
that resemble each other.

Where they genuinely differ:

|            | Apple Watch                          | Wear OS                                         |
| ---------- | ------------------------------------ | ----------------------------------------------- |
| Payload    | `WCSession.updateApplicationContext` | `DataClient` data item                          |
| Reply      | `sendMessage` with a reply handler   | `MessageClient`, answered on a second data path |
| Woken by   | `OnCreate` activating the session    | `WearableListenerService`                       |
| Credential | Keychain                             | the app's private `SharedPreferences`           |
| Strings    | `Localizable.xcstrings`              | `strings_generated.xml` × 8                     |

`MessageClient` has no reply channel, so the phone's verdict comes back as a
data item on `/langx/reply-result` — without it the wrist could only say
"delivered to the phone", which is not the question somebody is asking.

Two things had to exist before the app could:

- **A config plugin.** `android/` is generated by `prebuild` and is not
  committed, so `apps/mobile/wear/` is the source of record and
  `plugins/withWearApp.js` copies it in, adds `include ':wear'`, and puts the
  Compose compiler plugin on the root buildscript at the Kotlin version Expo
  pins. This is the arrangement `@bacons/apple-targets` hands the Apple side
  for free.
- **Android strings in the generator.** Wear is a second native surface with
  words of its own; the generator now writes both formats from the same
  `nativeKeys.ts`, because two lists would drift and the drift would be
  invisible.

Writing it found a bug already shipped in the Apple build: `watch.openOnPhone`
said "Open LangX on your **iPhone**", which is simply wrong on a Pixel Watch.
All eight locales now say phone.

### What was checked on Wear, and what was not

A **debug** build on a Wear OS 5 emulator (`android-34`, arm64, 384×384).

| Claim                                             | Result                                              |
| ------------------------------------------------- | --------------------------------------------------- |
| The module builds inside the app's Gradle project | ✅ `:wear:assembleDebug`                            |
| The config plugin survives `prebuild --clean`     | ✅ `android/wear` and `include ':wear'` regenerated |
| It installs and runs on a watch                   | ✅ under the phone app's own application id         |
| Words come from the generated resources           | ✅ the empty state, in the phone-neutral wording    |
| **The payload reaches it**                        | ✅ the unread list drew on the wrist                |
| **A reply from the wrist**                        | ✅ `POST …/messages` → 200, and it came back        |

All of it is observed, on a Wear OS 5 emulator paired to a Pixel 9 through
Android Studio's assistant with the phone signed in against the local API.

Getting there cost three real bugs, every one of them invisible without the
pairing:

- **The module was hand-written instead of using `expo-module-gradle-plugin`.**
  It compiled, installed, and crashed the app on launch with
  `UnsupportedOperationException: This function has a reified type parameter`.
  Expo's module DSL is built from reified inline functions, R8 is on in
  release, and the plugin is what carries the rules that keep them inlinable.
  The plugin also requires `defaultConfig.versionName`, in a message that
  names neither this module nor itself.
- **The Wear module signed with the wrong key.** `signingConfigs.debug` inside
  a module falls back to `~/.android/debug.keystore` while the app uses the
  generated `app/debug.keystore`, and the Data Layer pairs by application id
  _and_ certificate. The two APKs installed, ran, and never heard each other:
  the watch showed "open LangX on your phone" forever with nothing in any log
  to say why. This is the one to remember.
- **`registerForActivityResult` needs Fragment 1.3.0+**, which the Wear Compose
  artifacts do not bring. Lint fails the release build over it and the debug
  build does not, which is how it stayed hidden.

Two notes belong to the harness rather than the code. A release APK blocks
cleartext HTTP, so `http://localhost:4000` fails silently at the network layer
— the generated `android/` manifest was edited for the test and nothing in the
shipping config was touched. And Studio's pairing installs the Wear OS
companion from Play, which wants a Google account: that was the owner's to
give, not this session's.

### Two things the screenshot shoot turned up on Wear

**The message's direction is the message's, not the watch's.** The bubbles and
the list preview now set `TextDirection.Content`, so the paragraph direction
comes from the sentence rather than from the locale. The default is the
locale's, and in this app that is wrong more often than in most: an Arabic
speaker's thread is full of English and the reverse. It shows as displaced
punctuation — the question mark of "is this right?" drawn in front of the
question — which is what an Arabic capture of an English message looked like.

**Wear apps do not have to show the time, and this one will not.** Worth
writing down because it looks like an omission next to Apple, where watchOS
draws the clock over every app for free. On Wear the app draws its own with
`TimeText`, and the first read of these captures called the absence a defect.
It is not: Google removed it from the quality checklist on 13 July 2023
(`WO-V11`, "no longer a quality requirement for Wear OS apps"); only watch
faces must show the time. Adding one would cost the top of every screen — the
title, and a row of the list — to repeat something the wearer can see by
lowering their wrist.

## What is not here

- **A Wear OS complication or tile**, which is the Android counterpart of the
  one below and is not started either.
- **The complication.** A `watch-widget` target reading a digest the watch app
  stores. It needs its own App Group between the two watch targets, a `streak`
  field the payload does not carry, and the settings screen the plan asks for
  ("streak, or unread, chosen by the person"). Not started.
- **The notification quick-reply action.** No categories exist yet; see above.
- ~~**Store assets.**~~ Done, 20 September. Behic answered the open question —
  the watch enters the listing with its first build rather than waiting for
  CarPlay — so both sets were shot from the running apps rather than drawn:
  `branding/2.x/<locale>/ios/watch/` at 416 x 496, and
  `branding/2.x/<locale>/android/wear/` at 384 x 384, eight languages each.
  The Wear set cannot be uploaded until the app is opted into the **Wear OS
  form factor** in Play Console, which is Behic's to tick; Play asks for the
  screenshots only once it is.
- **App Groups on the two new App IDs.** Nothing needs them until the
  complication does, and when it does, expect the manual portal work recorded
  in [`phase-1-mac-handoff.md`](phase-1-mac-handoff.md): eas-cli cannot patch
  App Groups.

## Two traps worth knowing before repeating this

- **A killed `CODE_SIGNING_ALLOWED=NO` build poisons the derived data.**
  Rebuilding without the flag into the same `-derivedDataPath` does not
  re-sign. The app then launches, sign-in _succeeds_, and every authenticated
  screen says "Could not load this" while the API log shows **no requests at
  all** — `expo-secure-store` cannot reach a keychain the app has no
  entitlement for, and `apiFetch` throws before any fetch. Nothing names the
  keychain. Build into a fresh path; re-signing the bundle by hand restores the
  entitlements and breaks the nested signatures instead.
- **Simulators do not propagate the watch app.** Installing the phone app on a
  paired pair does not install the watch app the way a real pairing does —
  `simctl install` it on the watch directly, and note that uninstalling the
  phone app takes it away again.
