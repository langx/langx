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

## Siri by voice — built 21 September

Behic asked for the config plugin, so this section is a record rather than a
refusal. Both shortcuts are live: the Shortcuts app lists a **LangX** section
with _Open Echo_ and _Open my messages_, and the built app carries four spoken
phrases in eight languages.

**What it cost, in the order the build said so.** Every one of these is a rule
with no documentation behind it and no error until you hit it.

1. **A provider has to be in the main app target.** `AppShortcutsProvider` in
   an extension compiles, links and is never heard. This project has no
   committed `ios/`, so the app target means a config plugin —
   `plugins/withAppIntents.js` — and the intents moved out of the widget with
   it, because declaring them in both places would put two of every action in
   the Shortcuts app.
2. **`_shared` is already in the app target.** The plugin's first version
   copied `PendingRoute.swift` and `Localizable.xcstrings` in alongside, on
   the assumption that a target is a binary and needs its own. It is, and it
   does, and `@bacons/apple-targets` had already arranged it: _"Cannot have
   multiple Localizable.xcstrings files in same target"_. The good kind of
   error — a second `PendingRoute` would have been the same story one error
   later.
3. **`AppShortcuts.xcstrings` is iOS 17 and up.** The app installs from 16.4,
   and the build says in as many words to use `AppShortcuts.strings` instead.
   So the generator writes eight `.lproj/AppShortcuts.strings` rather than one
   catalogue.
4. **Eight `.strings` files are one resource, not eight.** A `.strings` file
   is bound to a language by the `.lproj` folder around it, and Xcode only
   reads that folder for a child of a `PBXVariantGroup`. Added individually
   they are copied to the top of the bundle, where the last one wins and the
   other seven vanish. The plugin builds the group by hand, because
   `addResourceFile` reaches for a `Resources` group that an Expo project does
   not have and throws inside the library.
5. **The name is not ours to choose.** `Localizable` is never consulted for
   phrases. A file called anything but `AppShortcuts.strings` is a file iOS
   does not open.
6. **`${applicationName}`, exactly once, in every language.** iOS neither
   warns nor rejects a phrase without it; it declines to match, permanently,
   in that language only. `siriPhrases.test.ts` counts it in all eight and the
   generator refuses to write a set that fails.

**What was checked.** `Metadata.appintents/extract.actionsdata` in the built
app names the provider (`autoShortcutProviderMangledName`), lists both
shortcuts with their four phrase templates keyed exactly as the `.strings`
files spell them, and both intents with their title keys. The app bundle
carries all eight `.lproj/AppShortcuts.strings`; the Turkish one holds four
phrases under the four English keys. The Shortcuts app on an iPad simulator
lists the LangX section with both actions and their symbols.

**What was not.** Siri hearing any of it. A simulator has no useful Siri, so
the spoken half wants a phone — and the phrase to try first is "Hey Siri, open
my LangX review".

## What the third intent needs

_Send a message to a named person_ needs two things this does not have:

1. **A directory in the App Group.** An `AppEntity` has to be resolved from
   somewhere, and Swift has no way to ask the app for a list of people. The
   shape already exists — `buildWatchPayload` produces `{id, name}` pairs — but
   it carries only the _unread_ threads, and an intent that could message only
   people who are already waiting on you is a strange product. The directory
   is the conversation list the app already holds, written to the App Group
   the way the snapshot is.
2. **A decision about where the credential lives.** This paragraph said the
   opposite when it was written, and the correction is the useful part.

   `ReplySender.swift` does already post to the REST twin from native code,
   which is what the watch reply does — but it reads the cookie from
   `WatchCredentials`, and that is the **Keychain** with no access group,
   deliberately: "same process" is the comment on it. An App Intent in the
   widget extension is a _different_ process, so it cannot read a keychain
   item the app wrote without a shared access group, which is a new
   entitlement and manual portal work. The App Group is readable from both,
   and it is exactly where the plan decided a credential should not go.

   So the choice is a keychain access group or a second presentation of the
   session, and either way it is the security review
   [`iphone-watch-and-carplay.md`](iphone-watch-and-carplay.md) reserved —
   Behic's to make, not this file's to assume. The bearer token that section
   describes may turn out to be the right answer after all; what is now clear
   is that the intent does **not** get the send for free.
