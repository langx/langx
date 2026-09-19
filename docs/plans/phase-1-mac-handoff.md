# Phase 1 on a Mac — what to run, and what to disbelieve

Written on 19 September 2026, when the iPhone widgets were finished as code
and had never been on a phone. Everything here was written in a Linux
container: it typechecks, it lints, its tests pass, and
`expo prebuild -p ios --no-install --clean` generates both targets — but no
Swift in this branch has ever been compiled, and no widget has ever been added
to a Home Screen. Treat every claim below as unverified until the step that
checks it passes.

The design and the reasoning are in
[`iphone-watch-and-carplay.md`](iphone-watch-and-carplay.md); this file is only
the handover.

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

## What has to be true

Each line is a thing that can fail on its own. In rough order of how early it
would fail:

1. **It builds.** Swift compiles in three places — the module, the widget, the
   notification service — and only the first has any Expo API in it.
2. **The App Group is real.** `group.tech.newchapter.languageXchange` has to
   exist in the developer account and be on the App ID. Xcode will offer to
   create it; if the capability is missing, `UserDefaults(suiteName:)` returns
   nil and every widget silently shows its empty state.
3. **A signed-in app writes the blob.** Add the medium widget: three numbers,
   the same ones the app shows.
4. **Reading a chat moves the number**, within a few seconds, without opening
   the widget's editor.
5. **The dim is right.** Before the day's first action the streak reads dimmed;
   after a message or a correction it is solid. This is the one piece of logic
   in Swift (`countedToday`), and the one most likely to be wrong at a
   timezone boundary — check it on a phone set to something other than UTC.
6. **Midnight moves it back.** Set the simulator's clock past midnight; the
   streak dims without the app being opened. The timeline carries an entry for
   it.
7. **A push refreshes the count with the app closed.** Force-quit, send a
   message from another account, look at the Home Screen. This exercises the
   notification service extension, which is the piece most likely to be
   entitled wrongly rather than coded wrongly.
8. **The links land.** `langx:///chats`, `langx:///echo`, `langx:///me` — the
   medium widget makes each number its own link, and this spelling of a
   deep link has not been tested against this app's router.
9. **Sign out empties it.** Everything disappears, including on the Lock
   Screen; nothing shows a zero.
10. **The Lock Screen and StandBy pair render** — circular and rectangular,
    which are the same views Phase 2 puts on a watch.

## Then build

```bash
eas build --profile production --platform ios
```

Two things to expect. The **runtime version is a fingerprint**, and this
change moves it: no installed build can be reached over the air with any of
this, and the first build carrying it is the first one that can show a widget.
And every target needs its own provisioning profile, which EAS will generate —
the App Group has to be on all three App IDs before it does.

## Known risks

- **The local module's podspec is hand-written.** If `pod install` cannot find
  `CompanionSnapshot`, that file is the first place to look;
  `npx expo-modules-autolinking resolve -p apple` already lists the module, so
  the failure would be in the pod, not the linking.
- **The deep-link spelling** in `LangXWidget.swift` is a guess against
  `expo-router` (`langx:///chats`). If a tap lands on the wrong screen, it is
  three URLs in one file.
- **`Image("WidgetIcon")`** comes from the generated asset catalogue, which is
  gitignored — it only exists after a prebuild. A missing image renders as
  nothing rather than failing the build.
- **`deploymentTarget: '17.0'`** on the widget is above the app's own floor, so
  a phone on iOS 16 has an app and no widget. That is deliberate;
  `containerBackground` is required from 17 and writing both paths doubles
  every view.
