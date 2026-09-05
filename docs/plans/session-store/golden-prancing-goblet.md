# Seven PRs: boards, store, delete-post, my-posts, device sign-in, feed composer, avatars

> **Provenance.** Written by the session `465ce8ee-170c-5011-b188-19397e508267`
> ("Leaderboard for streaks", plan file `did-we-write-any-enchanted-meteor.md`),
> which went offline at its `ExitPlanMode` call on 2026-09-03 04:14 UTC. That
> session implemented nothing: no branch, no worktree, no commit. This is the
> on-disk version of its plan, carried over unchanged so the work can continue
> here. Line numbers were read on 2026-09-03 against `origin/main`; re-verify
> each before editing, since `main` has moved since.

# Step 0 — Sync `main` first (Behic, 2026-09-03: "herşeyden önce main sync")

State read on 2026-09-03 before any change: local `main` is 0 ahead / 26 behind
`origin/main` as of the last fetch (03:45 UTC), so the sync is a pure
fast-forward. `main` is checked out in the worktree `/root/wt-chats-header`
(clean, at `a055fd59`), not in `/root/Developer/langx/langx` (which sits on
`docs/store-privacy-forms-checklist`, clean). Peers `langx-cd` and `langx-d0`
are live on this machine, so touch nothing but the `main` ref.

```bash
cd /root/Developer/langx/langx && git fetch origin
git -C /root/wt-chats-header merge --ff-only origin/main   # main lives there
git rev-list --left-right --count main...origin/main       # expect 0 0
```

If `--ff-only` refuses, stop and report — it means somebody committed to local
`main` since the read above, and the memory note "local main runs ahead of
origin" applies again. Then branch every PR below from `origin/main` in its own
worktree (`/root/wt-<name>`), `pnpm install` in each.

---

Each point is prefixed with how **settled** it is (~%). Anything under ~80% has
an open question stated inline.

Recommended order: **PR 3 → PR 6 → PR 5 → PR 4 → PR 7 → PR 1 → PR 2**. PR 3, 6
and 5 fix live bugs and are small; PR 2 builds on PR 1's wallet layout.

---

# Context

**Scroll.** `app/(app)/leaderboard.tsx` is `<Screen fluid>`, a plain non-scrolling
`View` (`src/components/ui/Screen.tsx:38, 54, 61-62` — `fluid` only gives the
column `flex: 1`). A tall unvirtualised `BadgeGrid` and a milestone card sit as
siblings above an infinite `FlatList`; the static block eats the viewport, the list
is squeezed to near-zero height, nothing above it scrolls. The page reads as frozen.

**One board.** Ranking is by tokens only. `streak` already ships on every
`LeaderboardEntry` (`packages/shared/src/leaderboard.ts:39`) and is never drawn.

**The freeze does nothing visible.** `purchase()` (`apps/api/src/modules/tokens/wallet.ts:74-160`)
increments `streakFreezes` and charges 200; it never touches `streak.*`. A banked
freeze is spent later by `advance()` (`modules/tokens/streak.ts:126-135`), only for
a one-day gap and only if today is not yet credited — but `useDailyCheckIn` fires on
every foreground (`app/(app)/_layout.tsx:53`), so today is always already claimed
by the time the wallet opens. `wallet.tsx:140` is bare `purchase.mutate(id)`: no
toast, no error. The retroactive fix already exists and is well tested —
`repairDay` (`wallet.ts:318-445`, `POST /me/activity/repair`) — but is only
reachable from a heatmap square on `/me`. Decided: keep the freeze prospective
(the price ladder in `packages/shared/src/token.ts:173-190` is deliberate) and
**sell the repair in the store**.

**Delete post does nothing on web.** `feed.tsx:6,256` and `post/[id].tsx:6,250` are
the last two importers of `Alert` from `react-native`, which `src/lib/alert.ts:1-19`
documents as a no-op on react-native-web.

**"That code is no longer valid."** Better Auth 1.7.1's device plugin requires a
code to be *claimed* by a signed-in `GET /device?user_code=` before `/device/approve`
or `/device/deny` will accept it (`node_modules/better-auth/dist/plugins/device-authorization/routes.mjs:529-548`
claims; `:608-611` and `:672-675` reject an unclaimed code with
`DEVICE_CODE_NOT_CLAIMED`). `app/(app)/link-device.tsx:47` calls `approve` directly,
never claims, and maps every error to `linkDevice.failed`. Approving has therefore
never worked from the phone. The camera-scanner idea is dropped — a native build
for six keystrokes — in favour of a QR that is a deep link.

---

# PR 1 — Streak leaderboard, and boards that scroll

