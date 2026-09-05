# iOS device test: banner not visible, thread stale after a push tap

## Context

3 Sept 2026, TestFlight build 120, first run on an iOS device. Two bugs from
`plans/handoff-ios-banner-and-stale-thread.md`:

1. A message arriving over the socket while the app was on another tab drew
   no in-app banner; a banner did appear later in the session.
2. Tapping the OS notification for a message received while backgrounded
   opened the right thread, but without that message.

Everything below is against `origin/main` (`f64632d9`). The shared checkout
`langx/` is on `docs/store-privacy-forms-checklist`; the banner files only
exist on `origin/main`, so all work happens in a fresh worktree.

## What the code confirms

**Bug 1 — the decision ran and chose `banner`; the host mounted; nothing was
visible.** Evidence and reasoning:

- The three refetches 300 ms after message 1 (`/conversations?filter=all`,
  `/me/tokens`, `/profiles/<sender>`) are exactly what `useSocket`'s
  `message:new` handler plus `MessageBannerHost`'s `useProfileCache` produce.
  The sender-profile fetch is the host's `useQueries` mounting for
  `banner.senderId`.
- Decision `markRead` would have posted `/conversations/…/read` within the
  same 300 ms; the handoff lists no such request there. Decision `ignore`
  needs `meId` missing (the `me` query is held by every retained tab, so it is
  not GC'd) or `messages.push` off (defaults → `notificationsAllowed` returns
  `true`). So `shouldShowIncomingBanner` returned `banner`.
- The push path (`useNotificationRouting` → `showMessageBanner`) and the
  socket path end in the same function and the same host, so the later banner
  proves the absolutely positioned layer paints on iOS.
- What differs between a **first** banner and a **later** one is structural:
  `slide` is a JS `Animated.Value(0)`; the `Animated.View` mounts with static
  `opacity: 0`; only then does a passive `useEffect` start a native-driver
  timing, which makes the value native and connects the props node to the
  already-mounted view. Every later banner mounts against an
  already-native `slide` and connects during commit (layout effect). RN 0.86
  queues native-animated operations and flushes on `setImmediate`, so the
  old "stuck queue" bug is not it, but the first-mount connect-after-mount
  path on the new architecture is the one thing message 1 exercised and the
  later banner did not. `ToastHost` uses the identical pattern, so the
  prediction is: **the first toast of an iOS launch is also invisible, the
  second is fine.** That is a one-tap device check (long-press a message →
  Copy → "Copied" toast) and it discriminates this hypothesis from the rest.
- Ruled out from code: `AppState.currentState === 'unknown'` only blocks
  `markRead`, it still yields `banner`; the 5 s replace-not-queue cannot hide
  a lone banner; `goBackTo` is `router.replace` on the Tabs navigator, which
  blurs `chat/[id]` and clears `activeConversation` on native as on web.

Whatever the exact native cause, the fix is to stop gating visibility on an
animation having run: a banner that is visible at rest and merely *slides*
cannot be lost by a connect that never happened.

**Bug 2 — nothing refetches after a gap.** `useSocket` registers no
`connect`/`reconnect` handler, `useNotificationRouting` only navigates,
`markConversationRead` invalidates `['conversations']` only, and TanStack's
`focusManager` is not wired to `AppState` on native, so `refetchOnWindowFocus`
never fires. A thread already mounted as the hidden `chat/[id]` tab keeps its
cached pages until something invalidates them.

## Fix 1 — `MessageBannerHost` is visible before it animates

File: `apps/mobile/src/components/MessageBannerHost.tsx`

- Opacity stays constant at 1. Keep `slide` for `translateY` only
  (`-16 → 0`), native driver as before. If the first animation does not run
  the card sits 16 pt high and fully visible; if it does, it slides.
- Keep `slide.setValue(0)` + `Animated.timing` in the effect and the 5 s
  dismiss timer unchanged. Comment says *why* the fade went (first-mount
  native connect on iOS, first device test), and names `ToastHost` as still
  using the fade so the asymmetry is deliberate.
- `ToastHost` is **not** changed in this PR. The device check above decides:
  if the first toast is also invisible, the same edit goes into a follow-up.
- `inAppNotifications.ts` and its tests are untouched; the decision logic
  was right.

## Fix 2 — resync what the socket missed, from `useSocket`

The refetch belongs with the socket: it is the socket's blind spot, and both
"I reconnected" and "the app is back from background" are the same statement
— events may have been missed. Not the routing hook (covers only the tap),
not the chat screen's focus effect (refetches every loaded page on every
navigation).

New pure module `apps/mobile/src/lib/missedEvents.ts` (in `src/lib`, no
`react-native` import, so vitest loads it):

- `resumedFromBackground(previous, next)` → true only for
  `background → active`. `inactive → active` (notification shade, Face ID) is
  excluded on purpose; nothing was missed there.
