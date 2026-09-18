# iPhone, Apple Watch and CarPlay — plan

## Status on 18 September 2026

**Not started.** Written as a plan on the day it was asked for; nothing below
is built, and no branch other than this document exists. It waits on Behic's
go-ahead — and on two decisions that are his, not the implementer's, listed at
the end.

One of the three surfaces waits on **Apple** rather than on us. The CarPlay
entitlement is applied for, not switched on, and Apple publishes no
turnaround time. That is why the order of work below files the request first
and builds against it afterwards.

Read `CLAUDE.md` first. Four of its rules bite in this change and each one
bites in a place that is easy to miss from Xcode: no user-facing string is
written in a component, no handler touches a collection directly, no threshold
is hard-coded, and comments explain _why_. A Swift target cannot import
`src/i18n`, and an app extension cannot import a repository function — both
are addressed below rather than waived.

## What is being added, and what each surface is for

Three Apple surfaces the app does not have today, in one plan because they
share an architecture and share a risk, but shipping in three independent
store builds:

| Surface         | What it is                                                                                                | Needs Apple's permission? |
| --------------- | --------------------------------------------------------------------------------------------------------- | ------------------------- |
| **iPhone**      | Home/Lock Screen widgets, a Live Activity in the Dynamic Island, Siri/Shortcuts, a Control Centre control | no                        |
| **Apple Watch** | A dependent companion app, complications, and replying from a mirrored notification                       | no                        |
| **CarPlay**     | A chat list you can hear and answer without touching the phone                                            | **yes — an entitlement**  |

None of them is a new product. Each is an existing thing — unread chats, the
streak, an Echo queue, a scheduled exchange — put where the phone is not in
the person's hand.

## What the app already is, and what that decides

Five facts about v2 decide most of the architecture here. They are not
background; each one closes off an approach that looks obvious from the
Apple side.

**Chat is socket-first.** Sending, correcting, reacting, typing and delivery
all go through Socket.io (`message:send`, `message:new`, `conversation:read`
— `apps/api/src/ws/`). REST covers reading: `/conversations/:id`, the message
window, `/me/unread`, `/conversations/:id/read`. A native Swift client that
wanted to _send_ would have to speak Socket.io, which is why nothing native
here sends directly. Two surfaces run inside the app's own JS runtime and
reuse the socket the app already holds; the one that cannot gets a REST twin
of a single mutation, described under _Siri_ below.

**Every client is cookie-based.** `auth.ts` says so in as many words —
nothing sends an `Authorization` header. A widget, a complication and an
intents extension each run in their own process with their own container, so
none of them inherits that cookie. The plan's answer is that **none of them
makes a network call**; they read a snapshot the app wrote. The one place
that cannot hold is Siri, and it is the one place a bearer token is proposed.

**Voices already exist, and they are metered.** `modules/tts/speech.ts` with
Kokoro/Piper behind it, content-addressed in storage, charged against the
`chatVoices` and `echoVoices` quotas from `PLAN_LIMITS`. Reading a message
aloud is therefore a thing the app can already do, at a cost. CarPlay does
**not** use it — see _Reading aloud costs nothing_ below.

**The runtime version is a fingerprint.** Every target added here changes the
native layer, so it changes the fingerprint, so it cannot reach an installed
build over the air. Each phase below is a store build and a review. Nothing
in this plan can be shipped as an OTA update, and any estimate that assumes
otherwise is wrong.

**`expo-audio` runs with `enableBackgroundPlayback: false`,** deliberately:
turning it on re-adds `FOREGROUND_SERVICE_MEDIA_PLAYBACK` on Android and with
it the Play declaration that version 121 sat overdue on. An iOS-only feature
must not be allowed to put that permission back into the Android manifest.
Whatever plays audio in the car is iOS-only native code, not a change to the
shared audio module.

## The rule all three obey

**A new surface is a new client, not a new door.** Everything reaching the
server from a widget, a watch, a car or Siri goes through the same repository
functions, the same access control, the same quota accounting as the app and
the socket. Where a surface needs something the API cannot answer yet, the
work is a route that calls the existing module function — never a query, and
never a "companion" collection with its own rules. If a CarPlay path could
send a message the app would have refused, the feature is wrong, not the
guard.

---

## Surface A — iPhone

Ships first because it needs nobody's permission and because it builds the
two pieces the other two surfaces reuse: the target tooling and the string
generator.

**Targets are added with `@bacons/apple-targets`.** The Swift lives in
`apps/mobile/targets/<name>/` — outside `ios/`, so `expo prebuild --clean`
does not delete it, which is the whole reason for the dependency. Hand-wiring
targets into a generated Xcode project does not survive a prebuild, and this
project has no committed `ios/` directory to hand-wire into.

