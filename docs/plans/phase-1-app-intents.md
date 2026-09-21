# The App Intents — three built, and where sending stops

The plan asks for three: _open the Echo review_, _open a named conversation_,
and _send a message to a named person_. **All three of the opening ones are
built**, with spoken phrases in eight languages. Sending is the one left, and
it needs a decision that is not this file's to make.

## Where they live, and the two hours it cost

**In the main app target** — and they spent a day in the widget extension
first, which is worth keeping because both halves of the reason are still
true.

App Intents are found through metadata a build step extracts. That step runs
for an app or an app extension — **not** for the static library a
CocoaPods-based Expo module compiles into. An intent declared in a module
builds, links, and is then invisible to Shortcuts, to Siri and to the Action
Button, with nothing anywhere to say why. So a module was never an option.

The app target was tried first, through a config plugin in the shape of
`withWearApp.js`, and abandoned over the string catalogue: **the `xcode`
package's extension table predates `.xcstrings`**, so `addResourceFileToGroup`
creates the file reference, puts it in a group, and never adds it to the
Resources build phase. The reference exists, the file is not copied into the
bundle, and every `LocalizedStringResource` falls back to its own key. The
extension already compiled Swift and already carried the catalogue — thanks to
`@bacons/apple-targets` — so moving the files to `targets/widget/` deleted the
plugin, the copy step and the problem.

**Siri brought the plugin back**, on 21 September, because an
`AppShortcutsProvider` cannot live anywhere but the app target. The catalogue
problem did not come back with it: phrases are not read from `Localizable` at
all, and the app target already carries `targets/_shared` — including the
catalogue the titles come from — because `@bacons/apple-targets` puts `_shared`
in its membership too. `plugins/withAppIntents.js` copies `app-intents/` in
and wires it up; the section below has the rest of what that cost.

## What was checked

| Claim                                     | Result                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| The metadata step runs for the app target | ✅ `LangX.app/Metadata.appintents/extract.actionsdata` exists                                   |
| Both intents are in it, and discoverable  | ✅ `OpenChatsIntent` and `OpenEchoReviewIntent`, `isDiscoverable: true`, `openAppWhenRun: true` |
| Their words come from the catalogue       | ✅ the metadata carries `key: "intents.openEcho"`, not a sentence                               |
| A route survives the launch               | ✅ 21 September — the shortcut opened the app on Katya's thread                                 |
| Siri has phrases to match                 | ✅ built 21 September — see below                                                               |

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

## Opening a named conversation — built 21 September

The second intent in full, and the half of the third that needs no credential:
it opens rather than sends, so nothing about it touches the security question
below.

**The directory.** `companionDirectorySchema` in `packages/shared` is twenty
`{id, name}` pairs, written into the App Group beside the widget snapshot and
in **its own key** — the snapshot is what the widgets read, and a widget has
no use for a list of people. `useCompanionDirectory` writes it from the
conversation list the app already has on screen and the profile cache the chat
list already fills, so it costs no request; `buildCompanionDirectory` drops a
partner whose name has not arrived, keeps the first of two people with the
same one, and stops at the cap. It is iOS-only, because nothing on Android
asks.

Twenty is a cap and not a page size. Apple matches a spoken name against
`suggestedEntities` — a finite list — so the number is the answer to "how many
people could somebody plausibly name out loud", and the order is the
conversation list's own, which is most recent first.

**The Swift.** `ConversationEntity` is an `AppEntity` whose display
representation is the other person's name; `ConversationQuery` is an
`EntityStringQuery`, and that last word is what makes speech work —
`entities(matching:)` is how "the chat with Mateo" becomes an entity, and
without it the action exists and can only be filled in by tapping. The
matching is case- and diacritic-insensitive, because somebody saying a name is
not spelling it.

**The route grew a rule.** `usePendingRoute` compared against two constants; a
conversation id cannot be compared against one, so the allowlist became
`pendingRouteHref` — pure, tested, and stricter than "not empty", because
everything after the prefix goes into a path.

**What was checked, on a simulator.** The metadata carries the action, the
entity, the query and both phrase templates with `${conversation}` spelled as
the `.strings` files spell it. The app wrote a directory of four real
conversations into the App Group. The Shortcuts action picker lists _Open a
chat_; its **Chat with** parameter offered exactly those four, in that order;
and running it opened the app on Katya's thread. **What was not:** Siri
hearing the phrase, which wants a phone — and the auto-shortcut tile for this
one did not appear in the Shortcuts gallery on the simulator, where the other
two do. The action and its parameter work, so the likeliest reading is that
the gallery indexes a parameterised shortcut only once its suggestions have
been available for a while; it is worth a second look on a real device rather
than a claim either way.

## What sending still needs

_Send a message to a named person_ now needs one thing rather than two: the
directory above is the half that was missing, and it is built.

**A decision about where the credential lives.** This paragraph said the
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
describes may turn out to be the right answer after all; what is now clear is
that the intent does **not** get the send for free.
