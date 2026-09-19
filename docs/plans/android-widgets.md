# The same widgets on Android

Written and run on 19 September 2026, the day after the iPhone widgets. The
design is not repeated here — it is in
[`iphone-watch-and-carplay.md`](iphone-watch-and-carplay.md) → _The widgets, in
detail_, and Android obeys all of it: the widget reads a snapshot the app
wrote, it never calls the API, it draws the mark rather than a zero when there
is nothing to show, and it deep-links instead of acting.

What follows is only where the two platforms differ, and what was checked.

## Android is the easier half, for one reason

**The widget is the app's own JavaScript.** `react-native-android-widget`
renders a tree of `FlexWidget` / `TextWidget` into RemoteViews from a headless
task in the app's process, so there is no second process to hand a blob
across. Three consequences, all of them simplifications:

- **No App Group, no entitlement, no capability to register.** The snapshot is
  stored where the app already stores small things — `localFlags`, which is
  `expo-secure-store` on native — and the widget reads it directly. The whole
  class of failure that stopped the iPhone build (see
  [`phase-1-mac-handoff.md`](phase-1-mac-handoff.md), claim 2) does not exist
  here.
- **No second copy of the rules.** The widget imports `countedToday` and the
  theme tokens from the app. The Swift side has both written out by hand
  because an app extension cannot import either; this side has the original,
  and the rule now has tests that the Swift copy is measured against.
- **No targets, no prebuild dance.** The views are TSX under `widgets/`; the
  config plugin writes the manifest receivers. `prebuild --clean` regenerates
  them from `app.config.ts` like everything else.

## Where Android is worse

**Nothing fires at midnight.** WidgetKit takes a timeline with an entry at a
moment of our choosing; Android's only equivalent is `updatePeriodMillis`,
which asks to be redrawn every so often and is floored at 30 minutes. So the
streak's dim can be up to half an hour late. It is asked for on both widgets,
and it costs a headless render from local storage — no network, no session,
nothing that could move a streak.

**A widget shows its last drawing until something asks for a new one.** Seen
plainly during the run: with two widgets on the screen, the one added a minute
ago drew today's answer while the other still showed the one from before the
device's day changed. The app asks for a redraw whenever it writes, which
covers everything a person does in the app; the 30 minutes covers the rest.

**No push-side refresh.** iOS keeps the unread count true while the app is
closed with a notification service extension. Android has no equivalent in
this cut: the count moves when the app next runs. Adding one means a receiver
in the FCM path, and the delivery path deliberately stays Expo's relay, so
that is a bigger decision than this cut.

**Two widgets, not three.** `systemSmall` and `systemMedium` have Android
counterparts (2×2 and 4×2); the Lock Screen accessories do not. Android's lock
screen has no widget surface to put them on.

## What was checked, and how

A **Release** APK on a Pixel 9 Pro XL emulator — release because it carries its
own bundle and needs no Metro, and because it is closer to what ships. The app
talked to a local API over `adb reverse tcp:4000`, signed in as a seeded
fixture.

| Claim                                     | Result                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| It builds, and the receivers are declared | ✅ Both providers in the manifest, both offered in the picker                   |
| A signed-in app writes; the widget draws  | ✅ The same three numbers the app shows                                         |
| Unread moves                              | ✅ A message from another account took it 0 → 1 live                            |
| The dim is right                          | ✅ Solid when the day has counted, dim when it has not                          |
| The day rolling over dims it              | ✅ Device moved to the next day; the streak dimmed with no help from the server |
| The links land                            | ✅ `langx:///chats` from the widget's own tile                                  |
| Sign out empties it                       | ✅ Mark only — **the half that is still broken on iOS's Lock Screen**           |
| Both themes                               | ✅ Light and dark, from `tokens.ts`                                             |

One defect was found in the running and fixed. **Alpha goes last.** The library
takes a colour in CSS order and rotates it into Android's `#aarrggbb` itself,
so a colour written the Android way is rotated twice: the dimmed streak came
out at about three percent and read as a missing number rather than a faint
one. It is the kind of thing that only a screenshot catches — the code was
right, the types were right, and the widget drew nothing where a number was.

Two things are worth knowing before repeating this:

- **`input draganddrop` adds a widget.** The picker needs a long drag onto the
  home screen; three seconds is enough.
- **The emulator's clock is the system's.** Rooted images can be set from
  `adb`; a Play image cannot, and the date has to be changed through Settings.
  That is how the day-rollover row above was tested.
