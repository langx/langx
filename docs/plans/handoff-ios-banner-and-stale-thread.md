# Handoff: two bugs from the first iOS device test

## Status — 3 September 2026, three PRs merged, device test outstanding

The real cause of bug 1 was found on the second pass and is **not** what the
first two PRs assumed.

- **#1108 (`cf4706fe`) — the actual fix for bug 1.** `AppSplash`'s layer has
  always carried `zIndex`/`elevation` with the comment _"over
  `react-native-screens`, which a plain later-sibling is not enough for"_.
  `ToastHost` and `MessageBannerHost` are the same kind of absolutely
  positioned sibling of `<Stack>` and carried neither, so on native they paint
  behind the navigator's screen containers in an order nothing guarantees —
  a banner that is missing, then present once navigating has changed the paint
  order. The dialogs escaped it by being `Modal`s. The three numbers now live
  in `apps/mobile/src/lib/overlayLayers.ts`.
- **#1106 (`9d624b3d`) — hardening, not the diagnosis.** The banner is drawn
  at full opacity and only its position animates. `ToastHost` keeps its fade;
  a fade that fails on a layer that paints where it should is a toast that
  appears without sliding.
- **#1107 (`006ff404`) — bug 2, verified end to end.** `useSocket` invalidates
  the conversations and messages prefixes on `background → active` and on the
  socket Manager's `reconnect`; decisions in
  `apps/mobile/src/lib/missedEvents.ts`.

### What the browser pass proved, and what it cannot

The isolated stack was run for real (throwaway API on :4100, the actual Expo
web build on :8082, Playwright driving it):

- **Bug 2 passes end to end.** Context offline → the message sent over the
  socket does not appear → back online → the reconnect invalidation brings it
  into the open thread.
- **The banner renders** at effective opacity 1, at the top, and
  `elementFromPoint` at its centre hits the banner itself. Screenshot shows
  the avatar, name and preview over the Discover tab.
- **It cannot prove the iOS fix.** On the web, DOM order alone puts these
  layers on top, so the bug never reproduced there — the browser pass was
  green before the fix as well. Only the device settles it.

### Shipped 3 September 2026

