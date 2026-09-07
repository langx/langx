# Design handoff follow-ups — plan

Written on 7 September 2026, after the v3 screen handoff (`LangX App.dc.html`,
one prototype screen per route) was implemented on
`mobile/design-handoff-all-screens`. That pass matched every screen to its
prototype block but stopped in two places: five judgement calls where the app's
behaviour and the prototype disagreed, and ten elements the prototype shows for
which the API carries no data. Behic's decision on both: **make it like the
design.** This plan says how.

## Status on 7 September 2026

Not started. The screen pass itself is on the branch above, uncommitted, with
typecheck, lint, tests and prettier green. Part A below is mobile-only and can
land on the same branch; Part B changes `packages/shared` and `apps/api` and
needs an API deploy before the app can read the new fields — every new field is
therefore optional on the wire, and the app draws nothing for it until the API
answers.

## Part A — the five judgement calls, resolved towards the prototype

### A1. Onboarding order: about-you → handle → photo

Today: `languages → levels → about-you → photo → handle`, and `handle` is the
submit step (`POST /profiles` with the whole draft, including `avatarUrl` and
`bio`). The prototype puts the username before the photo and makes the photo
the last, optional screen ("Start using LangX" / "Skip for now").

- `src/lib/onboardingStep.ts`: `ONBOARDING_STEPS = ['languages','levels','about-you','handle','photo']`.
  `furthestOnboardingStep` may now return `'handle'` (after `about-you` is
  complete) — the note saying it never does describes the old order and goes.
  `GUEST_ONBOARDING_STEPS` unchanged.
- `app/(onboarding)/handle.tsx`: keeps the claim, the v1 reservation lookup and
  `POST /profiles`, but posts **without** `avatarUrl`/`bio` and then
  `router.replace('/(onboarding)/photo')`. CTA becomes "Continue".
- `app/(onboarding)/photo.tsx`: the profile now exists, so the photo and bio are
  written with the existing `PATCH /profiles/me` (`useUpdateProfile`) — upload
  as today, then patch `avatarUrl`/`bio`; "Start using LangX" saves and goes to
  `done`, "Skip for now" goes to `done` without patching.
- `AppGate` / cold start: a profile without a photo is a complete profile (the
  photo is optional in the prototype too), so a kill between `handle` and
  `photo` lands on Discover — the same outcome as tapping Skip. No gate change.
- Step numbers follow from the array; `StepProgress` needs nothing.
- Tests: `onboardingStep.test.ts` (new order, `handle` reachable), route
  literals test picks up the new `replace`.
- Docs: the onboarding paragraph in `docs/architecture.md` and the entry in
  `docs/decisions.md` that argued for handle-last need a dated addendum.

Size: M. Risk: low — the API contract does not change; `POST /profiles`
already treats `avatarUrl`/`bio` as optional.

### A2. Settings search results open the section page

Already done in the screen pass (rows navigate to their category, as the
prototype draws them). Nothing left.

### A3. Sign-up without the Name field

Better Auth's `signUp.email` requires a non-empty `name`, and about-you seeds the
display name from it. Drop the field and send a derived name:

- `app/(auth)/sign-up.tsx`: remove the Name `FormField`; call
  `signUp.email({ name: nameFromEmail(email), email, password })`.
- `src/lib/seedDisplayName.ts`: add `nameFromEmail(email)` — the local part,
  with `.`/`_`/digits trimmed to something a person would accept as a first
  guess ("alex.m94@…" → "alex"); a pure helper with a test, because about-you
  will show exactly this string in its field.
- `auth.name`, `auth.namePlaceholder` become unused → prune from the 8 locales.

Size: S. Confirm password was already removed in the screen pass.

### A4. No worn title on the public profile

The prototype's profile hero is name + age. Remove the `CosmeticTitle` that the
screen pass restored (`app/(app)/profile/[handle].tsx`, one element and its
comment). The title stays visible on the Me tab, where it was bought.

Size: XS.

### A5. "Send a message" opens the chat directly

The prototype's button goes straight to a chat screen with an empty thread and
the composer ("Say hello to {name}…"); today the profile reveals an inline
composer because a conversation can only be created with its first message.

- Route: `/(app)/chat/new?to=<userId>` — a new `app/(app)/chat/new.tsx` that
  renders the same header (partner from `useProfileCache`), the empty thread
  with the opening tip, and the composer. Its send calls the existing
  `useStartConversation` (`POST /conversations { toUserId, body }`) and on
  success `router.replace('/(app)/chat/<id>')`. Quota refusals open the paywall
  the way the profile's composer does today; `requireAccount` gates guests.
