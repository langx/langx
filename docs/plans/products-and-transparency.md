# Saved media dates, Venus, and four product pages

Written on 26 October 2026, against `release/3.1` and `main` as they stood that
day. **Status: planned, nothing built.** Every decision below was asked and
answered before this was written; the open points are listed at the end of
each section that has one.

Eight items. One is native and belongs to the 3.1 store build; the other seven
are JavaScript only and ship over the air.

| #   | Work                                                                  | Native | Ships                       |
| --- | --------------------------------------------------------------------- | ------ | --------------------------- |
| 1   | Saved photos and videos dated the moment they are saved               | yes    | `release/3.1` only          |
| 2   | Venus's story closes on a swipe down                                  | no     | `main` → OTA, then into 3.1 |
| 3   | Venus page, and Venus's videos on the streak page                     | no     | `main` → OTA, then into 3.1 |
| 4   | Home's streak row split into Streak and Venus                         | no     | with 3                      |
| 5   | Copilot page, with @copilot "coming soon"                             | no     | with 3 (+ a site PR)        |
| 6   | LangX Token page, and the shared design of the product pages          | no     | with 3                      |
| 7   | Questions and answers on every product page                           | no     | with 3                      |
| 8   | Transparency page (public stats, open source, trust) and Home section | no     | with 3                      |

## 1. Saved media lands at the end of the gallery

Every save to the phone goes through one function, `saveMediaToDevice` in
`apps/mobile/src/lib/saveMedia.ts`: the photo viewer, the chat, the chat
camera's unsent shot, and Venus's videos (`saveVenusVideo` in `venusShare.ts`
calls it with the cached file). A fix there covers all of them.

