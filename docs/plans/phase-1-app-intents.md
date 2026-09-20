# The App Intents — two of three, and where the third stops

The plan asks for three: _open the Echo review_, _open a named conversation_,
and _send a message to a named person_. Two of them route and nothing else,
and those two are built. The third needs something that does not exist yet,
and this file says exactly what.

## Where they live, and the hour it cost

**In the widget extension, not in a local Expo module and not in the app
target.**

App Intents are found through metadata a build step extracts. That step runs
for an app or an app extension — **not** for the static library a
CocoaPods-based Expo module compiles into. An intent declared in a module
builds, links, and is then invisible to Shortcuts, to Siri and to the Action
Button, with nothing anywhere to say why. So a module was never an option.

The app target was tried first, through a config plugin in the shape of
`withWearApp.js`: copy the Swift in, copy the string catalogue in, add both to
the target. The Swift part worked. The catalogue did not, twice, and the
second failure is the one worth writing down — **the `xcode` package's
extension table predates `.xcstrings`**, so `addResourceFileToGroup` creates
the file reference, puts it in a group, and never adds it to the Resources
build phase. The reference exists, the file is not copied into the bundle, and
every `LocalizedStringResource` falls back to its own key.

The extension is the target that already compiles Swift **and** already
carries the catalogue, because `@bacons/apple-targets` puts it there for the
watch and the widgets. Moving the two files into `targets/widget/` deleted the
plugin, the copy step and the problem. `AppIntents` is added to that target's
`frameworks` and nothing else changed.

## What was checked

| Claim                                    | Result                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| The metadata step runs for the extension | ✅ `LangXWidget.appex/Metadata.appintents/extract.actionsdata` exists                           |
| Both intents are in it, and discoverable | ✅ `OpenChatsIntent` and `OpenEchoReviewIntent`, `isDiscoverable: true`, `openAppWhenRun: true` |
| Their words come from the catalogue      | ✅ the metadata carries `key: "intents.openEcho"`, not a sentence                               |
| A route survives the launch              | ⬜ not exercised end to end                                                                     |
| Siri answers a phrase                    | ❌ **not built** — see below                                                                    |

**The metadata caught a mistake the compiler could not.** The Swift asked for
`intents.openReview` while the catalogue had `intents.openEcho`: it compiles,
it extracts, and Shortcuts shows the raw key. `generate-xcstrings.ts` now
fails on it — its Swift scan tested for a space, which prose has and a key
does not, and a wrong key has neither. The new test is the **namespace**: a
literal whose first segment is one the generator emits (`watch.`, `widget.`,
`intents.`) has to be a key it emits. That leaves the reverse-DNS identifiers
these files are full of alone, and the list maintains itself.

## No Siri phrases yet, and why

An `AppShortcutsProvider` is what lets somebody say "Hey Siri, open my LangX
review". Its phrases are localized by using **the phrase itself as the key**,
with the app name interpolated into it — `"Open my \(.applicationName)
review"`. This generator writes keys of its own naming with translations
under them, which is a different arrangement, and bending it to emit
literal-keyed entries with a placeholder is a change to the generator rather
than to this file.

So: the two intents appear in the Shortcuts app, can be put on the Action
Button and in Control Centre, and are titled in eight languages. Siri by voice
waits for the generator to learn phrases. Recorded rather than half-done,
because an English-only phrase would break the rule the generator exists to
enforce.

## What the third intent needs

_Send a message to a named person_ needs two things this does not have:

1. **A directory in the App Group.** An `AppEntity` has to be resolved from
   somewhere, and Swift has no way to ask the app for a list of people. The
   shape already exists — `buildWatchPayload` produces `{id, name}` pairs — but
   it carries only the _unread_ threads, and an intent that could message only
   people who are already waiting on you is a strange product. The directory
   is the conversation list the app already holds, written to the App Group
   the way the snapshot is.
2. **Nothing else.** The send itself is solved: `ReplySender.swift` already
   posts to the REST twin from native code with a cookie from the Keychain,
   which is what the watch reply does. The bearer token the plan reserved for
   this is **not needed** — that paragraph assumed a separate Intents
   extension with its own container, and an intent in the widget extension
   shares the App Group the credentials already sit beside.