- **OTA**: `preview-update.yml` succeeded for all three merges; the `preview`
  channel now points at the group carrying `cf4706fe`, android + ios, runtime
  `exposdk:57.0.0` (23:23 UTC). Build 120 picks it up on the next launch.
  Earlier runs that day (21:22–21:54, other people's commits) had **failed** —
  worth knowing before assuming a merge always ships.
- **Web**: built from a throwaway worktree at `cf4706fe` with
  `EXPO_PUBLIC_API_URL=https://api.langx.io`, deployed to Pages project
  `langx-web`, edge cache purged (90 urls). `app.langx.io` serves
  `entry-2790ec6d…js`, the same hash as the deployment and the local build,
  with `toast:80 / messageBanner:90 / splash:100` and the `missedEvents`
  wiring inside it. Anonymous load of the live site renders with no console
  errors.
- **No API deploy**: none of the three commits touch `apps/api` or
  `packages/shared`.

`eas` needs `EXPO_TOKEN` from `langx/.env` exported explicitly; sourcing the
whole file silently fails. `npx eas-cli workflow:runs` and `channel:view
preview` are how to check from here.

### What is still to do

1. Relaunch build 120 on the iPhone once the OTA has landed (`Preview update`
   on expo.dev; its status could not be read from here, `EXPO_TOKEN` in
   `langx/.env` is empty).
2. Message while the app is open on Discover → banner at once, tap opens chat.
3. Message while backgrounded > 1 min → OS notification, tap opens the chat
   **with the new message visible**.
4. Only when 2 and 3 pass: delete the `pushtest` account from production
   (`user`/`session`/`account` in ObjectId form, profile in string form, the
   conversation and its messages, any `devices` row).

Known and deliberately untouched: for ~45 s after a resume the server may
still see the old socket in the user's room, so a message sent in that window
gets neither a push nor a delivery stamp until the ping timeout. Fan-out
semantics, not either of these bugs.

---

Paste everything below the line into a fresh `claude` session. Work in plan
mode first: read, reproduce what you can, write the plan, then build.

---

You are working in the LangX v2 monorepo (`langx/`: Expo + Fastify +
MongoDB, pnpm workspace, **public repo**). Read `CLAUDE.md`,
`docs/architecture.md` and the notification entries at the end of
`docs/decisions.md` before touching anything. Reply in Turkish; everything
committed is English. Branch from `origin/main`, open a PR, never push to
main; the shared checkout may be switched under you by other sessions, so
work in a worktree (`git worktree add /root/wt-<name> origin/main`).
`pnpm test`, `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check` before
pushing. Do **not** start any EAS cloud build; a merge to main publishes an
over-the-air update to the `preview` channel on its own, and TestFlight
build 120 on Behic's iPhone picks it up on the next launch. That is how the
fix reaches the phone.

## What happened

3 September 2026, TestFlight build 120 (first time this app ever ran on an
iOS device), Behic signed in as `xue2` (user id `6a99c4b1083e5d208f05b4ae`)
against production `api.langx.io`. A throwaway sender exists in production:
handle `pushtest`, user id `6a99c71c083e5d208f05b4b2`, email
`<tester address>`, conversation `6a99c832083e5d208f05b4bc`.
Its session cookie jar is on the droplet at `/tmp/pushtest.jar`; there is no
REST route for sending, messages go over socket.io:

```js
// run from apps/api so socket.io-client resolves; COOKIE = "<name>=<value>" from the jar
import { io } from 'socket.io-client'
const s = io('https://api.langx.io', {
  transports: ['websocket'],
  auth: { cookie: process.env.COOKIE },
})
s.on('connect', () =>
  s.emit('message:send', { conversationId: '6a99c832083e5d208f05b4bc', body: '…' }, (ack) => {
    console.log(ack)
    s.close()
  }),
)
```

Push delivery itself is proven: a `profileVisits` push from the runbook curl
arrived (Expo ticket and receipt `ok`), and a message sent while the app was
backgrounded arrived as an OS notification whose tap opened the right chat.

### Bug 1 — the in-app message banner did not show, then showed late

Message 1 was sent while the app was open on a tab other than the thread.
Fly logs show that 300 ms later the phone refetched
`GET /conversations?filter=all`, `GET /me/tokens` and
`GET /profiles/6a99c71c…` (the sender) — so `useSocket`'s `message:new`
handler ran, and something asked for the sender's profile, which is what
`MessageBannerHost` does through `useProfileCache`. `xue2`'s prefs are the
defaults (`messages.push: true`), `me` was cached (`/profiles/me` had been
fetched). Behic saw no banner.

Later — after message 2 had arrived as an OS notification and he had tapped
into the chat, then moved around the app — a banner **did** appear. So the
absolute layer in `MessageBannerHost` can paint on iOS; what needs explaining
is why it was not visible at the moment of message 1 and why one appeared
later. Hypotheses to test, not conclusions:

- The `Animated.timing` on `slide` with `useNativeDriver: true` and a fresh
  `Animated.Value(0)` — is the effect ordering on native such that the view
  mounted at opacity 0 and the animation never ran, until a later re-render?
- `AppState.currentState` on iOS right after launch can be `unknown`, not
  `active`; the decision then falls through correctly to `banner`, so this is
  probably not it, but check.
- `foregroundPush.ts` / `useNotificationRouting`'s `addNotificationReceivedListener`
  path: the later banner may have come from a **push** received while
  foregrounded (socket reconnecting after background), not from the socket —
  which would mean the socket path never drew and the push path did. Compare
  the two code paths; they must end in the same `showMessageBanner`.
- A banner replaced by the 5 s timer of an earlier, invisible one
  (`replace-not-queue` keyed on `banner.id`).
- The tab he was on: `chat/[id]` stays mounted as a hidden tab, so
  `activeConversation` may have still pointed at a thread from an earlier
  visit if `useFocusEffect`'s cleanup did not run on iOS the way it does on
  web. If `activeConversationId === message.conversationId`, the decision is
  `markRead` and no banner — and the phone did POST
  `/conversations/…/read` at some point. Check the order of that request
  against the messages.

Relevant files: `apps/mobile/src/components/MessageBannerHost.tsx`,
`apps/mobile/src/lib/{inAppNotifications,activeConversation,foregroundPush}.ts`,
`apps/mobile/src/hooks/{useSocket,useNotificationRouting}.ts`,
`apps/mobile/app/(app)/chat/[id].tsx`, `apps/mobile/app/_layout.tsx`
(hosts render after `<Stack>`). Tests live in `apps/mobile/src/lib/*.test.ts`;
mobile vitest cannot import react-native, so keep decisions in `src/lib`.

### Bug 2 — a chat opened from a push shows stale messages

Tapping the OS notification for message 2 opened the correct thread, but
message 2 was not in the list. While backgrounded the socket was down, so
the `message:new` cache patch never happened; `useNotificationRouting`
navigates but does not invalidate `keys.messages(conversationId)` (or the
conversation list). Decide where the refetch belongs — the routing hook, the
chat screen's focus effect, or a socket reconnect handler that invalidates
what it missed — and pick the one that also covers the general "app came
back from background" case, not only the notification tap. Look at how
`useSocket` handles reconnect and what `markConversationRead` invalidates
already.

## Deliverable

1. A plan first (plan mode), with the hypothesis for bug 1 you could confirm
   from code or a local reproduction, and the chosen place for bug 2's
   refetch.
2. One PR, or two if the fixes are unrelated, with unit tests for the
   decision logic and a `docs/decisions.md` entry if a rule changes.
3. After merge, wait for the `Preview update` workflow run on expo.dev to
   finish (about 15 minutes), then tell Behic to relaunch the app and run
   the two device tests again: message while the app is open on Discover →
   banner at once, tap opens the chat; message while backgrounded → OS
   notification, tap opens the chat **with the new message visible**.
4. When both pass, delete the `pushtest` account, its `user`/`session`/
   `account` rows, the profile and the conversation from production
   (`MONGODB_URI` in `langx/.env`, db `langx`), and say so.

Do not change what the `messages/push` switch means, do not widen
`TRUSTED_ORIGINS`, do not touch the API's fan-out unless the evidence points
there.