- To share the composer without touching the 60 KB thread screen's gesture
  code, lift the composer row (input, attach, send/mic) into
  `src/components/ChatComposer.tsx` and have both screens use it. The new
  screen sends text only — attachments and voice notes still need a
  conversation id, so they stay disabled there with the existing quota-style
  hint.
- Profile: the primary button becomes `router.push('/(app)/chat/new?to=…')` when
  no conversation exists; the inline composer, `composing` state and its keys
  go.
- Route literals test covers the new path; `(app)/_layout.tsx` gets the new
  screen with the same edge-only gesture as `chat/[id]`.

Size: M.

## Part B — data the prototype shows and the API does not carry

Every item adds an **optional** field so a mobile build that ships first, or an
API that ships first, is harmless. Repository functions own the queries, per
the house rule; no handler touches a collection.

### B1. "For {name}" on the corrections list

`GET /me/corrections` returns message views with `conversationId` only.

- API `modules/chat/messages.ts` → `listCorrectionsWritten`: `$lookup` the
  conversation and emit `recipientId` (the participant who is not the viewer).
  Route maps it onto each item.
- Shared: `correctionsPageSchema` item = message view + `recipientId?: string`.
- Mobile `corrections.tsx`: `useProfileCache(recipientIds)` (already used by
  Starred) → "For {name}" 700 13 success as the prototype.

Size: S.

### B2. Reporting a post

`reportSchema` targets a user, optionally narrowed by conversation/message.

- Shared `moderation.ts`: add `postId?: string` (and `commentId?: string`, same
  shape), the same "narrower pointer kept alongside" pattern as `messageId`.
- API `reportUser`: store the pointers; the reports index and the
  `REPORTS_TO_FREEZE_XP` rule are per reported user and unchanged.
- Mobile: `useReportUser` input gains `postId`; the post's more-sheet gets
  "Report" (destructive) → the same reason chooser the profile uses, posting
  `{ userId: post.author._id, postId, reason }`.

Size: S.

### B3. Pin / archive from the chat header

The thread screen has messages only; the conversation's own flags live in the
list DTO.

- API: `GET /conversations/:id` → `conversationView(conversation, viewerId)`
  behind `requireMember` (the view already has `pinned`/`archived`).
- Mobile: `useConversation(id)` — initial data from the `useConversations`
  cache, fetch as fallback; the header sheet gains "Pin chat/Unpin chat" and
  "Archive/Unarchive" using the mutations `chats.tsx` already has; invalidate
  the list.

Size: S.

### B4. Blocked count on the Account page

- API `listBlocked`: add `total: countDocuments({ blockerId })` to the page.
- Shared `blockPageSchema`: `total?: number`.
- Mobile Account row: `value={String(blocks.data?.pages[0]?.total ?? '')}` from
  the existing `useBlocks` (first page only).

Size: XS.

### B5. Connect / disconnect Google and Apple

Better Auth ships account linking; the screen left it out for want of a
last-method rule. The rule is the server's:

- API `auth.ts`: `account.accountLinking = { enabled: true, trustedProviders:
['google', 'apple'], allowUnlinkingAll: false }` — the last way in cannot be
  removed, whatever the client sends. Rate-limit the link/unlink routes like
  `/me/password`.
- `/me/sign-in-methods`: include each linked account's `accountId` and
  `providerId` (needed by `unlinkAccount`) — shared schema grows two optional
  fields per provider.
- Mobile `useSignInMethods.ts`: `useLinkProvider` → `authClient.linkSocial({
provider, callbackURL })` on web/Android, and `linkSocial({ provider: 'apple',
idToken })` from `requestAppleIdentity` on iOS, mirroring `SocialAuthButtons`;
  `useUnlinkProvider` → `authClient.unlinkAccount({ providerId, accountId })`.
  Both invalidate `SIGN_IN_METHODS_KEY`.
- Screen: "Connect" (accent) on an unlinked provider, "Disconnect" (danger) on a
  linked one — disabled with an explanation when it is the only method and
  there is no password, so the server's refusal is never the first time the
  person hears about it. Confirm the disconnect with `confirmAlert`.
- Verify the client method names against Better Auth 1.7.1 first; the
  installed types are bundled and were not grepped conclusively.

