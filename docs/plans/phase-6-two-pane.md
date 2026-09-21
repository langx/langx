# Phase 6 — one two-pane layout, for four devices

The largest single piece of work in
[`iphone-watch-and-carplay.md`](iphone-watch-and-carplay.md), started on
20 September 2026. This is the first layer: the conversation list and an open
thread, side by side, wherever the window is wide enough.

**Four devices, one question.** iPad, Mac (which runs this app as the iPad
build), the Duo's inner display and any future large screen are not four
layouts. They are four ways of asking _how wide is the window right now_, and
`useTwoPane` asks exactly that. Not the idiom, not the orientation, not the
device: an iPad in Split View is a phone-shaped window on a tablet, a Mac
window can be dragged to any size, and a Duo is a phone until it is unfolded.

## What had to happen first

**The thread stopped being a route file.** `app/(app)/chat/[id].tsx` was 2,533
lines that began by reading `useLocalSearchParams`, and a route cannot be
rendered inside a panel. It is now `src/screens/ChatScreen`, a component taking
a `conversationId`, and the route file is fourteen lines that read the
parameters and hand them over. Nothing else about it changed; the move is the
whole of that diff.

Two props came with the move, and only two:

- `embedded` — drawn beside the list rather than pushed over it. It hides the
  back arrow (the list it would go back to is on screen), leaves the stack's
  push animation alone (there was no push), pays the bottom inset to the tab
  bar instead of to the home indicator, and does not mark a TTI (the chats tab
  already marked one).
- `onClose` — how a panel empties itself. Blocking somebody is the one thing
  in the thread that leaves nothing to look at; pushed, it goes back to the
  list, and in a panel it clears the panel instead.

## Every way into a thread lands in the same place

`chat/[id]` redirects to the chats tab when there is room for two panes,
carrying the conversation in a parameter. That one redirect is what makes a
notification, a widget, a shared link, the profile's message button and a tap
on a row all behave the same way on a wide window — rather than five call
sites each learning about panels.

A `Redirect`, not a push-then-replace: a screen that pushed first would leave
an entry for the back gesture to find.

## The fold, in both directions

Narrowing while a thread is open — a Duo closing, an iPad entering Split View,
a Mac window dragged in — pushes the thread as a screen rather than letting it
vanish. Widening needs no code at all: the route redirects back into the panel
by itself.

## What is checked, and what is not

Looked at in a browser at 1280 and at 500 points wide, signed in as a seeded
account against a local API.

| Check                                 | Result                                                                |
| ------------------------------------- | --------------------------------------------------------------------- |
| `pnpm -r typecheck`, `lint`, `format` | ✅                                                                    |
| The mobile suite (1,017 tests)        | ✅                                                                    |
| The list and a thread side by side    | ✅ 360 for the list, the rest for the thread                          |
| A row tap fills the panel             | ✅ and the row it came from is marked                                 |
| No back arrow in the panel            | ✅ the list it would return to is on screen                           |
| A deep link lands in the panel        | ✅ `/chat/<id>` became `/chats?open=<id>`, the thread beside the list |
| Narrowing with a thread open          | ✅ back to `/chat/<id>`, pushed, back arrow returned, nothing lost    |
| Widening again                        | ✅ back into the panel, by the redirect alone                         |
| The empty half                        | ✅ "No conversation open", on the app's own ground                    |
| **On an iPad**                        | ✅ 21 September — see below                                           |
| On a Mac or a Duo                     | ⬜ not yet                                                            |

**The iPad, at last.** An iPad Pro 11-inch simulator on iOS 26.5, signed in,
running the branch from Metro: Discover's list beside a profile and the chat
list beside its empty half, **in portrait** — 834 points is over the 820 the
hook asks for, so the iPad is two-paned the way it is held rather than only
when turned. A row tap filled the panel and marked its row, and no back arrow
appeared in either.

That check cost more than it looks. Xcode updated to 27.0 (Swift 6.4) the
night before, and `ExpoModulesJSI.xcframework` — which `expo-modules-jsi`
builds on this machine and caches per slice on a hash of its _sources_ — was
still the copy built on 19 September by Swift 6.3.1. Nothing about the sources
had changed, so nothing rebuilt it, and every local iOS build died importing
it. Deleting that one directory fixed it; the details are in the memory note,
because the next person to hit it will be looking for the error text, not for
this file.

**The Mac and the Duo are still open.** A Mac needs the Mac to run the iPad
build; the Duo needs Xcode 27.1's Device Hub and its four poses, and a beta
Xcode cannot also be the one that submits a build for review.

**One thing the browser caught**, which is why it was worth running rather than
reasoning about: the empty half was white in dark mode. Neither pane paints the
ground — `Screen` paints its own, and the panel's is the thread's — so what
showed through was whatever sat behind the navigator.

## Discover, the same way — and the one difference

Behic asked for the rest of the app to follow, so Discover did: the list on
the left, the profile of whoever is picked on the right, the row it came from
marked. `profile/[handle].tsx` was 612 lines reading `useLocalSearchParams`
and is now `src/screens/ProfileScreen`, the same move the thread made, with
the same two props.

**It does not redirect, and that is the difference worth writing down.** A
thread has one parent — the conversation list — so sending every link to a
thread into that list's panel is right. A profile has five: Discover, Chats,
the viewer list, the leaderboard and a chat header. Somebody opening a profile
from a thread and landing in Discover would be a worse answer than a
full-screen page, so `profile/[handle]` still pushes, and only Discover's own
rows fill Discover's own panel.

Seen in the same browser: the empty half, a row filling it, the row marked,
and no back arrow in the panel.

## The feed, the third and last list

The same shape once more: the feed on the left, the picked post and its
corrections on the right. `post/[id].tsx` was 1,080 lines reading
`useLocalSearchParams` and is now `src/screens/PostScreen`.

It follows the profile's rule rather than the thread's — **no redirect** — for
the same reason: a post has three parents (this feed, the corrections list and
a correction's own page), so only the feed's own rows fill the feed's own
panel.

Seen in the browser at 1440: the empty half, and a pronunciation post opening
into the panel with its recordings, comments and comment box, no back arrow.

## Me and Echo keep their single column, on purpose

Both were opened at 1440 before deciding. Neither is a list with a detail:
Me is a profile and a settings index, Echo is a stage with one number and one
button on it. `Screen`'s own 720-point column already centres them, which is
what a page of that shape wants on a monitor — the alternative is a second
pane with nothing to put in it, or a line of text stretched across a desk.

So the rule the phase ends with is not "every tab gets two panes". It is
**every list that opens something gets two panes**, and there were exactly
three of those.

## One copy of the arrangement

The three tabs drew the same two halves three times, down to the same four
styles, before `src/components/TwoPane.tsx` existed. It holds the arrangement
— the fixed width on the list, the border between, the ground that neither
half paints — and nothing else. Whether there _are_ two panes is still asked
in the tab, because that is also where the answer changes what a row does: a
tap fills a panel or pushes a route.

## What this layer does not do

- **`chat/new`.** Composing to somebody new is still a pushed screen. It
  redirects to the thread once the conversation exists, which lands in the
  panel from there.
- **A resizable divider.** The list is a fixed 360; the thread takes what is
  left, capped by `Screen`'s own 720-point column so a bubble never spreads
  across a monitor.