- **Badges page** — badges only, no board, scrolls.
- **Streak page** — gains a streak board, two tabs _Şu an_ / _En uzun_.
- **Wallet page** — gains the token board directly under the balance, four period tabs.

Both boards are plain `.map()` sections inside the existing `Screen scroll`
ScrollViews — no `FlatList`, so no nested-VirtualizedList and no infinite-scroll
trap pushing the store away. Cost: one page (top 50) plus the viewer's pinned row.

Contradicts `langx/docs/learn-module.md:220` ("No new leaderboard…"); amend it.

## Backend

### ~95% — `packages/shared/src/leaderboard.ts`

```ts
export const STREAK_METRICS = ['current', 'longest'] as const
export const streakLeaderboardQuerySchema = z.object({
  metric: z.enum(STREAK_METRICS).default('current'),
  limit: z.coerce.number().int().min(1).max(LEADERBOARD_PAGE_SIZE).default(50),
})
// streakLeaderboardEntrySchema: rank, userId, handle, displayName, avatarUrl?, streak, frame?, title?, isViewer
// streakLeaderboardSchema: metric, entries, viewer { rank: int|null, streak: int, inPage }
```

No cursor, no period — a streak is not per-period (`periods.ts:1-11`). Export from `index.ts`.

### ~90% — `apps/api/src/modules/tokens/streakLeaderboard.ts` (new)

Mirror `modules/tokens/leaderboard.ts`; **export and reuse `rankOf`** (`:26-33`).
Source `COLLECTIONS.profiles`.

- Base filter `{ deletedAt: { $exists: false } }`.
- `current` adds the **liveness rule**: `'streak.current': {$gte: 1}`,
  `'streak.lastQualifiedDay': {$gte: shiftDayKey(utcDayKey(at), -1)}`. Nothing decays
  `streak.current` (writers: `streak.ts:142-153`, `wallet.ts:278`, `wallet.ts:~415`),
  so without this the board is ghosts. UTC on purpose so page and rank queries agree;
  generous by ≤1 day across timezones — comment it.
- `longest` adds `{ 'streak.longest': { $gte: 1 } }` only.
- Sort `{ [field]: -1, _id: 1 }`; blocks removed **after** ranking via
  `blockedUserIds` (`modules/moderation/blocks.ts:47`), gap preserved as `leaderboard.ts:161`;
  cosmetics via `wornCosmetic` as `:176-179`; viewer rank =
  `countDocuments({...filter, [field]: {$gt: mine}}) + 1`, `null` when 0 or not live.

### ~95% — `apps/api/src/db/indexes.ts`

New names under `profiles`: `{ 'streak.current': -1, _id: 1 }` → `streak_current_board`,
`{ 'streak.longest': -1, _id: 1 }` → `streak_longest_board`. `lastQualifiedDay` stays
a residual predicate. Also fixes the unindexed scan in `modules/push/devices.ts:225-235`.

### ~95% — `apps/api/src/routes/leaderboard.ts`

`GET /leaderboard/streak`, `requireAuth`, `querystring: streakLeaderboardQuerySchema`.
Separate route because the params differ; note the divergence from the "one endpoint" comment.

### ~90% — `apps/api/src/routes/leaderboard.test.ts`

New `describe('streak leaderboard')` beside `describe('leaderboards')` (`:383`):
ranks by current; ties agree with the count-based rank; **stale streak absent from
`current`, present on `longest`**; yesterday still counts; blocked leaves a gap;
soft-deleted excluded; viewer outside the page gets a rank.

## Mobile

### ~90% — `src/components/LeaderboardSection.tsx` (new)

Lift `leaderboard.tsx:119-210` + styles; `FlatList` → `.map()`. Props: `title,
options, selected, onSelect, pickerLabel, entries, viewer, valueOf, loading,
emptyTitle, emptyBody, backTo, share?`. `valueOf` is the only difference between
the boards. `SegmentedControl` is already generic.

### ~90% — `src/api/queries.ts` / `types.ts`

- `useLeaderboard(period, limit = 50)` becomes a **plain `useQuery`** — the
  infinite variant loses its only caller when the dedicated screen goes.
- `useStreakLeaderboard(metric)` → `/leaderboard/streak?metric=…`, key
  `['leaderboard', 'streak', metric]`. Re-export the types.

### ~90% — `app/(app)/wallet.tsx`

Stays `Screen scroll`. Insert the section between the balance `Pressable` (`:105`)
and `styles.tiles` (`:107`); four period tabs; share-rank button moves here
(`leaderboardShareText` is period-keyed); extend `refresh()`.

### ~85% — `app/(app)/streak.tsx`

Stays `Screen scroll`. Section **after** the 60-day history (`:120`) — the history is
why the page is opened. One-block move if it reads better higher. No share button.

