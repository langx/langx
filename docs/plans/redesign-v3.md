# Redesign v3 — tracker

**Status (17 October 2026):** Phase 0 and the first PR of every lane are open as drafts and reviewed. Phase 1: direction chosen (A's structure, B's look); every screen drawn.

This is the one page that says where the v3 redesign stands. Any session that
continues the work reads it right after CLAUDE.md. Only the session that
coordinates the programme edits it, once at the end of each turn; feature PRs
never touch it, because parallel PRs editing one file conflict on every merge.

**Naming.** Behic named this redesign "v3" on 16 October 2026. Its brief calls it
"v4", and the brief and `docs/decisions.md` use "the v3 look" for the look the
app has today (the one that matches the website). On this page and in PR text,
"v3" means the redesign; today's look is "the current look".

No metrics live here. Conversion, retention, funnel and revenue figures are
shared in chat and stay there; this page records the conclusions.

## Goals

Behic named one priority, **smooth**; the rest are in the order he wrote them.
The paywall is urgent although it is seventh, because there have been no sales.

| #   | Goal                                    | Done means, in short                                                                                                            |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Smooth above everything                 | Lists ≥55 fps on the lowest-end Android, press feedback within a frame, per-tab TTI never regresses; no wait without a skeleton |
| 2   | Gamification that matters               | Every reward acknowledged when it happens; today's task and the next reward always visible                                      |
| 3   | Pull people back                        | Personal, honest, measured re-engagement; D1/D7/D30 and activation comparable before and after                                  |
| 4   | More time in the app                    | Every ending has a primary next action                                                                                          |
| 5   | Only chic, modern, big buttons          | One button system; primary ≥56pt, sentence case, icon + label; no target under 44pt / 48dp                                      |
| 6   | Anyone can use it                       | No gesture-only actions, plain language, 200% text, RTL, eight locales; five non-technical people finish four tasks             |
| 7   | A marketing-led paywall, and more roads | Most new accounts see the paywall within 7 days; every road tagged; store-compliant                                             |
| 8   | LangX markets itself                    | What's different, what's new, Pro for free and invites visible where they matter; celebrations share with the invite QR         |
| 9   | Tips are simple and not enough          | Fewer, contextual tips, each with a button that does the thing; measured                                                        |
| 10  | The Me tab does not appeal to the eye   | A focal point, never a page of zeros; the daily dashboard within a fold budget                                                  |
| 11  | Modern design tools and skills          | Plugins enabled or their absence recorded; each phase names the skills it used                                                  |

## Gates