**iOS is already done on `release/3.1`.** `patches/expo-media-library@57.0.5.patch`
sets `creationDate = Date()` on the asset request. It merged to `main` once
(`a79ed59c0`), was reverted (`bd99c0a8b`, #2057) because a pnpm patch changes
the runtime fingerprint and stopped OTAs reaching 3.0, and came back on the
release branch (`737665fd8`) together with the Dockerfile's `COPY patches`.

**Android is not.** The gallery sorts by `DATE_TAKEN`, which the media scanner
reads from the file itself — EXIF for a photo, `creation_time` for a video. A
weeks-old photo, or a Venus video rendered long before the day it is watched,
lands weeks back.

Decided: fix Android **in the same patch**, by setting `DATE_TAKEN` to now when
the asset is inserted into MediaStore. Not by rewriting metadata in JS, which
would need separate code for photos and videos.

Steps:

1. Confirm the iOS patch applies on `release/3.1` (`pnpm install` clean,
   `patchedDependencies` in the root `package.json`, API image builds).
2. Add the Android change to the patch.
3. Update the comment in `saveMedia.ts`, which says "On iOS", to cover both.
4. Verify on devices, not in tests: on iOS and Android, save a Venus video, a
   photo and a video from a chat, and an unsent camera shot, and check each
   is the last item in the gallery.

**Never on `main`** until the 3.1 store build is out — the same reason as
#2057.

## 2. Venus's story closes on a swipe down

The player is `VenusStoryHost`, a full-screen `Modal`. Today it closes from the
X and from Android's back button; there is no gesture.

- A `Gesture.Pan()` inside a `GestureHandlerRootView` of its own. The root is
  needed because a `Modal` is a separate native window — the comment in
  `PhotoViewer.tsx` explains what Android does without one.
- Down only. The threshold is `dismissDirection` from `lib/pinch.ts`, the one
  `PhotoViewer` uses, not a new number. While dragging, the video follows the
  finger and the ground fades by `dismissProgress`; released short of the
  threshold, it springs back.
- The pan starts only after a short distance, so a tap still pauses and plays
  and the buttons still work.
- Reduce motion: close without the throw.
- A swipe calls the same `onClose`, so watched-state and celebration side
  effects are identical to the X.

## 3. The Venus page, and her videos on the streak page

What exists: one video per streak day and locale (days 1–100 and some later
milestones) listed in `manifest.json` with covers; day 1 has an intro cut and a
return cut (`venusCutFor`). The player only opens today's. The free
`stickers.venus` pack of thirty, with a WhatsApp export on 3.1 behind
`whatsappStickers`.

**On the streak page:** a horizontal strip of day covers between the hero and
the ladder. Today first and marked if unwatched; reached days play; days not
reached yet are locked and blurred. The strip's header opens the Venus page.
Drawn only when `flags.venusStories` is on and the manifest has entries. A
"Venus" `StreakLinkRow` beside history and leaderboard, so the page is
reachable even when the strip is not drawn.

**The page** (`app/(app)/venus.tsx`, `screens/VenusScreenV3.tsx`):

1. Hero — Venus, her name, one line, and "Watch the introduction" (day 1's
   intro cut).
2. Who she is — **mascot identity only**: LangX's cat and mascot, with the
   personality the sticker names already give her. No invented personal
   details.
3. What she does — owns the streak: a video a day, milestones, a comeback cut
   when a streak ends. The person's current streak and next milestone, live.
4. The archive — the strip as a grid.
5. Stickers — a preview of the pack, "See the pack", and "Add to WhatsApp"
   where the flag allows.
6. Questions (item 7), and the link out (see below).

**Which days are open:** up to the **longest** streak, so a broken streak does
not take back videos already earned. A pure function in `lib/venusStory.ts`
(`venusUnlockedDays` or similar) with tests.

**The player** learns to open any day, not only today's.

**The link out:** a new Venus page on langx.io, which is work in
`langx/website`. Until it is live the link card is not drawn — a dead link on
a new page is worse than none.

## 4. Home's streak row, split

Today `HomeStreakRow` (`components/home/HomeBlocks.tsx`) has three targets when
there is a video: Venus's face plays it, the words open the streak page, the
play button plays it. The middle of the row looks like Venus and goes
somewhere else.

It becomes two equal cards:

| Streak                       | Venus                                       |
| ---------------------------- | ------------------------------------------- |
| flame on `tangerine`         | `VenusFace` on `sky`                        |
| "12 days", next reward below | "Venus", "Today's video is ready" or "Meet" |
| → `/streak`                  | → `/venus`                                  |

- Each card is one target with its own accessible name.
- **The ▶ stays** in the Venus card's corner and plays today's video directly.
- **The Venus card is there every day.** With no video (flag off, today not
  counted, no file) it has no ▶ and says "Meet"; it still opens the page.
- The unwatched dot comes from `streakRowVenus`'s `ready`; no new rule.
- Side by side unless the screen or the font size will not fit them, then
  stacked.
- The row's own rule is unchanged: no row for a streak of nothing.

## 5. Copilot page

Copilot is four helps inside a chat — Check, Say it, Explain, Reply ideas
(`packages/shared/src/copilot.ts`) — in beta, part of Pro, behind two switches
and a consent. `@copilot` exists as an official account (`officialAccounts.ts`)
with `OFFICIAL_WRITABLE.copilot = false`.

The page (`app/(app)/copilot.tsx`, `screens/CopilotScreenV3.tsx`), drawing on
copilot.langx.io (`langx/copilot`, `site/index.html`):

1. Hero — "Copilot · Beta", one line, "part of Pro".
2. Four helps, each with a small worked example in chat bubbles, labelled as an
   illustration rather than real output. Blue for Copilot; green stays a
   person's correction.
3. When it helps — short scenarios mapped to a help.
4. How to use it — four steps.
5. Trust — only you see it, nothing is sent for you, it can be turned off,
   answers can be reported.
6. **The official Copilot account, "Coming soon"** — `@copilot`'s card with the
   tick and a grey badge. The badge is `OFFICIAL_WRITABLE.copilot === false`,
   so it goes away by itself the day the account opens.
7. One action by state: "Try it in a chat" (Pro, on), "Get it with Pro" (not
   Pro), none (switched off for this person).
8. Questions (item 7), and copilot.langx.io.

**Shown to everybody**, including people for whom Copilot is off — the page
describes it either way; only the action changes.

**Site PR in `langx/copilot`:** its FAQ says the @copilot account is closed and
takes no messages. Change it to "not yet — coming soon" so the app and the site
say the same thing. The site's README makes every claim come from the app.

## 6. LangX Token page, and one family of product pages

The rules are `docs/token-messaging-brief.md`, and the page does not move off
them by a word: an in-app point; not transferable, not purchasable, not
withdrawable, not tradable, not on a chain, unlocks no part of a paid plan.
Feather `award` / `gift`, never a coin. Called "LangX Token". This is the App
Review 3.1.5(b) question.

The page (`app/(app)/token.tsx`, `screens/TokenScreenV3.tsx`), drawing on
token.langx.io (`langx/token-website`):

1. Hero — "In-app points · Can't be bought · Can't be traded".
2. Yours — balance, today, rank, through to the wallet. Accounts only.
3. Earning — messages, corrections (weighted higher), streak bonus, daily
   pool, invites, hourly gift. Every number from `TOKEN_RULES`.
4. The daily pool, as a small diagram.
5. Spending — streak freeze, a missed day back, frames and titles, sticker
   packs; each to its place in the store.
6. What it is not.
7. Questions (item 7), and token.langx.io in the person's locale (`/tr/` etc.).

**Shown to everybody**; the "Yours" section only to an account, with a sign-up
line for a guest.

**One family.** Venus, Copilot, Token and Transparency share a skeleton and
differ in colour, mark and words:

| Page         | Colour                          | Mark           | Link out            |
| ------------ | ------------------------------- | -------------- | ------------------- |
| Venus        | `sky`, `tangerine`              | Venus's face   | langx.io Venus page |
| Copilot      | Copilot's blue                  | Copilot's mark | copilot.langx.io    |
| LangX Token  | a warm v3 hue, not a money gold | `award`        | token.langx.io      |
| Transparency | a green or teal v3 hue          | `bar-chart-2`  | insight.langx.io    |

Shared pieces in `components/product/`: `ProductHero`, `ProductSection`,
`FeatureCard`, `StepList`, `ProductFaq`, `ExternalLinkCard` (through
`lib/openExternal.ts`). Theme tokens, `DISPLAY_FONT`, `SPRING` / `STAGGER`,
existing `Screen` / `Button` / `PressableScale`. No new colours, no hard-coded
sizes; light and dark both.

Cross-links: Token → sticker packs and Venus's pack; Venus → streak; streak →
Venus and Token.

## 7. Questions on every page

`ProductFaq`: expanding rows, one open at a time, open/closed announced, no
animation under reduce motion. Six to eight per page, then the site for the
rest. Every answer is checked against code; numbers come from `TOKEN_RULES`,
`PLAN_LIMITS`, `COPILOT_RULES`; states from flags and `OFFICIAL_WRITABLE`.

Note the wording for tokens: they **are** spent, in the app. What they cannot
be is bought, sold, cashed out or sent to someone.

Draft questions:

- **Token** — Is it a cryptocurrency? Does it have a price, can I buy it? Can I
  sell, cash out or send it? What can I spend it on? Can it pay for Pro? How
  much can I earn a day? Does spending lower my rank? What happened to my v1
  tokens?
- **Copilot** — Is it a person or a tutor? Can it be wrong? Does it ever send
  for me? Can my partner see I used it? How much can I use? What is sent to the
  AI? Which languages? Why don't I see it, and how do I turn it off? Can I chat
  with @copilot? ("Coming soon", from `OFFICIAL_WRITABLE`.)
- **Venus** — Who is Venus? When do videos come? Can I watch days I missed? What
  if my streak breaks? Can I share or save them? Are her stickers free? Can I
  use them in other apps? Are the videos in my language?
- **Transparency** — see item 8.

A test keeps banned words off the Token page's strings (crypto, wallet address,
trade, stake, …) and off the Transparency page's ("end-to-end encrypted",
"100% secure").