**The widget reads a snapshot; it never calls the API.** On every foreground
and on every relevant socket event, the app writes a small JSON blob into the
App Group's `NSUserDefaults` — unread count, streak day and whether today is
already safe, Echo cards due, the next scheduled exchange. The widget renders
that and nothing else. No cookie has to be shared, no token has to leave the
Keychain, and a widget that has never been opened simply shows the empty
state. A stale snapshot is the acceptable failure here: a widget is allowed
to be a few minutes old, and is not allowed to be a second authenticated
client.

The snapshot writer is a small local Expo module under `apps/mobile/modules/`
— one function, `setCompanionSnapshot(json)`. It is a no-op on Android and on
web, so call sites stay unconditional.

**The Live Activity is updated locally, not by push.** ActivityKit's push
updates need an APNs token per activity, which the Expo push service does not
carry; adding a direct APNs path for it is a second delivery system for one
feature and is out of scope. So the first Live Activity is one the phone can
drive by itself: **a scheduled exchange**, from the agreed time to the end of
the session (the meeting already exists — `message:meeting`, and
`expo-calendar` already writes it into the person's day). The streak deadline
was the other candidate and is deliberately not first: it would want a server
push at the moment the day flips.

**Siri, Shortcuts, the Action Button and the Control Centre control are one
piece of work**, because on iOS they are all App Intents. Three intents, no
more: _open the Echo review_, _open a named conversation_, and _send a
message to a named person_. The first two only route into the app and need
nothing from the server. The third is the exception to everything above and
is treated in its own section.

**Verify:** a fresh build where the widget shows the real unread count within
a minute of a message arriving; a Live Activity that appears when a session
starts and dismisses when it ends; "Hey Siri, open my LangX review" landing
on the Echo tab; a `prebuild --clean` after which all of it still builds.

## Surface B — Apple Watch

**The watch app is dependent, not independent.** It has no session, makes no
network call, and speaks to the phone over `WatchConnectivity`. This is the
single most important decision in this plan and it is made on the strength of
the two facts above: an independent watch app would need its own auth (a
second credential store, a second thing to revoke when an account is deleted)
and its own transport for a chat protocol that is socket-first. A dependent
app needs neither, and the cost — nothing works when the phone is out of
range — is the correct trade for a companion that exists to glance at.

**The free half is already free.** iPhone notifications mirror to a paired
watch with no code at all, and the notification actions declared through
`expo-notifications`' categories appear there too. So the first watch
deliverable is not the app: it is **checking what our existing notifications
look like on a wrist**, and adding a quick-reply action to the `messages`
category if it is missing. That lands in a normal build, with no watch target
at all.

**The app itself is three screens.** The chats that are unread, one thread
read out in plain text, and a reply sent by dictation or scribble — handed to
the phone over `WatchConnectivity`, which sends it on the socket the app
already holds. Plus the complication: streak, or unread, chosen by the person
in the watch app's own settings.

Watch strings go through the generator below. The watch's own store
screenshots and the listing update are in `docs/store` and are part of this
phase's definition of done, not an afterthought — a watch app that ships
without them is invisible.

**Verify:** a message arriving while the phone is in a pocket, answered from
the wrist, showing up in the thread on the phone; the complication updating
after a check-in; the app showing an honest "phone not reachable" state with
Bluetooth off, rather than an empty list.

## Surface C — CarPlay

**Apple decides whether this ships.** CarPlay apps must fit exactly one of
Apple's supported categories — audio, communication, EV charging, navigation,
parking, quick food ordering, driving task — and the entitlement is granted
per category, on request, case by case, with no published turnaround. Apple's
own review criteria are that the app fits _one_ category, is safe to use
while driving, and is substantively built; combining categories is explicitly
a reason to be refused.

**The category is Communication** (`com.apple.developer.carplay-communication`),
not Audio. The case for Audio is real — Echo is a review queue that could be
a playlist, and an audio app is the easier entitlement — but it is a case for
a _different app_ than the one on the store. LangX is a messaging app; a
CarPlay surface that reads out your partner's message and sends your spoken
answer is what the category is for, and it is what an entitlement reviewer
opening the app will see. We cannot ask for both, and asking for Audio in
order to ship Echo would leave chat — the thing everybody opens — outside the
car permanently. **This is a decision for Behic, and it is not reversible
cheaply**; it is the first open question below.

**The car UI is driven from JavaScript.** `react-native-carplay` renders
Apple's templates from the JS side, which means the CarPlay scene runs inside
the app's existing runtime and reuses the socket, the session cookie, the API
client and the i18n catalogue with no second implementation of any of them. A
native CarPlay scene would have to rebuild all four in Swift. The cost is a
third-party dependency on the app's most fragile axis: community forks
disagree about the New Architecture, and support for Expo 57 / React Native
0.86 is **unverified**. That is exactly what Phase 0 is for, and Phase 0 has
a real no-go branch.

**Reading aloud costs nothing.** The message is read by the on-device
`AVSpeechSynthesizer` in the language `detectSpeechLanguage` already picks,
not by our voice service. Three reasons, in order: it is instant and works
with no signal, which is what a car needs; it spends no `chatVoices` quota,
so a free account can drive; and it touches no plan limit, so nothing has to
change on the website or in the GitBook docs. Our own voices stay where they
are good — Echo, and reading a phrase on purpose.

**Replying goes through Siri, and that is Apple's rule, not a choice.** A
CarPlay communication app supports SiriKit's messaging intents; dictation is
Siri's, and the app never draws its own keyboard or runs its own recorder in
the car. Which means the send path leaves the app's process, and that is the
one place this plan adds an authenticated non-app client.

### The Siri send path, and the only new auth in this plan

An Intents extension is a separate process with a separate container. It
cannot use the socket, and it does not have the session cookie. It needs two
things that do not exist today:

1. **A REST twin of `message:send`** — `POST /conversations/:id/messages`,
   calling the same function in `modules/chat/mutations.ts` that the socket
   handler calls. Not a parallel implementation: the same function, so the
   access check, the quota and the token accounting cannot diverge. A test
   asserts both paths refuse the same cases.
2. **A bearer token the extension can hold.** Better Auth's bearer plugin,
   with the token written to a shared Keychain access group at sign-in and
   cleared at sign-out and on account deletion. It is the same session with a
   second presentation, not a new grant and not a long-lived key.

Both are small. Neither is free: the second one puts a credential somewhere a
cookie was deliberately never put, and it deserves the security review that
`docs/decisions.md` gives things of that shape. **If the answer is no**, the
fallback is a CarPlay app that reads and cannot answer — legal, useful,
and a weaker entitlement application. That is the second open question.

**Verify:** the CarPlay simulator listing the same conversations as the
phone, in the same order; a message read in the right language with the
screen locked; a dictated reply landing in the thread on the phone and
counting against the same quota as one typed there; the app refusing to show
anything at all when nobody is signed in.

---

## Strings, in eight languages, from one file

`src/i18n/messages/en.ts` cannot be imported by Swift, and the rule that no
user-facing string is written in a component does not stop being true because
the component is a widget. So: **a generator**, run in `prebuild` and in CI,
that reads the existing catalogues and writes an Apple string catalogue
(`.xcstrings`) for the native targets. One source of truth, eight locales,
and the same failure mode the app already has — a key without a translation
does not build.

A lint rule refuses a literal user-facing string in `targets/**`, the way one
already refuses the i18n import in `admin/**`.

**Verify:** adding a key to `en.ts`, running `prebuild`, and seeing it in the
widget; `pnpm -r typecheck` failing when a locale lacks it.

## Order of work

Each phase is a store build. Phases 1 and 2 are independent of Apple; phase 3
is not, which is why its paperwork starts on day one.

```
0. Spike: react-native-carplay on Expo 57 / RN 0.86, New Architecture, one
   list template fed by the real API
   → verify: conversations appear in the CarPlay simulator, or the phase
     ends in a written no-go and surface C is re-planned natively
   → in parallel, and on day one: file the CarPlay entitlement request

1. iPhone: apple-targets wiring, the string generator, the snapshot module,
   widgets, the session Live Activity, three App Intents
   → verify: the list under Surface A, plus a clean prebuild

2. Apple Watch: the notification pass first, then the dependent companion
   and the complication, then the store assets
   → verify: the list under Surface B

3. CarPlay: the REST send twin and its test, the bearer path (if approved),
   the communication templates, the Siri intents
   → verify: the list under Surface C, against a real head unit as well as
     the simulator
```

## Not in this plan

Android Auto and Wear OS — a separate plan, a separate set of constraints,
and no reason to bundle them into an Apple-only piece of work. An independent
watch app. Voice or video calling, in the car or anywhere else: CallKit is a
different feature with a different entitlement conversation. iPad and Mac
layouts. Live Activities driven by the server. Echo as a CarPlay audio app —
ruled out by the category decision above, and worth revisiting only if Apple
refuses the communication entitlement.

## What Behic decides before any of this starts

1. **CarPlay category: Communication or Audio?** One only. The plan
   recommends Communication, and the reasoning is above.
2. **May a bearer token live in a shared Keychain?** If not, CarPlay reads
   but does not answer, and Siri loses its send intent.
3. **Which surface first if only one gets built?** The plan assumes iPhone,
   because it is the one nobody else has to approve.
4. **The first Live Activity: a scheduled exchange, or the streak?** The plan
   picks the exchange because the phone can drive it alone.
5. **Does the watch app go into the store listing now**, with its own
   screenshots, or wait until CarPlay is approved and both land together?