### ~90% — `app/(app)/leaderboard.tsx` → `badges.tsx`

Delete the board block and its imports; `<Screen fluid>` → `<Screen scroll
onRefresh refreshing>` (**the scroll fix**). Rename; update `_layout.tsx:129`
(`name="badges"`, must stay `FULL_SCREEN`), `me.tsx:200`, and grep
`'/(app)/leaderboard'` incl. `notificationRoute.ts`. Run the PR #976 route test.

### ~95% — i18n, eight locales

`leaderboard.streakTitle`, `metricCurrent`, `metricLongest`, `streakPicker`,
`streakEmptyTitle`, `streakEmptyBody`; TR `'Seri tablosu'`, `'Şu an'`, `'En uzun'`.
Drop dead `leaderboard.dayStreak`.

### ~90% — Docs

`learn-module.md:220`, `architecture.md:513`, `decisions.md`. GitBook copies in
`/root/Developer/langx/docs` (`token/utility.md`, `token/README.md`,
`learn-2-earn/daily-tokens.md`, `library/day-streaks.md`) still say four tabs — flagged.

---

# PR 2 — Sell the day repair in the store; make the store speak

No API change.

### ~95% — Move `isRepairable` into `packages/shared/src/token.ts`

From `apps/api/src/modules/tokens/streakDays.ts:144-150`, next to `streakFromDays`;
re-export from `streakDays.ts`. Drop the redundant `timeZone`/`now` params →
`isRepairable(day, today)`. Tests move from `streakDays.test.ts:44-64`.

### ~90% — `src/lib/storeOffers.ts`

`StoreOffer.repairDay?: string` (explicit, not an id-prefix parse; keep
`id: 'dayRepair:<day>'` for the key, matching `wallet.ts:377`). `StoreInput.repair?:
{ today, filled, price, usedThisMonth }`. Walk back from yesterday to
`today - dayRepairMaxAgeDays`, take the **newest** unfilled repairable day, push it
below the freeze when `perMonth - usedThisMonth > 0`. Stays pure.

### ~90% — `src/lib/repairFlow.ts` (new), shared with `ActivityMap`

Extract `ActivityMap.tsx:105-157` verbatim as `confirmAndRepair(...)`; call from
both `ActivityMap` and the wallet.

### ~90% — `app/(app)/wallet.tsx`

`useActivity(today - maxAgeDays, today)` + `useRepairDay()`; `StoreRow.onBuy`
becomes `(offer: StoreOffer)`; branch on `offer.repairDay`. And the missing
feedback for every purchase:
`onSuccess: showToast(t('store.bought', {title}))`, `onError: showAlert(t('store.buyFailed'), t('common.retry'))`.

### ~90% — Copy, eight locales

`store.streakFreezeBody` "Saves one missed day" / "Kaçırılan bir günü kurtarır" is
what made the freeze look retroactive → "Covers the next day you miss".
`wallet.disclaimer` add the repair. New: `store.repairDay`, `repairDayBody`,
`bought`, `buyFailed`.

### ~90% — Tests

`storeOffers.test.ts`: newest missed day wins; none when window filled; none at the
monthly cap; none without `repair` input; unaffordable below price, never `locked`.
API side already covered by `tokens.test.ts:660,703,734,788,883`.

---

# PR 3 — Delete post does nothing in the browser

### ~98% — Two call sites

Replace `Alert.alert(...)` with awaited `confirmAlert({ title, message,
confirmLabel, destructive: true })` from `src/lib/alert.ts:102` in
`feed.tsx:255-269` and `post/[id].tsx:248-265`; handlers become `void confirmDelete(...)`;
drop `Alert` from both import lists. Mutation, cache patch (`queries.ts:931-947`),
success toast and error toast already exist. The toast already renders at the top
(`ToastHost.tsx:59-72`). No i18n.

### ~95% — Lint guard, `eslint.config.mjs`

```js
'no-restricted-imports': ['error', { paths: [{ name: 'react-native', importNames: ['Alert'],
  message: 'Alert is a no-op on react-native-web. Use src/lib/alert.' }] }],
```

This is the regression test — mobile vitest cannot load `react-native` and only
reaches `src/lib`.

---

# PR 4 — "Gönderilerim" moves into corrections

### ~90% — `app/(app)/corrections.tsx` gains a `SegmentedControl`

Shape of `follows.tsx:38-57`. Tabs `corrections | posts`; posts tab reuses
`useMyPosts()` and the compact row lifted from `my-posts.tsx:78-95`; each tab keeps
its own `listState`/`EmptyState`/paging. Two lists behind one door, not one list
(`corrections.tsx:22-28` still holds).

### ~90% — Delete `my-posts.tsx` and its route