## 8. Transparency, and Home's product section

The data exists: `GET /public/stats`, unauthenticated, recomputed at most every
ten minutes (`modules/insight/publicStats.ts`) — totals of members, messages,
corrections and languages; longest streak and members on one today; thirty
days of new members, messages and corrections; most-learned and most-spoken
languages. The line is `docs/insight.md`: no revenue, subscriptions, plan mix,
conversion, retention, channels, or anything keyed to a person. The page reads
`/public/stats` and nothing else; nothing from `/admin/stats` is imported.

The hostname is **`insight.langx.io`**, singular, on purpose — `insight.md`
says why.

The page (`app/(app)/transparency.tsx`, `screens/TransparencyScreenV3.tsx`),
named **Transparency**:

1. Hero — open source, open numbers; "updated n minutes ago" from
   `generatedAt`.
2. Open source card — `langx/langx`, BSD-3, "Read the code" and "Contribute"
   (`CONTRIBUTING.md`). No live star or contributor counts: that is a GitHub
   API dependency and a rate limit for a number that does not need to be live.
3. The four totals, counted up, formatted for the locale.
4. Last 30 days — `Columns`, with a `SegmentedControl` for messages,
   corrections, new members.
5. Teaching over talking — corrections against messages.
6. Languages — two `BarList`s.
7. Streaks — longest ever, on one today; through to streak and Venus.
8. Your data and your safety — four cards, every claim sourced:
   - Auditable: the rules are in the code and enforced on the server
     (`SECURITY.md`, "no security through obscurity").
   - Your data is yours: export (`GET /me/export`) and deletion
     (`settings/delete-account`).
   - This page is bounded: totals only, the smallest group is a language,
     guests and deleted accounts not counted (`insight.md`).
   - Found a hole? Report it privately (`SECURITY.md`).
9. Take part, and support — **Pro first**: it pays for the servers and keeps
   LangX sustainable (a call to support, no counts). Then GitHub Sponsors,
   Patreon, Discord; contributors, issues, releases. Links come from
   `externalLinks.ts`, not retyped.
10. Questions — Are the numbers real? Why no revenue? Are guests counted? How
    often does it update? Is my data here? Is LangX really open source? If the
    code is public, is it safe? Are my messages end-to-end encrypted? (**No** —
    said plainly, with what does protect them, checked against the code before
    it is written.) Can I export or delete my data? How do I contribute? How do
    I support it? I found a vulnerability. Translation contributions are
    **not** mentioned: there is no process for them.
