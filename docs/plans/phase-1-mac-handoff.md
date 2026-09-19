# Phase 1 on a Mac — what was run, and what came back

Written on 19 September 2026, when the iPhone widgets were finished as code
and had never been on a phone; **run on a Mac the same day**, and rewritten
here to say what happened rather than what to try. Everything above the Xcode
line was written in a Linux container — it typechecked, it linted, its tests
passed — and the ten claims below had never been checked. Seven of them now
hold, one is broken, and two need something this machine cannot reach on its
own: a signed-in Xcode, and a phone.

Every claim is marked with how it was checked, on Xcode 26.6 against an
iPhone 17 Pro simulator on iOS 26.5, with the app talking to a local API and
signed in as a seeded account. A simulator is not a phone, and where that
matters it is said so.

The design and the reasoning are in
[`iphone-watch-and-carplay.md`](iphone-watch-and-carplay.md); this file is the
handover and now also the record of it.

## What is in the branch

| Piece                                              | Where                                                 |
| -------------------------------------------------- | ----------------------------------------------------- |
| The blob's shape, and its version                  | `packages/shared/src/companion.ts`                    |
| The function that assembles one                    | `apps/mobile/src/lib/companionSnapshot.ts`            |
| The hook that writes it, mounted in the app layout | `apps/mobile/src/hooks/useCompanionSnapshot.ts`       |
| The native module that stores it                   | `apps/mobile/modules/companion-snapshot/`             |
| The Swift reader, shared by both targets           | `apps/mobile/targets/_shared/CompanionSnapshot.swift` |
| Three widget families in one bundle                | `apps/mobile/targets/widget/`                         |
| The extension that refreshes the count             | `apps/mobile/targets/notification-service/`           |
| Plugin, team id, App Group                         | `apps/mobile/app.config.ts`                           |

Not written, on purpose: the three App Intents, and the `.xcstrings`
generator. Nothing in the widgets draws a sentence — the "today has not
counted" state is the streak number dimmed and the empty state is the mark
alone — so no English-only string ships while the generator does not exist.

## Run it

```bash
pnpm install                 # this worktree needs its own; see CLAUDE.md
cd apps/mobile
npx expo prebuild -p ios --clean
npx expo run:ios             # or: xed ios, then run the LangX scheme
```

The widgets are a separate scheme. In Xcode, pick **LangXWidget** and run it
against the same simulator to debug the views; the snapshot only exists after
the app has run once and signed in.

Two things this Mac needed that the commands above do not say, both of the
machine rather than of the branch:

- **`pod install` wants a UTF-8 locale.** Without one CocoaPods dies inside
  `unicode_normalize` before it reads the Podfile, and `expo prebuild` reports
  only that `pod install` failed. `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` in
  front of both `prebuild` and `run:ios` is the whole fix.
- **Metro needs a healthy watchman**, which a second worktree of this monorepo
  is enough to poison — it runs out of file descriptors mid-crawl and every
  later request fails with the same recorded error until the daemon is
  restarted. Most of the checks below were done against a **Release** build
  instead, which carries its bundle and needs no Metro at all; it is also the
  closer thing to what ships.

## What had to be true — and what came back

Checked in this order on 19 September 2026. **Seven hold, one is open, two are
blocked on something outside the branch.** Where the check was weaker than the claim, the gap is the last
sentence of the entry.

1. **It builds.** ✅ All three Swift targets compile — the module, the widget
   bundle and the notification service — and `pod install` finds the
   hand-written `CompanionSnapshot` podspec without complaint, which was the
   first risk on the old list. Debug and Release both link, and all three
   products carry the App Group in their generated entitlements.
2. **The App Group is real.** ❌ **No.** On the simulator it works — the app,
   the widget and the service extension share one container and the widget
   draws what the app wrote — but a simulator hands out a group container
   whether or not the capability exists, so that proved nothing about the
   account. Building for a real phone answered it:

   > Provisioning profile "iOS Team Provisioning Profile:
   > tech.newchapter.languageXchange" doesn't support the
   > group.tech.newchapter.languageXchange App Group.
   > No profiles for 'tech.newchapter.languageXchange.widget' were found.
   > No profiles for 'tech.newchapter.languageXchange.notification-service'
   > were found.

   Three things are missing from the developer account: the App Group itself,
   and an App ID for each extension. `-allowProvisioningUpdates` creates all
   three on its own — and could not, because Xcode's stored Apple ID session
   has expired ("the login details for account … were rejected"). **Somebody
   has to sign in to Xcode once**; after that either a device build or the
   first `eas build` registers the three and this becomes a yes.

3. **A signed-in app writes the blob.** ✅ Signing in filled the container
   within seconds, and the medium widget on the Home Screen showed the three
   numbers `GET /me/unread`, `GET /profiles/me` and `GET /echo/summary` were
   answering with at that moment.
4. **Reading a chat moves the number.** ✅ A message sent from another account
   took the widget to `1`; opening the conversation took it back to `0` inside
   five seconds, with nothing touched but the app.
5. **The dim is right.** ✅ Seen in both states without arranging either. The
   account's last qualifying day was yesterday, so the streak drew dimmed;
   the daily check-in fired on launch, and the same widget redrew solid at the
   next number. Not checked outside this machine's timezone.
6. **Midnight moves it back.** ❓ Not exercised: a simulator takes its clock
   from the Mac. A real defect in the path was found by reading instead, and
   fixed — see _What was wrong_ below.
