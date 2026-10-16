# Redesign v4 — tracker

**Status (16 October 2026):** Phase 0 started: tracker open, baseline published (84 shots, 14 screens). Lanes A–D not yet started.
Phase 1 waits for D3.

This is the one page that says where the v4 redesign stands. Any session that
continues the work reads it right after CLAUDE.md. Only the session that
coordinates the programme edits it, once at the end of each turn; feature PRs
never touch it, because parallel PRs editing one file conflict on every merge.

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

| Work                         | Can start when                                                                                                             | Status      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Phase 0, lanes A–D           | now                                                                                                                        | in progress |
| Lane E (AI)                  | D12a or D12g approved                                                                                                      | waiting     |
| Phase 1                      | D3 answered                                                                                                                | waiting     |
| Phase 2                      | Phase 1 recorded                                                                                                           | waiting     |
| Phase 3                      | Phase 2 Button/sheet PRs merged (or Behic's OK to stack); D12 for its money items                                          | waiting     |
| Phase 4                      | Phase 2 merged; Phase 3's subscriber status card, or build it here                                                         | waiting     |
| Phase 5                      | Phase 2 merged; lane C merged for reward chips and Echo session-done numbers                                               | waiting     |
| Phase 6                      | Phase 2 and lane C reward ack merged; D12 (incl. h) for anything that gives Pro time or changes the Terms; minors defaults | waiting     |
| Phase 7                      | Phase 2 merged; D11 for the campaign; D12 for Copilot or Pro Week claims; D12h for store-listing claims                    | waiting     |
| Phase 8                      | D6c and minors defaults for any new push category; Phase 2 merged for its screens                                          | waiting     |
| Phase 9 (native batch ships) | D2                                                                                                                         | waiting     |

## Phase 0 and the lanes

| Item                                      | PR    | State       |
| ----------------------------------------- | ----- | ----------- |
| Tracker (this page)                       | #1783 | draft       |
| 0.1 Baseline screenshots, "before" set    | —     | published   |
| 0.2 Instrumentation                       | —     | not started |
| Lane A — skeletons on Me and the Echo tab | —     | not started |
| Lane B — D0 price hierarchy               | —     | not started |
| Lane C — return the send award in the ack | —     | not started |
| Lane D — `.value` to `.get()/.set()`      | —     | not started |

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
- **D:** React Compiler healthcheck; the native-batch candidate list below.
- **After Phase 0:** H6 measurement in the operator panel is the first PR of
  the next turn.

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

| Date        | Item           | Answer                                         |
| ----------- | -------------- | ---------------------------------------------- |
| 16 Oct 2026 | Programme plan | Approved                                       |
| 16 Oct 2026 | Merges         | Every programme PR stays a draft; Behic merges |

## Open questions

- **D1** — Are both stores' products live with the 7-day trial, does
  RevenueCat return offerings on both, and has one real purchase and restore
  been done per platform? Funnel figures in chat only.
- **D2** — Is iOS 2.9 approved and live, has Play accepted its 2.9 bundle, which
  binary does each production track run, and when is the next store build?
- **D3** — Design language: may the palette leave the website's, do `primary`
  and yellow-once-per-screen stay as brand anchors, which other v3 traits may go?
- **D12** — The money and promise package (Copilot as Pro's headline, Pro Week,
  give a week / get a week, Founding Member, one exit offer, the newcomer hello,
  the AI practice partner, the rest case by case).

## Tools

Enabled on Behic's account and confirmed on 16 Oct 2026: Expo skills,
frontend-design, mobile-app-design and design. The Expo and UXKIN MCP servers
need sign-in and are not used; the skills work without them.

## Native-batch candidates

Each gets a fingerprint verdict before it is proposed for Phase 9.

| Candidate                          | Fingerprint verdict |
| ---------------------------------- | ------------------- |
| React Compiler flag                | —                   |
| Native tabs                        | —                   |
| `expo-symbols`                     | —                   |
| `expo-glass-effect`                | —                   |
| A celebration library              | —                   |
| `react-native-keyboard-controller` | —                   |
| Quick actions                      | —                   |
| Reanimated bump or SDK 58 upgrade  | —                   |