11. insight.langx.io.

Steps:

1. Move `PublicStats` to `packages/shared` as a zod schema and DTO; the API uses
   the shared type.
2. `usePublicStats()`, unauthenticated, cached in step with the API's ten
   minutes; `LoadFailed` and `Skeleton` for the other states.
3. Move `Columns` and `BarList` from `components/admin/` to `components/charts/`;
   the admin screens import them from there. They hold no strings.
4. Open to guests.
5. Our Kitchen's "Insights" row opens this page instead of the site.
6. Tests: the API's response parses with the shared schema; the screen cannot
   import admin queries (lint rule or test); number formatting.

**Not on the page, ever:** "end-to-end encrypted", "100% secure", hostnames, or
where the database lives.

**Home.** Under the split row of item 4, a new section, "LangX", as a 2×2 grid
of equal cards — **Venus · Copilot · LangX Token · Transparency** — each with
its colour, mark, name and one live line ("30 stickers · Day 12", "Beta",
"1,240 tokens", "12,345 members"). Staggered in, `PressableScale`, one column
when it will not fit. Venus is in both places on purpose: the row is today's
video, the card is Venus.

## Order and shipping

1. Item 2, its own PR, to `main`.
2. The product work as a series of PRs to `main`, each shipping by OTA:
   shared components and the chart move; Transparency; Token; Copilot; Venus
   and the streak page; Home. Screenshots of the first — light and dark, small
   and large phone, largest text size — go to review before the rest is
   filled in.
3. Item 1 on `release/3.1`.
4. `main` merged into `release/3.1`.
5. The sites: the Copilot FAQ PR in `langx/copilot`; the Venus page in
   `langx/website`, after which the Venus link card is drawn.
6. The 3.1 test builds, below.

Every PR: `pnpm -r typecheck`, `pnpm lint`, `format:check`, `pnpm test`; every
new string in all eight locales, counts as plural entries; no hard-coded
threshold.

## Last: 3.1 test builds, iOS and Android together

When everything above is on `release/3.1`, build 3.1 for both platforms and
submit both to **testing only**. Neither goes to review.

| Platform | Where it lands                            | Must not happen                        |
| -------- | ----------------------------------------- | -------------------------------------- |
| iOS      | App Store Connect → **TestFlight**        | "Submit for Review" on the 3.1 version |
| Android  | Play Console → **Internal testing** track | anything sent to Google's review       |

**Why Android is the careful one.** A Play submission is already waiting in
review, and has been for a long time. `release-runbook.md` records that a
submission sent while another is in review **restarts** the review. Losing
that place in the queue is the one outcome this step must not have.

What exists: `apps/mobile/.eas/workflows/release.yml` on expo.dev, started by
hand per platform — the `production` build profile, then `eas submit` with
`eas.json`'s `production` submit profile. That profile already sends Android
to `track: internal`, and iOS's `eas submit` only uploads to App Store Connect;
it does not submit the version for review.

Steps:

1. **Before anything is built, check Play Console's publishing overview** and
   confirm that an upload to internal testing will not be sent for review with
   the pending submission: managed publishing on, and nothing queued that a
   new release would carry along. If that cannot be confirmed, stop and ask.
2. **Make "not for review" explicit for Android** in the submit profile used
   for this build — `changesNotSentForReview: true` beside `track: internal` —
   so the upload leaves changes waiting rather than sending them. Check
   against the Play Console state from step 1 that the API accepts the flag
   there; it refuses it in some publishing modes. On `release/3.1` only.
3. **Preflight**, before spending builds (the free plan is 15 per platform a
   month): `apps/mobile/package.json` is `3.1.0`; the iOS patch and Android
   date change from item 1 and the video-filter and WhatsApp native modules
   are on the branch; `EXPO_PUBLIC_API_URL` in the `production` profile is the
   production API, not localhost; typecheck, lint, format and tests pass on
   `release/3.1`.
4. **Build and submit both** from `release/3.1` — `release.yml` once with
   `android` and once with `ios`, or `eas build --platform all --profile
production` followed by `eas submit`. Started on expo.dev with the
   project's credentials: this container has no Expo token, so the run is
   started by someone signed in to EAS.
5. **Check where each landed**: iOS build processed and visible in TestFlight
   (internal testers, no Beta App Review); Android release on the Internal
   testing track, and the pending review in Play Console **unchanged**.
6. **Do not**: press "Submit for Review" in App Store Connect, promote the
   Android release to closed, open or production testing, or file Play's
   declarations for 3.1 — each of those is a review, and they wait until the
   pending one is decided.
