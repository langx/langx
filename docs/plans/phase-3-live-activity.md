# The agreed-call Live Activity — what was built and what was seen

Behic asked for the Live Activity on 20 September and named its trigger in
one clause: it should appear **when something scheduled happens**. This is the
record of what that turned into, claim by claim, in the shape
[`phase-1-mac-handoff.md`](phase-1-mac-handoff.md) and
[`phase-2-watch.md`](phase-2-watch.md) use. Nothing below is verified except
what the table marks verified.

## What the trigger turned out to be

An **accepted meeting**. It is the only thing in this app with a known start,
a known end, and a reason to watch the clock — a streak has no start, an Echo
review has no end, and a message has neither. `MEETING_STATUSES` already
carried `accepted`, and the hour-before push already treated it as a
commitment both people made, so the Live Activity is a third reader of a fact
the product had rather than a new fact.

## The pieces

| Piece                                   | Where                                       |
| --------------------------------------- | ------------------------------------------- |
| The countdown's contract                | `targets/_shared/ExchangeActivity.swift`    |
| The Lock Screen card and Dynamic Island | `targets/widget/ExchangeLiveActivity.swift` |
| Starting, moving and ending one         | `modules/live-activity/`                    |
| Which call, and whose name              | `src/hooks/useExchangeActivity.ts`          |
| Where the calls come from               | `GET /me/meetings/upcoming`                 |

**Nothing ticks.** Every number on the card is `Text(timerInterval:)`, which
the system counts on its own clock. An activity costs one write when the call
is booked and one when it is over, and nothing in between wakes the phone.
That is also why this could ship before phase 7's server-driven activities:
it needs no push at all.

**The label changes without a write.** `isStale` does it. The app sets the
stale date to the moment the call starts, so ActivityKit re-renders exactly
then and the card turns from "Starts in" to "Ends in". The alternative — the
app scheduling a write for the start time — needs the app to be running at
that moment, which is the one thing a countdown cannot assume.

## What was checked, and how

A Release build on an iPhone 17 Pro simulator against the machine's own API,
signed in as the seeded `test_anna`, with a meeting proposed by the other side
and accepted eighteen minutes before its start.

| Claim                                                         | Result                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| The attributes compile into both the extension and the module | ✅                                                                           |
| The module registers and JavaScript can reach it              | ✅ `OnCreate` logged at launch                                               |
| Live Activities are permitted                                 | ✅ `areActivitiesEnabled=true`, and the toggle is in Settings → Apps → LangX |
| The app asks for agreed calls                                 | ✅ one `GET /me/meetings/upcoming` per launch                                |
| An accepted call starts one                                   | ✅ `[LiveActivity] started for 6ab042c9…`                                    |
| The card draws on the Lock Screen                             | ✅ mark, the other person's name, "Starts in", and a live countdown          |
| **Sign-out ends it**                                          | ✅ gone from the Lock Screen immediately after signing out                   |
| The Dynamic Island shows it                                   | ⬜ **not seen** — see below                                                  |
| The card turns over at the start of the call                  | ⬜ not exercised: it needs eighteen minutes of waiting                       |
| A tap opens the thread                                        | ⬜ not exercised                                                             |

**The Dynamic Island was not seen.** iOS asks once, on the Lock Screen —
"Allow Live Activities from LangX?" — and the first capture caught that
prompt rather than the card. After allowing it the Lock Screen card drew
correctly; the Island was not re-checked. Worth knowing for anyone repeating
this: the consent is per app and it is the first thing that happens.

## Two traps

**A local Expo module cannot reach a file above its own directory.**
CocoaPods silently ignores a `source_files` glob that climbs out of the
podspec's folder — the pod installs, the build starts, and the only symptom is
`cannot find type 'ExchangeAttributes' in scope` in a module that obviously
declares it next door. ActivityKit pairs a running activity to its view by the
attributes type, so the declaration has to be compiled into both the widget
extension and the module; `modules/live-activity/ios/ExchangeActivity.swift`
is a **symlink** into `targets/_shared`, which is what keeps that one file one
file.

**`NSSupportsLiveActivities` is the difference between working and silent.**
Without it `areActivitiesEnabled` is false everywhere, `Activity.request`
throws, and nothing names the plist. It is set in `app.config.ts`.

## A third thing, which was a mistake worth keeping

The first version of the hook read the person's Live Activities _setting_
once, at mount, and used it to decide whether to fetch the meetings at all.
Both halves of that are wrong. A setting can be switched off and on again
while the app runs, so an answer from mount goes stale; and gating the query
on it means the phone stops asking about meetings, which is exactly what would
have to resume for the countdown to come back. The capability (is there a
module at all) is fixed and may be read once; the setting is asked in the
module, on every call.