Size: M. Risk: this is the one item that widens the account-takeover surface;
the rate limit and the server-side last-method rule are the mitigations.

### B6. "N people in the last week" on Viewers

`getViewers` computes `total` (distinct viewers, all time) and `week` (visits
per day). Add `weekPeople`: `distinct('viewerId', { …filter, createdAt: { $gte:
now − 7d } }).length`, with the same hidden/incognito filter. Shared
`viewersPageSchema.weekPeople?: number`; mobile line becomes the prototype's
"{count} people in the last week" (plural key `viewers.weekPeople`), falling
back to the visits sentence while the field is absent.

Size: S.

### B7. "N active yesterday" on the pool page

The payout writes a `JobRun` per day and the user's share to the ledger;
`lastPayout` exposes `{ day, amount }`.

- `pool.ts` `runDailyPool`: record `candidates` (users with a positive score
  that day) and `paid` on the run document when it completes.
- `readLastPoolPayout`: join the run for that day → `lastPayout.participants`.
- Shared `tokenSummarySchema.pool.lastPayout.participants?: number`; mobile pool
  block adds "{count} active that day" under the share.

Size: S.

### B8. Contributors on Our Kitchen

No data anywhere. Source it from GitHub and degrade to nothing:

- API `modules/kitchen/contributors.ts`: fetch
  `https://api.github.com/repos/langx/langx/contributors?per_page=100`
  (optional `GITHUB_TOKEN` for the higher limit, never required), keep the last
  good answer in memory and in a `cache` document so a rate-limited hour serves
  yesterday's list; expose `GET /public/contributors` → `{ total, top: [{
login, avatarUrl, url }] }` (public CORS path). Unavailable = `{ total: 0,
top: [] }` and the app draws nothing.
- Mobile `useContributors()` + the prototype's strip: six 32px avatars, a
  `fill` "+N" pill, caption "Everyone who has contributed", tapping opens the
  contributors page from `KITCHEN_SECTIONS`.

Size: M.

### B9. Monthly equivalent on the yearly paywall row

Both SDKs provide the store's own per-month string, so the "never compute a
price" rule holds: native `product.pricePerMonthString` (null for monthly and
lifetime), web `product.pricePerMonth?.formattedPrice`.

- `purchases.ts` / `webBilling.ts`: `Offer.perMonthPriceString: string | null`.
- Paywall price row: for a yearly offer show `perMonthPriceString` large with
  "/ month · billed yearly" (existing `paywall.perYear` stays for the small
  line), the yearly `priceString` in the footnote; monthly and lifetime
  unchanged. `fakePurchases` gets the field for the dev path.

Size: S.

### B10. The "Top" pill on feed posts

There is no ranking and, by design, nothing may sort by likes or comments.
Define "Top" from what the feed already counts: `correctionCount >=
FEED_TOP_CORRECTIONS` (a new shared constant, proposed 5) → the ink pill on the
card and the post header. Client-side, no API change. **Decision for Behic:**
the threshold, or whether the pill should mean something else.

Size: XS.

## Order

| #   | Item                             | Size | Touches             |
| --- | -------------------------------- | ---- | ------------------- |
| A4  | Hide worn title on profile       | XS   | mobile              |
| A3  | Sign-up without Name             | S    | mobile              |
| B10 | "Top" pill (threshold)           | XS   | shared, mobile      |
| A1  | Onboarding order                 | M    | mobile, docs        |
| A5  | Chat opens directly from profile | M    | mobile              |
| B4  | Blocked count                    | XS   | shared, api, mobile |
| B1  | "For {name}"                     | S    | shared, api, mobile |
| B6  | Viewers week people              | S    | shared, api, mobile |
| B7  | Pool participants                | S    | shared, api, mobile |
| B3  | Pin/archive from chat            | S    | api, mobile         |
| B2  | Post reports                     | S    | shared, api, mobile |
| B9  | Per-month price                  | S    | mobile              |
| B8  | Contributors                     | M    | api, mobile         |
| B5  | Connect/disconnect providers     | M    | api, shared, mobile |

Part A first (no deploy dependency), then the API items grouped into one PR
per field set so each deploy is small. B5 last: it is the only one with a
security surface and the only one that waits on a Better Auth API check.

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check` per PR; API
route tests for every new field (`app.inject`, the pattern in
`apps/api/src/app.test.ts`); the eight locale files stay typed against
English; a device pass over the touched screens against the prototype board.