7. **A push refreshes the count with the app closed.** ❌ Not exercised, and a
   real defect found on the way — see _What was wrong_. It cannot be exercised
   on a simulator at all: the app refuses to ask for notification permission
   when `Device.isDevice` is false, `simctl push` is dropped unauthorised, and
   the simulator's Settings has no Notifications pane to grant it in. **This
   one needs a phone**, and it is the only claim here that a phone is the only
   way to settle.
8. **The links land.** ✅ `langx:///chats`, `langx:///echo` and `langx:///me`
   each open their own tab — checked both by handing the URL to the system and
   by tapping the widget's own tiles. The spelling was a guess and the guess
   was right.
9. **Sign out empties it.** ❌ **Half of this is broken.** Signing out removes
   the key — the container is empty afterwards — and the Home Screen widget
   falls back to its mark at once. The **Lock Screen** widgets do not: they
   went on showing the signed-out account's streak and unread count for over
   ten minutes, through repeated lock and unlock cycles and through killing
   the widget extension. The data is gone and the drawing is not, which is
   still somebody's streak on a Home Screen that may not be theirs. Whether a
   real device refreshes where the simulator does not is unknown, and the
   honest reading is that it is unresolved rather than cosmetic.
10. **The Lock Screen and StandBy pair render.** ✅ Circular and rectangular
    both draw, in the picker and once placed: a gauge with the streak inside,
    and two lines of streak and unread. StandBy itself was not entered.

### What was wrong, and what was changed

Three things. Each is one commit on this branch.

- **The notification service could never have run.** `mutableContent` is an
  Expo push field that defaults to false and sets `aps.mutable-content`;
  nothing set it, and without it iOS delivers a push and never wakes the
  extension. The extension was built, embedded and entitled — and unreachable.
  Proved directly: a simulator push without the flag leaves the snapshot
  untouched. Every push now carries it, with a test.
- **The widgets read the wrong clock.** Every view asked `countedToday()` with
  the default `Date()`, which is the moment WidgetKit _drew_ the entry, not the
  moment it is seen. WidgetKit renders ahead of time, so the midnight entry
  would have been drawn in the evening and would have said the evening's
  answer — the entry would have fired and changed nothing, which is claim 6.
  The views now take the entry's own date.
- **The notification service's `Info.plist` would have failed review.** It
  carried `NSExtensionActivationRule = TRUEPREDICATE`, which belongs to share
  and action extensions; the build warns in as many words that the App Store
  rejects an app shipping it. Removed.

One thing was _not_ changed. `writtenAt` was documented as the field that
stops a widget claiming stale numbers, and nothing reads it. Rather than invent
a cut-off nobody has chosen, the schema's comment now says what the code does.

## Then build — not yet

```bash
eas build --profile production --platform ios
```

**Not run.** The instruction was to build when all ten held, and they do not:
claim 9 is broken, claim 7 is untested, and claim 2 needs the App Group
registered first — which is the same wall a production build would hit, since
EAS generates a profile per target and cannot create one for a capability the
account does not have. Signing in to Xcode, or handing EAS the Apple ID, is
the first move either way.

Two things to expect. The **runtime version is a fingerprint**, and this
change moves it: no installed build can be reached over the air with any of
this, and the first build carrying it is the first one that can show a widget.
And every target needs its own provisioning profile, which EAS will generate —
the App Group has to be on all three App IDs before it does.

## What is still open

The risks this file listed before the run, with what the run did to them:

- ~~**The local module's podspec is hand-written.**~~ Closed. `pod install`
  resolves `CompanionSnapshot` and raises its deployment target alongside the
  other Expo modules.
- ~~**The deep-link spelling is a guess.**~~ Closed. All three land.
- ~~**`Image("WidgetIcon")`** may be missing.~~ Closed. The empty state draws
  the mark, which is also how sign-out was seen to work on the Home Screen.
- **`deploymentTarget: '17.0'`** on the widget is still above the app's own
  floor, so a phone on iOS 16 has an app and no widget. Deliberate, unchanged.

And what the run added:

- **The Lock Screen does not clear on sign-out** (claim 9). The one failure,
  and the one to settle on a phone before this ships. Nothing the app can call
  is missing — it writes, removes and asks WidgetKit to reload — so if a device
  behaves the same way, the fix is a rule inside the widget rather than another
  call from the app, and `writtenAt` is already in the blob waiting for one.
- **A push has never woken the extension** (claim 7). The flag that made it
  impossible is fixed; that it now works is inference, not observation.
- **All three widgets are called "LangX" in the gallery**, with no description
  under them, so the small and the medium are told apart only by their
  drawings. `configurationDisplayName` and `description` are user-facing
  strings, which is exactly what the `.xcstrings` generator does not exist for
  yet — the generator comes first, or eight languages get one.

## How it was driven

For whoever repeats this. The app was built Release for the simulator and
installed with `simctl install`, which needs no Metro. Sign-in used a seeded
fixture account (`apps/api/scripts/seed-test-users.ts`) against a local API.
The blob itself was read straight out of the container rather than inferred
from the drawing:

```bash
plutil -extract companionSnapshot raw \
  ~/Library/Developer/CoreSimulator/Devices/<udid>/data/Containers/Shared/AppGroup/<uuid>/Library/Preferences/group.tech.newchapter.languageXchange.plist
```

The unread number was moved by sending a message over the socket as the other
account — chat is socket-first, so there is no REST call that sends one.