| Work                         | Can start when                                                                                                             | Status           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Phase 0, lanes A–D           | now                                                                                                                        | in progress      |
| Lane E (AI)                  | D12a or D12g approved                                                                                                      | waiting          |
| Phase 1                      | D3 answered                                                                                                                | direction chosen |
| Phase 2                      | Phase 1 recorded                                                                                                           | waiting          |
| Phase 3                      | Phase 2 Button/sheet PRs merged (or Behic's OK to stack); D12 for its money items                                          | waiting          |
| Phase 4                      | Phase 2 merged; Phase 3's subscriber status card, or build it here                                                         | waiting          |
| Phase 5                      | Phase 2 merged; lane C merged for reward chips and Echo session-done numbers                                               | waiting          |
| Phase 6                      | Phase 2 and lane C reward ack merged; D12 (incl. h) for anything that gives Pro time or changes the Terms; minors defaults | waiting          |
| Phase 7                      | Phase 2 merged; D11 for the campaign; D12 for Copilot or Pro Week claims; D12h for store-listing claims                    | waiting          |
| Phase 8                      | D6c and minors defaults for any new push category; Phase 2 merged for its screens                                          | waiting          |
| Phase 9 (native batch ships) | D2                                                                                                                         | waiting          |

## Phase 0 and the lanes

| Item                                      | PR    | State                            |
| ----------------------------------------- | ----- | -------------------------------- |
| Tracker (this page)                       | #1783 | draft                            |
| 0.1 Baseline screenshots, "before" set    | —     | published                        |
| 0.2 Instrumentation                       | #1785 | draft, reviewed                  |
| Lane A — skeletons on Me and the Echo tab | #1786 | draft, reviewed                  |
| Lane B — D0 price hierarchy               | #1788 | draft, stacks on #1785, reviewed |
| Lane B — honesty fixes in copy            | #1789 | draft, reviewed                  |
| H6 — measurement in the operator panel    | #1790 | draft, reviewed                  |
| Lane C — return the send award in the ack | #1784 | draft, reviewed                  |
| Lane D — `.value` to `.get()/.set()`      | #1787 | draft, reviewed                  |

Merge order: #1784 before any client PR that reads the award; #1785 before
#1788. #1788 waits for the App Review question in rule 26.

**Found in review, not fixed (each a follow-up):**

- The send award leaves out a referral welcome credited in the same send
  (#1784; under-reports only).
- A frozen account still earns the Echo session and streak milestone payouts
  (predates #1784).
- Web browser back records a paywall view with no dismissal; a Pro account that
  loads after the paywall opens looks free; leaving right after a gift code or
  restore can count as a dismissal (#1785).
- Echo offline with no cache keeps the skeleton pulsing; the Packs row says
  "No packs yet" while packs load; accounts with no badges shift once when the
  shelf arrives (#1786).
- #1790: an explain test for the `readThreads` shapes, a comment that says
  "earliest" where it means "most recent", and the header accessibility flag.
- #1789: the `limitReached` email and push still fire after refusals of quotas
  Pro does not lift.
- React Compiler: refs read or written during render, unsupported syntax and
  use-before-declare still block it in several files; the stock healthcheck
  reports success falsely (#1787).

**Next, after each lane's first PR:**

- **A:** toast exit; Toggle knob and ProgressBar on Reanimated; SegmentedControl
  thumb on RN `Animated`; memoised rows and stable keys; expo-image caching;
  offers prefetched in memory and the paywall as a full-screen modal; an eased
  press on Button; a FlashList v2 evaluation behind a fingerprint compare.
- **B:** honesty bugs (`chat.translationQuota`, the `limitReached` email,
  streak wording, `streak.protectBody`, `restorePurchases()` outcomes);
  promotional links to the paywall with their own sources; own sources for the
  Settings row and the app-icon picker; the `first_reply` road; a tappable PRO
  badge; the Me Pro card's button (stacked on lane A's Me PR); the D7 server PR.
- **C:** the 20:00 streak push rewritten to the real rule; a streak-repair push
  kind; no silent drops in the nudge engine; S2 ranking and S4 automatic
  capture, both behind flags that stay off.
- **D:** a fingerprint compare for native tabs, `expo-symbols` and
  `expo-glass-effect`; then the remaining compiler blockers, file by file.
- **After Phase 0:** H6 measurement in the operator panel is the first PR of
  the next turn.

## Phase 1 — the concepts and the chosen direction

Three product concepts were drawn on 16 October 2026 (A "Today": a Home tab with
one next step; B "Partners": the app organised around exchange partners with pair
streaks; C "Talk": three tabs and one Talk-now button). Behic chose **A's structure
with B's look**, plus two ideas from C:

- Tabs: Home · Chats · Echo · People · Me. Every launch lands on Home with one
  next step and Today's three rings; Discover and Feed merge into People
  (People | Posts).
- Look: flat colour blocks, a colour per partner, big Nunito type, flat pill
  buttons, no shadows; `primary` blue and yellow-once-per-screen kept.
- Rewards: pair streaks per partner ("9 days together", +15 for both on a
  two-way day).
- From C: a received correction is saved to Echo automatically (with Undo); Home
  shows a "Talk now" card when someone who fits is online.
- The yearly plan shows the billed amount biggest, with the per-month figure as
  a coloured badge under it.

The whole app (108 screens, every route but the operator panel) is drawn in this
direction on a private design canvas shared with Behic. Next: the five-person
usability test (goal 6) and the dated decision entries in `docs/decisions.md`
for every product rule this direction reverses, landing with the first Phase 2
PR.

## Decisions taken by the executor

- **D0 — paywall price hierarchy (16 Oct 2026).** The amount that will be
  billed, with its period, becomes the most prominent price on the paywall;
  per-month figures and "N months free" become a subordinate line or badge.
  The draft PR builds the version with the free week in the subline and keeps
  the trial-led headline as an alternative for Behic to pick at merge. The
  `copilot` "Coming soon" line is left alone until D12a is answered.
- **D7 — trial-ending reminder (16 Oct 2026).** It joins the Billing class: no
  switch, information only (charge date, the store's billed amount, how to
  cancel), linking to `/settings/plan`. `promo.trialEnding` stops targeting
  trialists. The timeline's "We'll remind you" step shows only to someone with a
  working channel, and lands with Phase 3.

## Behic's answers

| Date        | Item                 | Answer                                                                                                                                                                                                                                                                                                 |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 16 Oct 2026 | Programme plan       | Approved                                                                                                                                                                                                                                                                                               |
| 16 Oct 2026 | Merges               | Every programme PR stays a draft; Behic merges                                                                                                                                                                                                                                                         |
| 16 Oct 2026 | D3 — design language | (a) the app's palette may leave the website's; (b) `primary` and its text stay identical in both schemes; (c) yellow stays once per screen; (d) flat, hairlines, no cards and one blue may all go                                                                                                      |
| 16 Oct 2026 | Name and version     | The redesign is called v3, and it ships as app version 3.0 once everything is ready (the version bump waits for that release round)                                                                                                                                                                    |
| 16 Oct 2026 | Yearly plan display  | The billed yearly amount stays the biggest price; the per-month figure becomes a coloured badge under it ("$6.99 a month · 3 months free"). Because the yearly total is now the headline number, every yearly price is rounded to end in .99 in every storefront — done last, in the 3.0 release round |
| 16 Oct 2026 | Pro translations     | Unlimited on Pro, everywhere; the free plan keeps its daily allowance                                                                                                                                                                                                                                  |

## Open questions

- **D1** — Are both stores' products live with the 7-day trial, does
  RevenueCat return offerings on both, and has one real purchase and restore
  been done per platform? Funnel figures in chat only.
- **D2** — Is iOS 2.9 approved and live, has Play accepted its 2.9 bundle, which
  binary does each production track run, and when is the next store build?
- **D12** — The money and promise package (Copilot as Pro's headline, Pro Week,
  give a week / get a week, Founding Member, one exit offer, the newcomer hello,
  the AI practice partner, the rest case by case).

## Tools

Enabled on Behic's account and confirmed on 16 Oct 2026: Expo skills,
frontend-design, mobile-app-design and design. The Expo and UXKIN MCP servers
need sign-in and are not used; the skills work without them.

## Decided, not yet built

- **Pro translations become unlimited (Behic, 16 Oct 2026).** The free plan
  keeps its daily allowance. Code: `PLAN_LIMITS` in `packages/shared`, the
  server quota, the in-app copy (including `chat.translationQuota` from
  #1789), and every copy listed in `docs/repo-map.md` (website plans data and
  Terms §5, the GitBook pages, `docs/store/listing.md`, the store metadata).
  The provider bills per character, so the PR states the fair-use guard it
  keeps against automated abuse and how the Terms already cover it.

## Before the 3.0 release

- Round every yearly price to end in .99 in every storefront (App Store,
  Play, RevenueCat web), now that the yearly total is the headline price.
  Behic operates the store consoles; the repo records follow
  (`planSaving.test.ts`, `docs/release-runbook.md`, `docs/decisions.md`).
- Bump the app to 3.0 in the same round.

## Native-batch candidates

Each gets a fingerprint verdict before it is proposed for Phase 9. Verdicts
below come from the docs and the dependency tree; each is confirmed with a
fingerprint compare before anything is built on it.

| Candidate                          | Fingerprint verdict                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| React Compiler flag                | Moves it: `experiments` in `app.config.ts` is hashed                                                   |
| Native tabs                        | Expected unchanged: built on react-native-screens, already in the binary — confirm                     |
| `expo-symbols`                     | Possibly unchanged: expo-router 57 already depends on it, so it may already be linked on iOS — confirm |
| `expo-glass-effect`                | Possibly unchanged: same reason as `expo-symbols` — confirm                                            |
| A celebration library              | Moves it: a new native module (Lottie or Rive)                                                         |
| `react-native-keyboard-controller` | Moves it: a new native module                                                                          |
| Quick actions                      | Moves it: a native module and config                                                                   |
| Reanimated bump or SDK 58 upgrade  | Moves it: a native version bump                                                                        |