## Part C — pre-existing issues noticed during the screen pass (fixed 7 September 2026)

These were on the list of things the screen pass saw and left alone; Behic asked
for them to be fixed rather than carried.

- **`(auth)/_layout.tsx` declared a screen that does not exist.** The
  `<Stack.Screen name="index" />` entry survived the move of the one `index` to
  `app/`, and expo-router warned about it on every web load. Removed.
- **The QR sign-in screen let a network failure escape.** `authClient.device.code`
  returns `{ error }` for a refused request but _throws_ when the fetch itself
  fails, and `start()` awaited it bare — an unhandled rejection, the red overlay
  in development and a spinner that never ended in production. The call now
  falls back to the screen's `error` state, and the token poll swallows a
  failed tick so a blip does not end the flow (the next tick asks again).
- **Unused message keys.** The screen pass pruned the 67 keys it had orphaned;
  28 more were removed from all eight locale files: 24 that were already
  unreferenced before it (`common.next`, `paywall.title`, `viewers.empty`, …)
  and 4 the pass had orphaned but the first prune missed, because their
  values wrap onto a second line (`filters.cityBody`, `blocked.emptyBody`, …).
  Two families were deliberately kept although no literal reads them:
  sections addressed through a template key (`tips.*`, `tokenKind.*`,
  `cosmetics.*`, `interests.*`, `settings.appIcon_*`, …) and nested groups
  such as `chats.preview`, which the scan cannot tell from a leaf.
  `settings.deleteConfirmBody`, the example given, is among them: its value
  wrapped onto a second line, which is why the first scan missed it.

## Part D — reported while testing the branch (7 September 2026)

### D1. Every photo on a profile opens full screen

The public profile already opens `PhotoViewer` from its 96px avatar and the
gallery thumbnails do too. What does not: the **Me tab** avatar (80px hero), and
the shared card at `app/[username].tsx`. Also worth deciding: on Edit profile
a tap on the avatar means "change photo", which should stay.

- `me.tsx`: wrap the `Avatar` in a `Pressable` when `profile.avatarUrl` is set
  (the same `viewer` state + `PhotoViewer` the public profile uses; a generated
  face or initials is not a photo, so nothing opens then).
- `[username].tsx`: same wrapper.
- Accessibility label "Open photo" via the existing `photo.*` keys.

Size: XS.

### D2. Bug — the ✕ cannot be pressed when a message photo fills the screen

`PhotoViewer` draws the close disc as a sibling _after_ the gesture layer with
`position: absolute; zIndex: 1`, and the gesture layer claims every touch
inside its own subtree (`onStartShouldSetPanResponder: () => true`). In tree
order that should still leave the disc on top; the report says it is not once
the picture covers the whole stage, which points at platform-specific
z-ordering rather than the responder logic:

- **Web:** the stage carries `touchAction: none` and a CSS `transform`; on
  react-native-web the transformed layer can paint over an absolutely
  positioned sibling depending on how the parent establishes its stacking
  context. Fix: give the chrome its own full-screen sibling `View` with
  `pointerEvents="box-none"`, rendered after the stage, with `zIndex` **and**
  `elevation` set, and `position: relative` on the backdrop so the stacking
  context is the backdrop's.
- **Android:** `zIndex` between siblings needs `elevation` to reorder touch
  targets when one of them is transformed — same fix.
- **Belt and braces:** have `onStartShouldSetPanResponder` refuse a touch whose
  `pageY` lands inside the close disc's rectangle (top inset + 8 … + 36), so
  even a view that paints underneath cannot steal the tap.
- Reproduce first on the platform the report came from (web, iOS or Android —
  ask), then confirm on the other two; add the photo-open → close → reopen
  path to the manual device checklist.

Size: S.

### D3. Chat header shows "?" while the partner profile loads

`chat/[id].tsx` reads the partner through `useProfileCache` and, until it
answers, falls back to `'?'` for the avatar initials and the generic screen
title for the name — a real-looking header with wrong content.

- While `partner` is undefined and the profile query is pending: a 40px
  `Skeleton` disc where the avatar goes, a 120×14 bar for the name and an
  80×12 bar for the presence line (`ui/Skeleton` already pulses).
- Keep the `'?'`/title fallback only for the genuinely missing partner (a
  deleted account), which is a different state and should read as one.
- Same treatment on the `chat/new` screen once A5 lands, since it takes its
  partner from the same cache.

Size: XS.