- `invalidateMissedEvents(queryClient)` → invalidates the `['conversations']`
  and `['messages']` prefixes. Prefix, not key: `keys.messagesAround` lives
  under `['messages', id]` and the list is tabbed. `invalidateQueries`
  refetches only *active* queries, so the cost is the mounted chat list plus
  the one thread the hidden `chat/[id]` tab holds — the infinite-query
  "every loaded page" cost the handler's comment warns about is paid once per
  resume, not once per message.

Wire it in `apps/mobile/src/hooks/useSocket.ts` inside the existing effect:

- `socket.io.on('reconnect', () => invalidateMissedEvents(queryClient))` —
  the Manager event, fired only for automatic reconnection.
- `AppState.addEventListener('change', …)` tracking the previous state from
  `AppState.currentState`; on `resumedFromBackground` → invalidate. Removed in
  the cleanup with the heartbeat. Comment explains why AppState lives here
  and not in a `focusManager` wiring (that would refetch every mounted screen
  on every foreground).
- Both may fire within a second of a resume; the second `invalidateQueries`
  simply restarts the in-flight fetch. Accepted and noted in the comment.

No change to `useNotificationRouting`, `markConversationRead` or the API.

## Tests

- `apps/mobile/src/lib/missedEvents.test.ts`: `resumedFromBackground` for
  the four transitions (background→active yes; inactive→active,
  active→background, unknown→active no). `invalidateMissedEvents` against a
  real `QueryClient` with data seeded under `['conversations','all']`,
  `['messages','c1']`, `['messages','c1','around','m9']` and `['me']`: the
  first three become `isInvalidated`, `['me']` does not.
- Existing suites (`inAppNotifications`, `activeConversation`,
  `foregroundPush`) stay green and unchanged.

## Docs

`docs/decisions.md`, two short entries after *A message in the foreground is
an in-app banner, not an OS one*:

- **An entry animation never gates visibility** — the first native-driver
  animation on iOS is not trusted to run; the banner is visible at rest and
  slides. `ToastHost` still fades, pending the device check.
- **A resume refetches what the socket missed** — `background → active` and
  socket `reconnect` invalidate conversations and the mounted thread; why not
  the routing hook, not the focus effect, not `focusManager`.

## Branches and PRs

Two PRs, the fixes are unrelated. One worktree, two branches, each from
`origin/main`:

```bash
cd /root/Developer/langx/langx && git fetch origin
git worktree add /root/wt-ios-fixes -b fix/banner-visible-before-animating origin/main
cd /root/wt-ios-fixes && pnpm install      # every worktree, every time
# … fix 1, tests, docs, push, PR
git checkout -b fix/resync-after-background origin/main
# … fix 2, tests, docs, push, PR
```

Before each push: `pnpm test`, `pnpm -r typecheck`, `pnpm lint`,
`pnpm format:check`. Merge with `gh pr merge --rebase`. No EAS build is
started; the merge publishes the OTA to `preview` on its own.

## Verification

Local (fix 2, general case, on web via the isolated stack on :4100/:8082 —
see memory *Isolated verify stack*): user X has thread open, Playwright
`context.setOffline(true)` on X, user Y sends over socket, X back online →
`reconnect` → thread refetches and shows Y's message without navigating.
The resume path is exercised by the unit test; on web `AppState` maps to
`visibilitychange`, which is a bonus, not the target.

Device, after both PRs merge and the *Preview update* workflow on expo.dev
finishes (~15 min) and Behic relaunches build 120:

1. Toast check first: long-press any message → Copy. Is the very first
   "Copied" toast of the launch visible? (Decides the `ToastHost` follow-up.)
2. App open on Discover, `pushtest` sends over socket → banner at once, tap
   opens the thread.
3. App backgrounded > 1 min (past the 45 s socket ping timeout, so the
   server sends a push), `pushtest` sends → OS notification, tap opens the
   thread **with the new message visible**.

`pushtest` sends run from `apps/api` with the socket.io snippet in the
handoff and `COOKIE` from `/tmp/pushtest.jar`.

## After both pass

Delete the throwaway sender from production (`MONGODB_URI` in `langx/.env`,
db `langx`), count-then-delete in one script: `user`, `session`, `account`
rows for `6a99c71c083e5d208f05b4b2` (ObjectId form — Better Auth's id
world), profile `6a99c71c083e5d208f05b4b2` (string form), conversation
`6a99c832083e5d208f05b4bc` and its messages, and any `devices` row for that
user. Report the counts.

## Left out, on purpose

- The 45 s half-open window: after a resume the server may still see the old
  socket in the room, so a message sent in that window gets neither a push
  nor a delivery until the ping timeout. Pre-existing, not in either report,
  touches fan-out semantics — flagged for Behic, not changed here.
- `AppState.currentState === 'unknown'` at iOS launch: harmless for the
  banner (still `banner`), only delays a `markRead`; unchanged.
- `ToastHost`'s fade: changed only if the device check says so.