Remove `_layout.tsx:153`; `openPost(id, '/(app)/my-posts')` → `'/(app)/corrections'`;
grep `'/(app)/my-posts'`; delete `me.tsx:179`.

### ~80% — Title and copy

`corrections.title` now names half the screen. Add `corrections.combinedTitle`
("Yazdıkların" / "Your writing"), `tabCorrections`, `tabPosts`; drop `me.myPosts`.
Open: the exact title word is a copy call.

---

# PR 5 — Device sign-in that works: claim fix, deep-link QR, sessions

**Where the web button is:** `app/(auth)/sign-in.tsx:203-215` on the sign-in screen of
**app2.langx.io**, `Platform.OS === 'web'` only, label `qrSignIn.title` ("Sign in with
your phone"), pushes `/(auth)/qr`. `website/` (langx.io) has no sign-in.

### ~95% — The bug: claim before approve (`app/(app)/link-device.tsx`)

In `decide()`, before `approve`/`deny`, call the claim:

```ts
const claim = await authClient.device({ query: { user_code: userCode } })  // GET /device
if (claim.error || claim.data?.status !== 'pending') { failed; return }
```

Then approve/deny as today. Keep the single `linkDevice.failed` message for
expired/used/unknown (`:52-53` — telling them apart leaks whether a guessed code
was real). Bonus from the claim response: `client_id` and `scope` come back only to
the claiming user (`routes.mjs:549-558`), so the confirmation can say *what* is
being approved — `linkDevice.approving` "Sign-in for {client}" — which strengthens
the security argument in `:16-24` rather than weakening it.

Fix the copy while here: the plugin's default `userCodeLength` is **8**, charset
`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`routes.mjs:9,23,720-723`). `linkDevice.placeholder`
says `ABCDEF` and `auth.ts:194`, `qr.tsx:21`, `link-device` say "six characters".
Server-side `normalizeUserCode` (`:46-47`) already tolerates lowercase, spaces and
hyphens, so the phone's `toUpperCase()` is fine.

### ~85% — The simpler QR: a deep link, not a camera

`apps/api/src/routes/qr.ts:107-109` encodes `https://app2.langx.io/link-device?user_code=X`.
Scanned with the phone's own camera that opens a browser where nobody is signed in.
Change the target to **`langx://link-device?user_code=X`** (`APP_SCHEME` from
`@langx/shared`, already declared in `app.config.ts:40` and trusted by Better Auth).
expo-router resolves it to `(app)/link-device` with `user_code` in params, which
`link-device.tsx:31-34` already reads. Zero native code, ships OTA.

Move the URL builder to `packages/shared` as `deviceLinkTarget(code)` so it is unit
testable; the route test asserts `image/svg+xml` + `no-store`. `verificationUri` in
`auth.ts:207` stays https — it is the human-readable line under the code.

Why not a universal link on `app.langx.io`: verified today with `curl` — that host
still serves **v1** (`last-modified: 27 Jun 2024`) and its AASA comes back as
`application/octet-stream`; `apps/mobile/public/.well-known/` does not exist even
though `release-runbook.md:152-155` says the files are checked in there. That is an
infra migration, not a QR change. **Open (~85%):** some OEM Android cameras ignore
custom schemes; the eight-character code stays printed as the fallback, and if that
proves too common the next step is a public web landing with an "Open in LangX"
button (a tapped scheme link in a browser is reliable everywhere).

### ~85% — Sessions on the same page

Better Auth core already exposes `GET /list-sessions`, `POST /revoke-session {token}`,
`POST /revoke-other-sessions` (`dist/api/routes/session.mjs:340-470`), all mounted by
the `/api/auth/*` catch-all (`routes/auth.ts:28`). Verified: `token`, `ipAddress`,
`userAgent`, `createdAt`, `expiresAt` are all returned.

One config change, `apps/api/src/auth.ts`: `session: { freshAge: 0 }`. Default is
86 400 s and `/list-sessions` sits behind `freshSessionMiddleware`
(`session.mjs:343`, `create-context.mjs:148`) — a phone signed in more than a day
ago gets 403 `SESSION_NOT_FRESH` and could never even *see* the list. The only other
fresh-gated endpoint is `/unlink-account`, which the app never calls. Revocation uses
`sensitiveSessionMiddleware` (authoritative session, no freshness) — unaffected.
Comment all of this at the option.

Mobile:
- `src/api/queries.ts`: `useSessions()` → `authClient.listSessions()`;
  `useRevokeSession()` / `useRevokeOtherSessions()` invalidating it; the device
  approve mutation invalidates it too, so the laptop appears in the list the moment
  approval succeeds — that *is* the "did it work" feedback.
- `src/lib/sessionLabel.ts` (+ test): pure UA → label (`CFNetwork`/`Darwin` → iPhone
  app, `okhttp` → Android app, `Chrome`/`Safari`/`Firefox` + OS, else
  `linkDevice.unknownDevice`).
- `link-device.tsx`: section "Signed-in devices" under the approve form — label,
  `relativeTime(createdAt)`, `ipAddress`, a *this device* chip (compare `token` with
  `authClient.getSession().data.session.token`), per-row "Sign out" via `confirmAlert`
  (never `Alert`), and "Sign out everywhere else". Success toast per action.
- `settings.tsx:283-285` row subtitle → "Approve a sign-in, see where you are signed in".

### ~90% — Tests, `apps/api/src/routes/deviceFlow.test.ts` (new)

Bootstrap as `auth.test.ts:1-80` (replica set, `CapturingEmailSender`, the warm-up
loop), users via `signUpAndSignIn` (`testSupport/authFlow.ts`). Cases:

1. `POST /api/auth/device/code {client_id:'langx-web', scope:'openid'}` → 200,
   `user_code` is 8 chars of the charset, `device_code`, `verification_uri`
2. **approve without claim → 400** — the bug, as lived
3. claim with the phone cookie → 200, `status:'pending'`, `client_id:'langx-web'`
4. approve → 200; web `POST /device/token` → 200 + session cookie; that cookie
   reaches `GET /me`
5. lowercase + hyphenated typed code still resolves
6. a second user cannot approve a code the first has claimed → 403
7. deny → the web poll gets `access_denied`
8. expired code → 400 `expired_token` (set `expiresAt` back via the `deviceCode`
   collection **by `userCode`**, never by `_id` — Better Auth's ids are ObjectId,
   see `lib/authId.ts`)
9. after 4: `GET /list-sessions` (phone) shows two; `POST /revoke-session` with the
   web token → web `GET /me` 401, phone still 200; `revoke-other-sessions` leaves
   only the caller
10. a session with `createdAt` two days back can still list — proves `freshAge: 0`

### ~95% — i18n, eight locales

`linkDevice.approving`, `devices`, `thisDevice`, `signOutDevice`, `signOutOthers`,
`signedOutDevice`, `unknownDevice`; updated `linkDevice.placeholder` (8 chars),
`qrSignIn.body` ("…or scan it with your phone's camera"), `settings.linkDeviceBody`.

### ~90% — Docs

- `auth.ts:194-200`: the QR is now a deep link; the camera reasoning still stands.
- `docs/decisions.md`: there is **no** device-flow entry (grep `link-device`, `8628`
  → nothing). Add one: the claim step, why the QR is a scheme URL, `freshAge: 0`.
- `docs/release-runbook.md:152-155`: the `.well-known` files are **not** checked in;
  fix the false statement and keep the open item honest.
- `docs/architecture.md`: session management surface.

---

# PR 6 — Feed composer: attachment preview, the vanishing Post button, top of the timeline

### ~80% — Why the Post button disappears after attaching (reproduce first)

`composeActions` is a row (`feed.tsx:845`), holding `<AttachmentBar>` and the
`<Button style={styles.grow}>` (`grow: { flex: 1 }`, `:806`). Before a pick the bar
is two 36 px icons. After a pick it becomes a row whose label has `flex: 1, minWidth: 0`
(`AttachmentBar.tsx:96-98,150`). In Yoga a content-sized view containing a `flex: 1`
child measures to the whole width offered to it, and `flexShrink` defaults to **0**
in React Native — so the bar's basis becomes the full row width, the Button's
`flex: 1` gets zero remaining space, and it renders at width 0. Same structure in the
correction composer (`:708-722`), so it is broken there too. This is a reasoned
diagnosis: **reproduce on the isolated web stack with Playwright before touching it**,
and keep the screenshot in the PR.

### ~90% — `src/components/AttachmentBar.tsx`: a preview row, and a bar that never grows

Restructure so the pending state is **not** in the actions row:

- `pending.kind === 'image'` → a 64 px thumbnail (`expo-image`, `contentFit="cover"`,
  `radius.md`, the `PhotoGallery.tsx:80-84` styling at a smaller size) with an `x`
  badge on its top-right corner (`Pressable`, `hitSlop`, `accessibilityLabel
  feed.removeAttachment`) — the detach the user asked for. `PendingAttachment.uri`
  is already there (`AttachmentBar.tsx:9-16`); on web it is a `blob:` URL, which
  `expo-image` renders — verify.
- `pending.kind === 'audio'` → the existing "voice note attached · ×" line.
- The camera/mic icons stay visible in the actions row while something is attached
  only if a second attachment is allowed — it is not (one `pending`), so hide them
  and let the Button take the row. Give the bar `flexShrink: 1` regardless, so no
  future child can starve the Button again.

Rendered as a stacked block: preview row above, actions row below. Both composers
(`feed.tsx:389-399` ask, `:708-722` correction) get it for free.

### ~95% — Toast on share

Already there: `submitAsk` → `onSuccess` → `showToast(t('feed.posted'))`
(`feed.tsx:290-297`, "Paylaşıldı. Birisi düzeltecektir."). Nobody saw it because the
button that triggers it was gone. Keep it; verify it fires in the live pass.

### ~85% — The new post goes to the top of the timeline

Why it lands at the bottom today: `listFeed` stitches two queries
(`apps/api/src/modules/feed/feed.ts:225-266`) — the audience you follow or have
talked to first, then everybody else — and the viewer is excluded from the
audience (`:192-194`), so your own post always falls into the second query, after
every audience post. `useCreatePost.onSuccess` then *invalidates* `['feed']`
(`queries.ts:794-796`), the refetch applies that order, and the post you just
wrote appears wherever that is — for anyone who follows people, the bottom.

Fix on the client, the way `applyCorrection` already does it (`feedCache.ts:18-33`:
"patch, not invalidate; the next natural refetch sorts it away for real"):

- `src/lib/feedCache.ts`: `prependPost(data, post)` — insert at `pages[0].items[0]`,
  drop any existing copy by `_id`, leave `nextCursor` alone.
- `useCreatePost.onSuccess(post)`: `setQueriesData` on `keys.feed(post.kind)` and
  `keys.myPosts()` with `prependPost`; **stop** invalidating `['feed']`. `POST /posts`
  already returns the full `FeedPost` DTO (`routes/feed.ts:65-71`, `createPost:
  Promise<FeedPost>` at `feed.ts:344`), so nothing is missing for the card.
- Tests in `src/lib/feedCache.test.ts` (17 cases already): prepends to page one;
  no duplicate when the post is already loaded; untouched cache when `data` is
  undefined.

Open (~85%): after the next pull-to-refresh the server order returns and the post
moves back down. That is the same accepted behaviour as corrections. Pinning the
viewer's own recent posts first **server-side** would change the queue's product
rule ("fewest answers first, so it drains"); not doing that here, and saying so.

### ~95% — i18n

Nothing new — `feed.removeAttachment`, `feed.photoAttached`, `feed.posted` exist in
all eight locales.

---

# PR 7 — Generated avatars instead of initials (DiceBear Notionists, self-hosted)

Today an account without a photo gets two initials on one of three fills
(`src/components/ui/Avatar.tsx:24-40`), and `avatarUrl` exists only after an
upload (`profiles.ts:328-332`, `:750`). Decided: **Notionists**, deterministic from
`userId`, no picker, with **mild gender steering**: `male` → `beardProbability: 60`,
`female` → `0`, `other` / `undisclosed` → DiceBear's defaults, untouched. Notionists'
hair variants are unnamed (`variant01…63`), so the beard is the only lever taken;
nothing else in the face is gendered on purpose.

Not random: every feature is drawn from a PRNG seeded by the id, so the same
person is the same face on every screen and every device until they upload a photo.

Not Gravatar, and not DiceBear's hosted API: both put a third party between the
device and a picture, Gravatar additionally on an email hash — and
`docs/store/privacy-data-safety.md:55,108` promises exactly one third-party SDK.
Not a client-side SVG library either: `react-native-svg` is a native module the repo
has already refused (`routes/qr.ts:17`). The established pattern is **SVG rendered
by the API, drawn by `expo-image`** — the QR route — and this follows it exactly.

Licenses, verified with `npm view` on 2026-09-03: `@dicebear/core` 10.7.0 MIT,
`@dicebear/notionists` 9.4.2 MIT. No attribution clause.

### ~90% — `apps/api/src/routes/avatar.ts` (new), modelled on `routes/qr.ts`

`GET /public/avatar/:seed`, `seed: z.string().regex(/^[a-f0-9]{24}$/)` (a profile
`_id` is a 24-hex string; a bounded pattern keeps this from being a free SVG
generator). Body:

```ts
const gender = (await profiles.findOne({ _id: seed }, { projection: { gender: 1 } }))?.gender
createAvatar(notionists, {
  seed, size: 128,
  backgroundColor: ['3b6cf6', '009f70', 'f79009', 'ffc409'],  // accent, success, streak, primary — read fine on both schemes
  ...avatarOptionsFor(gender),   // { beardProbability: 60 } | { beardProbability: 0 } | {}
}).toString()
```

**Gender is resolved on the server, from the id — never sent by the client.** Most
DTOs that feed an `<Avatar>` (feed author, chat partner, leaderboard row,
comments) carry no `gender`; a client-supplied `?g=` would give the same person a
beard on one screen and none on the next. One projected `findOne` per request
keeps every screen identical. The lookup goes through a repository function in
`modules/profiles` — no handler queries a collection directly.

Two consequences, both deliberate:

- **An unknown id returns a neutral avatar, 200, not 404.** With a lookup behind
  it this route would otherwise answer "does this account exist?" for any 24-hex
  string; a picture for every id closes that.
- **Cache is `public, max-age=604800`, not `immutable`.** The output is no longer a
  pure function of the URL. Gender is not editable (`profiles.ts:412-425` — the
  one write allowed is `undisclosed` → a value, once), so the only change that can
  ever reach the picture is that single disclosure; a week is fine for it, and a
  cache-busting param would have to carry the very thing it hides.

Headers as the QR route: `image/svg+xml`, the `EMBEDDABLE` CORP header (without it
`app2` refuses `api2` images — server-side invisible, `curl` says 200), `nosniff`
stays on, rate limit `60/min`.

Unauthenticated, like the QR. What a viewer can infer from the beard — male or
female for accounts that chose one — is already in the discovery DTO
(`packages/shared/src/discovery.ts:176`); `other` and `undisclosed` render the
untouched default pool, so an account that kept it private says nothing new. Not
registered under `requireAuth`. The maintenance middleware's `ALWAYS_OPEN` is
`/health`, `/app-config`, `/api/auth/` only (`src/middleware/maintenance.ts:15`) —
`/public/qr` is not on it and this route is not added either: in maintenance the
image fails, `Avatar` falls back to initials via `onError`, and nothing else
depends on it.

The palette is defined **once**, in `packages/shared/src/avatar.ts` beside a
`generatedAvatarUrl(apiUrl, seed)` builder (the `deviceLinkQrUrl` shape), so the
mobile theme and the server cannot drift apart on what "our colours" are.

### ~90% — `src/components/ui/Avatar.tsx`

- New optional `seed?: string`. Fallback order: `url` → `generatedAvatarUrl(API_URL, seed)`
  when `seed` is given → initials. Initials stay **only** as the load-failure and
  no-seed fallback; they stop being what a photoless account looks like.
- `react-native`'s `Image` → `expo-image`'s `Image` (`~57.0.3`, already used by
  `PhotoGallery` and `qr.tsx`): RN's `Image` cannot draw SVG on iOS/Android.
  `onError` → flip to initials. `expo-image` disk-caches, and the URL is immutable.
- `avatarFill` / `initialsOf` stay for the fallback; the doc comment at `:42-46`
  is rewritten — the reason ("a wall of identical grey squares") is now answered
  by the generated picture, not by a letter.

### ~85% — The 18 call sites

Every one passes `url` + `name`; add `seed={<user id>}`. The id is at hand in all
of them: `item._id` / `item.userId` (leaderboard, discover, follows, likes,
viewers, chats `partner._id`), `item.author._id` (feed, post/[id]), `user._id`
(profile/[handle], [username]), `profile._id` (me, edit-profile), `result._id`
(PeopleSearch), `invitee._id`, `blocked` profile id. `EquipPicker.tsx:69` and
`StoreRow.tsx:43` receive a `viewer: { name, avatarUrl }` built in `wallet.tsx:64`
— add `_id` to that object. The `SharedProfile` DTO on `[username].tsx` needs `_id`
projected if it is not (`sharedProfile.ts:43`). Open (~85%): confirm the public
web profile DTO exposes an id; if it deliberately does not, seed with `handle`
there and say so.

Small sizes: `post/[id].tsx:501` draws at 24, `EquipPicker` at 20. Notionists is
line-art and will soften there — accepted when the style was chosen; the live pass
includes a 20/24/28 px screenshot so the decision is made looking at it, and
`Thumbs` is a one-line style swap if it does not hold up.

### ~90% — Tests

- `apps/api/src/routes/avatar.test.ts`: 200 + `image/svg+xml`; CORP header
  present; same id → byte-identical body; different ids differ; an id outside the
  pattern → 400; an id with no profile → 200 (neutral), byte-identical to itself;
  reachable with no cookie; **setting the profile's gender to `female` and then
  `male` changes the bytes, and `undisclosed` matches the unknown-id output for the
  same seed** — the steering is real and the private cases really are neutral.
- `packages/shared`: `avatarOptionsFor(gender)` is a pure table — four cases,
  tested; `generatedAvatarUrl` test next to `deviceLinkQrUrl`'s.
- No mobile unit test can render `Avatar` (vitest reaches `src/lib` only) — the
  live pass is the test.

### ~95% — Docs

- `docs/decisions.md`: why generated, why Notionists, why self-hosted, why not
  Gravatar; the style is one import — swapping it later is not a migration.
- `docs/store/privacy-data-safety.md`: state explicitly that placeholder avatars
  are generated on our own API from the account id — no new third party, nothing
  new collected.
- `docs/architecture.md:139` (Profile photos row) — one clause.

Deploy note: the API side ships with the next `flyctl deploy`; the mobile side is
plain JS and goes over the air. Until the API is deployed, a client with `seed`
support falls back to initials on `onError`, so ordering does not matter.

---

# PR 8 — Unread message count on the Chats tab

Asked for by Behic on 3 September 2026, mid-session, after PR 3 and PR 6 were
open. Not from the peer's plan.

The bottom tab bar shows a message glyph and nothing else, so a message that
arrives while you are on another tab is invisible until you go looking. The
badge is the standard answer and every other surface for it already exists.

Shape, to be confirmed against what the exploration finds:

- **Source of the number.** Prefer a count already carried by the conversations
  list rather than a new endpoint. If the list DTO has no per-thread unread
  field, add the aggregate the push badge already needs, and read it from one
  query rather than summing pages the app may not have loaded.
- **Where it renders.** `apps/mobile/app/(app)/_layout.tsx`, the `chats`
  `Tabs.Screen`. Use whatever badge the tab bar already supports before adding
  a component.
- **When it changes.** The same signals that already move the conversations
  cache: opening a thread clears it, an arriving socket message raises it. No
  polling loop of its own.
- **Cap and empty.** No badge at zero. A large count truncates rather than
  widening the tab.
- **Tests.** Whatever of it is pure goes in `src/lib` so vitest can reach it —
  mobile vitest cannot render a component. Server-side counting gets an API
  test.

Ordering: independent of the other PRs, its own worktree, straight after PR 5.

---

# Verification

Worktree from `origin/main`; `git status` + `ListAgents` first; `pnpm install` in the
worktree.

```bash
pnpm -r typecheck
pnpm --filter @langx/api test -- leaderboard deviceFlow
pnpm --filter @langx/mobile test
pnpm lint && pnpm format:check
```

Live pass on the isolated stack (`:4100` / `:8082`, never `:4000`); raise `inotify`
first; read the Metro log before blaming a change.

**PR 1** (seed: two tied on current, one stale, one high `longest`/broken `current`):
badges page scrolls to the last badge; streak page scrolls into the board; stale user
absent from _Şu an_, present on _En uzun_; ties share a rank; wallet scrolls
balance → board → store → disclaimer; row → profile → back.

**PR 2** (seed: ~1500 tokens, gap two days back): repair row names the day, 600,
repairs left; confirm fills it with toast and moving balance/streak/map; row moves to
the next-oldest gap; gone at the monthly cap; a freeze at a full bank now errors
visibly; the `/me` square still works.

**PR 3**, desktop browser: own post → _Sil_ → dialog appears; confirm removes the card
and toasts at the top; cancel leaves it; detail screen variant navigates back;
`pnpm lint` fails on an `Alert` import.

**PR 4**: no "Gönderilerim" row on the profile; corrections tile → two tabs; each
pages; post → back returns to corrections.

**PR 5**, two browsers on the isolated stack (one signed in as "the phone", one as
"the laptop" on `/qr`): typing the code on the phone side now signs the laptop in,
and the laptop's session appears in the phone's device list; "Sign out" on that row
logs the laptop out on its next request; the QR image decodes to
`langx://link-device?user_code=…` (`zbarimg` on the SVG, or the shared unit test).
The scheme-open itself needs a phone with the app — Android APK, since Expo Go
cannot run this project on iOS.

**PR 6**, desktop browser on the isolated stack: reproduce first — attach a photo,
screenshot the missing button; after the fix the thumbnail shows with an × at its
top-right, × detaches and the icons return, the Post button is visible in both
composers with and without an attachment, posting toasts at the top, and the new
card is the first row of the feed and of the corrections → posts tab; pull-to-refresh
(by inspection) re-sorts it — expected.

**PR 7**: `curl -sI :4100/public/avatar/<id>` → 200, `image/svg+xml`, CORP
`cross-origin`, immutable cache; two seeded users without photos show two different
Notionists faces on discover, chats, leaderboard and the profile; a user with a
photo is unchanged; screenshots at 20, 24, 28 and 40 px to judge legibility;
pointing `API_URL` at a dead port shows initials, not a broken image.

Pull-to-refresh cannot be exercised in a desktop browser. Branch, then PR.

Final order: **PR 3 → PR 6 → PR 5 → PR 4 → PR 7 → PR 1 → PR 2** — the three live
bugs first, smallest to largest; PR 7 before PR 1 so the new board rows already
draw faces.
