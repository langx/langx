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

| Check                                           | Result              |
| ----------------------------------------------- | ------------------- |
| `pnpm -r typecheck`                             | ✅                  |
| `pnpm lint`, `pnpm format`                      | ✅                  |
| The mobile suite (1,017 tests)                  | ✅                  |
| The list and a thread side by side, in a window | ⬜ **not yet seen** |
| A row tap filling the panel                     | ⬜ not yet seen     |
| The redirect from a notification into the panel | ⬜ not yet seen     |
| Narrowing a window with a thread open           | ⬜ not yet seen     |
| Any of it on an iPad, a Mac or a Duo            | ⬜ not yet seen     |

**Nothing in the bottom half of that table has been looked at.** The machine
lost its network mid-session — no address on `en0`, so no Atlas, so no API to
sign into — and every one of those checks needs a signed-in app with
conversations in it. The layout is written and it compiles; whether it _looks_
right is unknown, and this file will say so until somebody has seen it.

## What this layer does not do

- **The other tabs.** Discover, Feed and Me are still one column on a wide
  window. The chat list is where the two-pane shape is obvious and it is the
  one the plan names; the rest is a separate decision about what belongs
  beside them.
- **`chat/new`.** Composing to somebody new is still a pushed screen. It
  redirects to the thread once the conversation exists, which lands in the
  panel from there.
- **A resizable divider.** The list is a fixed 360; the thread takes what is
  left, capped by `Screen`'s own 720-point column so a bubble never spreads
  across a monitor.
