# Redesign v3 — tracker

**Status (20 October 2026):** Every route has its v3 screen merged behind `v3Home`, and Behic is testing internal TestFlight builds of 3.0 with the flag forced on. What is left is the old look in shared components (the audit's nine batches), the new art (badges, sticker packs, app icons, default avatars), Copilot v1, the operator panel and the website — see _Round 4_ — and then the 3.0 release round. The money and promise items stay behind flags that start off. Everything ships together as app 3.0; until then nobody sees a half-done screen.

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

| Work                         | Can start when                                                                                                             | Status                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Phase 0, lanes A–D           | now                                                                                                                        | in progress                               |
| Lane E (AI)                  | D12a or D12g approved                                                                                                      | plumbing merged dark (#1802)              |
| Phase 1                      | D3 answered                                                                                                                | direction chosen                          |
| Phase 2                      | Phase 1 recorded                                                                                                           | kit merged                                |
| Phase 3                      | Phase 2 Button/sheet PRs merged (or Behic's OK to stack); D12 for its money items                                          | paywall and in-app roads merged           |
| Phase 4                      | Phase 2 merged; Phase 3's subscriber status card, or build it here                                                         | Home merged behind `v3Home`; Me in review |
| Phase 5                      | Phase 2 merged; lane C merged for reward chips and Echo session-done numbers                                               | in progress behind `v3Home`               |
| Phase 6                      | Phase 2 and lane C reward ack merged; D12 (incl. h) for anything that gives Pro time or changes the Terms; minors defaults | waiting                                   |
| Phase 7                      | Phase 2 merged; D11 for the campaign; D12 for Copilot or Pro Week claims; D12h for store-listing claims                    | waiting                                   |
| Phase 8                      | D6c and minors defaults for any new push category; Phase 2 merged for its screens                                          | waiting                                   |
| Phase 9 (native batch ships) | D2                                                                                                                         | waiting                                   |

## Phase 0 and the lanes

| Item                                       | PR    | State                                                  |
| ------------------------------------------ | ----- | ------------------------------------------------------ |
| Tracker (this page)                        | #1783 | merged                                                 |
| 0.1 Baseline screenshots, "before" set     | —     | published                                              |
| 0.2 Instrumentation                        | #1785 | merged                                                 |
| Lane A — skeletons on Me and the Echo tab  | #1786 | merged                                                 |
| Lane B — D0 price hierarchy                | #1788 | merged                                                 |
| Lane B — honesty fixes in copy             | #1789 | merged                                                 |
| H6 — measurement in the operator panel     | #1790 | merged                                                 |
| Lane C — return the send award in the ack  | #1784 | merged                                                 |
| Lane D — `.value` to `.get()/.set()`       | #1787 | merged                                                 |
| Phase 2 — v3 foundations                   | #1792 | kit merged                                             |
| Phase 2 — Pro translations unlimited       | #1793 | kit merged                                             |
| Phase 2 — Button v2 with IconButton        | #1794 | kit merged                                             |
| Phase 2 — gamification primitives          | #1795 | kit merged                                             |
| Lane C — streak push truth and repair push | #1796 | merged; the repair push sits behind `streakRepairPush` |

Merge order that applied: #1784 before any client PR that reads the award;
#1785 before #1788. The App Review question in rule 26 was answered on 17 Oct
(see Behic's answers).

**Found in review, not fixed (each a follow-up):**

- The send award leaves out a referral welcome credited in the same send
  (#1784; under-reports only).
- A frozen account still earns the Echo session payout: `settleSessions` in
  `modules/echo/reviews.ts` pays it through `awardTokens`, and neither checks
  `tokenFrozenAt` (predates #1784; the streak milestone payout stopped in
  #1859).
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
- #1794: the CTA label size beside the terms line is Behic's call under rule 15;
  the remaining corner icons still to move to IconButton (list in #1794's body).
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

## Round 2 (18–19 October)

Behic's overnight authority on 18 October covered building, reviewing and
merging reviewed, CI-green PRs, with every money or promise change behind a
flag that starts off. Each flag below is off in production; Behic switches
them.

| Item                                                  | PR           | State                                                            |
| ----------------------------------------------------- | ------------ | ---------------------------------------------------------------- |
| S2 reply-first ranking and S4 corrections into Echo   | #1798        | merged; `discoveryReplyFirst`, `echoFromCorrections`             |
| Phase 4 — Home tab, tabs Home · Chats · Echo · People | #1799        | Home merged behind `v3Home`; Me in review                        |
| Phase 3 — paywall v3, a reason per road               | #1800        | paywall and in-app roads merged                                  |
| Phase 2 — switch, segmented control, progress, toast  | #1801        | kit merged                                                       |
| M1 — Copilot plumbing, consent and allowance (dark)   | #1802        | merged; `copilotService`, no provider key                        |
| Copilot v1 (PR-A) — server, allow-list, admin (dark)  | —            | in review; `copilotAccess` per account, consent v2               |
| D7 — trial-ending reminder                            | #1804        | merged; `trialEndingReminder`                                    |
| Lane C — no silent drops in the nudge engine          | #1805        | merged; `nudgeNoSilentDrops`                                     |
| M4 — give a week, get a week                          | #1806        | merged; `giveAWeek`; companions langx/website#268, langx/docs#50 |
| Lane B — in-app roads to Pro                          | #1807        | merged, live                                                     |
| M3 — the newcomer hello                               | #1808        | merged; `newcomerHello`                                          |
| M2 — Pro Week, server and app                         | #1810, #1811 | in review; `proWeek`                                             |
| Phase 4 — Me tab                                      | #1812        | Home merged behind `v3Home`; Me in review                        |
| Phase 5 — Chats list                                  | #1813        | in progress behind `v3Home`                                      |
| Phase 5 — thread (slice 1), People and Posts, Echo    | —            | in progress behind `v3Home`                                      |

The values these flags carry (allowances, caps, windows) wait for Behic's
confirmation in each PR body before the flag goes on.

## Round 3 (19–20 October)

Behic allowed the night to run the plan's usage to the limit. Every screen PR
below is behind `v3Home`; the fixes marked live change behaviour on merge.

| Item                                                        | PR                                    | State                                                    |
| ----------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| Echo — sessions and payouts on the UTC day, 10-min clamp    | #1821                                 | merged, live                                             |
| Settings — landing and seven categories                     | #1822                                 | merged                                                   |
| Settings — the thirteen standalone screens                  | #1827, #1830                          | merged                                                   |
| Thread — bubbles and corrections (slice 2)                  | #1823                                 | merged                                                   |
| Thread — reward chips from the send's award (slice 3)       | #1828                                 | merged                                                   |
| Thread — the streak milestone celebration (slice 4)         | #1833                                 | merged                                                   |
| Thread — call menu and call rows (slice 5)                  | #1835                                 | merged                                                   |
| Polish — hue buttons, freezes past the cap, UTC dates       | #1824                                 | merged                                                   |
| Streak history — the activity map                           | #1829                                 | merged                                                   |
| Day repair — not before the account; cap by the day's month | #1834                                 | merged, live                                             |
| Store — unknown-tone fallback                               | #1826                                 | merged                                                   |
| Store — sixteen art frames and the widened ladder           | #1831                                 | merged, live (catalogue and ladder)                      |
| Store — frames in chats, the thread and People              | #1836                                 | merging                                                  |
| Store — home, frames collection, frame sheet                | #1837                                 | merged                                                   |
| Store — title badges                                        | #1839                                 | in review                                                |
| Store — Paper Talk and the pack page                        | #1838                                 | reviewed; waits for Behic (lettering)                    |
| Lane B2 — promotional links open the paywall                | #1832                                 | reviewed; waits for Behic (rule 26); `promoPaywallLinks` |
| Frame copy on the docs and the token site                   | langx/docs#52, langx/token-website#31 | merged                                                   |
| Flaky notification-count test                               | #1840                                 | in review                                                |

Open for Behic from this round:

- **#1838 lettering.** Seven of Paper Talk's eleven lettered stickers are in
  English; the rule in `docs/data-sources.md` says stickers carry no words.
  Accept an English-leaning pack, or redraw with words that cross languages.
- **#1832 before its flag goes on.** Whether a build is in App Review (rule 26),
  and narrowing the limits nudge, which also fires after refusals Pro does not
  lift (media, the translation fair-use ceiling).
- **Streak milestones on frozen accounts.** The server pays the milestone to an
  account whose tokens are frozen; the #1833 review found it predates the PR.
- **The widened ladder rule** shipped in #1831 under "sixteen frames, place them
  where you like"; it only helps holders with gaps (older welcome packs).
- Smaller calls: Aurora's "Tokens can't open this one" line (#1837); the v3
  Feedback field drops its character counter (#1827); Turkish frame names Kalem
  and Meander (#1831).

## Round 4 (20 October)

Behic tested 3.0 on TestFlight during the day and sent what still looked old;
the fixes below came from that. The TestFlight builds come from a release
branch that forces `v3Home` on at its one read point and is never merged;
production keeps the flag off. A TestFlight build has its own runtime, so it
never takes main's OTA updates — each round of fixes needs a new build.

Decided on 20 October:

- **Paper Talk is accepted as a lettered pack** (#1838, merged). English is
  fine as the universal language for a sticker's words; whether a new pack
  carries words is decided pack by pack.
- **Promotional links to the paywall merged with the flag off** (#1832).
  `promoPaywallLinks` goes on only after the limits nudge is narrowed so it no
  longer fires after refusals Pro does not lift.
- **No streak milestone payouts to an account whose tokens are frozen**
  (#1859, merged, live).
- **The widened ladder rule is approved** as shipped in #1831: owning any frame
  above a rung opens the rung below.
- **Copilot uses the Claude API only.** No adapter that runs on a personal
  subscription; the server uses the existing provider, with its key and model
  set where the API runs.
- **A one-week free trial on monthly and yearly**, with 3.0. Behic configures
  the offers in the store consoles; the app reads the trial from the store
  rather than assuming it, so a plan without one shows none.
- **New iOS and Android store screenshots in the v3 look gate the 3.0
  submission.** They are shot from the finished screens after TestFlight;
  Behic uploads them.
- **langx.io is redesigned in the v3 look** and ships with 3.0.

| Item                                                                        | PR                                                       | State                                       |
| --------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| Corner and header icons to IconButton                                       | #1842                                                    | merged                                      |
| Remaining screens: chat, posts and People, Echo, Me, auth and root          | #1843–#1853                                              | merged; every route has a v3 screen         |
| Profile — the full board layout                                             | #1854                                                    | merged                                      |
| Main's typecheck, after two PRs added the same style                        | #1856                                                    | merged                                      |
| TestFlight round 1 — big numbers, Boosted strip, Echo tab, thread header    | #1855                                                    | merged                                      |
| TestFlight — count badge digits centred                                     | #1857                                                    | merged                                      |
| TestFlight — buttons that took the whole row                                | #1858                                                    | merged                                      |
| TestFlight — Export my data on every platform; tips in the v3 look          | #1860                                                    | merged                                      |
| TestFlight — new chat in the thread's look                                  | #1861                                                    | merged                                      |
| TestFlight — a like on every post card                                      | #1862                                                    | merged                                      |
| TestFlight — someone else's profile and Preview my profile                  | #1864                                                    | merged                                      |
| Review follow-ups — view-once replay, media tiles, snap radios, token board | #1866                                                    | merged                                      |
| A test timeout that a full suite outgrew                                    | #1865                                                    | merged                                      |
| Paper Talk on the docs, the token site and langx.io                         | langx/docs#53, langx/token-website#32, langx/website#271 | merged                                      |
| Chat camera — viewfinder, shutter, mode switch, still the old look          | —                                                        | in progress                                 |
| Call screens                                                                | —                                                        | board drawn; building                       |
| Old-look audit — shared components in nine batches                          | —                                                        | in progress; calls in their own row         |
| Follow-ups 2 — new-chat quota card, today ring, limits nudge                | —                                                        | in progress                                 |
| Monthly trial in the app                                                    | —                                                        | in progress                                 |
| Badges v3                                                                   | —                                                        | designed; building                          |
| Sticker packs v3                                                            | —                                                        | designed; building                          |
| App icons v3                                                                | —                                                        | designed; building; ships in the 3.0 binary |
| Default avatars v3                                                          | —                                                        | designed; building                          |
| Copilot v1 — server, providers, operator allow-list (dark)                  | #1863                                                    | open; the app PR in progress                |
| Operator panel v3                                                           | —                                                        | started                                     |
| langx.io v3                                                                 | —                                                        | design in progress                          |
| Store items as gifts                                                        | —                                                        | researched; not started                     |

**The old-look audit.** Every route reads `useV3Home`, but a screen counts as
v3 only when it matches its board; Profile showed the difference (it read the
flag and kept its old layout until #1854). What still looks old is in shared
components, split into nine batches: the Echo session, form primitives, the
edit-profile parts, language pickers, People search and filters, thread
overlays, shared sheets, the shell hosts, and pages with media. Each batch is
built and reviewed on its own. Calls (the call host and its bar) are a tenth
batch; their board is drawn and they are being built.

**Badges.** Embroidered patches won, with grafts from enamel pins and passport
stamps. The 25 existing badges keep their rules and get new art; six new kinds
join (languages, calls, Echo, kind words from testimonials, people you helped,
and one more), none of which pays tokens. Boards: the collection, a badge's
detail, the earned moment and the art sheet.

**Sticker packs.** Nine packs drawn in the crafted world: Starter, Practice and
Pixel redrawn from scratch, and six new — Margin Notes (proofreading marks),
Qalam, Polyglot, Study Desk, Night Owl and Shared Table. Starter and Practice
stay at 1,000 tokens; the new packs cost 1,500. Pixel's coin becomes a 1-UP
heart, its id kept. The store's "Up next" row shows at most three packs. Each
pack ships as bundled SVG with names in all eight locales, a few packs per PR,
then the sibling copies.

**App icons.** Crafted objects again, so the icons match the frames: eight free
(the default, Night, Split, Contrast, Paper Cut, Felt Stitch, Woven Reed,
Linocut) and nine Pro (Iznik Tile, Lacquer Gold, Stained Glass, Night Hoop,
Indigo Dye, Marquetry, Mosaic, Origami Fold, Enamel Pin). The old Pro and New
Year icons leave the picker; their native entries stay for one release. When
Pro lapses, the icon stays and shows as locked in the picker (decided by
Behic, 21 Oct). Alternate icons are native assets, so they move
the fingerprint and ship only in the 3.0 binary, never by OTA.

**Default avatars.** 144 crafted portraits — 48 in each of three pools, women,
men and neutral — on six grounds, drawn by the API as images so no binary
carries them. An account stores which face it has; one with none gets a face
from a hash of its id, so nothing is backfilled. The pool follows the gender
the account gives, and undisclosed or other gets the neutral pool, so a face
never says more about a person than they have shared.

**Store items as gifts.** The research says yes, on conditions: sticker packs
first and nothing else; only between real partners; a weekly send cap and a
monthly receive cap; behind a flag that starts off. A gift is a new purchase
for the recipient, not a transfer, and follows the recipient's ladder; gated
frames, Aurora Glass and freezes are never giftable. The Terms (section 7) and
`docs/decisions.md` change first, and a two-account gap in corrections closes
before it. Behic has the open questions; nothing is built.

**Copilot v1.** A simple first version that the operator turns on for chosen
accounts from the panel, so a few people test it before anyone else sees it.
The server PR is open; the app PR follows it.

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
  `copilot` "Coming soon" line is left alone until D12a is answered. (Settled
  21 Oct 2026: it reads "Beta, rolling out" — `decisions.md` → _Copilot is
  sold as a beta, rolling out_.)
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
| 17 Oct 2026 | Rule 26 for #1788    | No build is in App Review; #1788 merges with commit 2 (the free week in the subline)                                                                                                                                                                                                                   |
| 17 Oct 2026 | Merges               | Behic asked the coordinator to merge in order; the auto-mode classifier allowed #1784 only, so the rest are his clicks                                                                                                                                                                                 |
| 17 Oct 2026 | Fair use             | Pro translations stay "unlimited" in all copy, with a fair-use guard of 1,000 per 24 hours, disclosed in Terms §5 (merged with langx/website#267)                                                                                                                                                      |
| 17 Oct 2026 | Merges               | The coordinator merges reviewed, CI-green PRs in order (Behic added the permission)                                                                                                                                                                                                                    |
| 18 Oct 2026 | Overnight authority  | Build, review and merge reviewed, CI-green PRs; D12's yes-items (a, b, c, f) only behind flags that start off; never production keys, flag switches, store consoles, campaigns or production scripts                                                                                                   |
| 18 Oct 2026 | Merges               | Merge each PR as soon as its review fixes are in and CI is green                                                                                                                                                                                                                                       |
| 18 Oct 2026 | Scope of 3.0         | Every screen moves to the v3 look; the flagged features join; all of it ships together as mobile 3.0                                                                                                                                                                                                   |
| 19 Oct 2026 | Visuals              | After the code work: the branding repository's visuals and the App Store and Play screenshots are redone in the v3 look, from the finished screens                                                                                                                                                     |
| 19 Oct 2026 | Token store          | The store, sticker packs, profile frames and titles look too plain: redesign them as a real store, with frames that are artistic and original, not only a colour                                                                                                                                       |
| 19 Oct 2026 | Store details        | Sixteen frames, the new ones placed between the rungs; Paper Talk at 1,500; frames take their art names                                                                                                                                                                                                |
| 20 Oct 2026 | Round 3's open calls | Paper Talk accepted as a lettered pack; #1832 merges with its flag off until the limits nudge is narrowed; no streak milestones to frozen accounts; the widened ladder rule approved                                                                                                                   |
| 20 Oct 2026 | Copilot              | The Claude API only; no adapter on a personal subscription                                                                                                                                                                                                                                             |
| 20 Oct 2026 | Free trial           | A one-week free trial on monthly and yearly with 3.0; Behic sets the store offers, the app reads the trial from the store                                                                                                                                                                              |
| 20 Oct 2026 | 3.0 gates            | New iOS and Android store screenshots in the v3 look before the 3.0 submission; langx.io in the v3 look ships with 3.0                                                                                                                                                                                 |
| 20 Oct 2026 | New work             | Badges, sticker packs (three redrawn, six new), app icons (free and Pro) and default avatars in the v3 look; the operator panel last                                                                                                                                                                   |
| 21 Oct 2026 | v3 open items        | A Pro icon stays when Pro ends; "Qalam stickers" and "Polyglot stickers" keep their names; Echo's switch reads "Autoplay" with the state in its icon (the full label for screen readers); dark level bars clear 3:1; Polyglot lettering checked per language                                           |

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

## Token store v3 (designed 19 October)

Behic asked for the store, the sticker packs, the profile frames and the titles
to read as a real store, with frames that are art rather than a coloured ring.
Three art directions were drawn and judged on the design canvas (page
"Mağaza — sanat yönleri"): scripts and ink, living places, and crafted
objects. Crafted objects won, with grafts from the other two. The final boards
are on the page "Mağaza v3": the store home, the frames collection, a
Legendary frame's detail sheet, titles, a sticker pack, and the master frame
sheet at 96, 40 and 28 px in both schemes.

**Why crafted objects.** The ladder rises by material — paper, felt, reed,
glaze, lacquer, glass — not by country, so no culture is ranked cheaper than
another. Its small cuts still read at 28 px. Places as a ladder put cities on a
price scale and used sacred sites as decoration, and was dropped.

**The frames.** Today a frame is a solid ring whose colour comes from its
`tone`. Every existing id keeps its tone as its main colour, so an older client
still draws a sensible ring.

| Rarity    | Frames (tokens)                                                                         |
| --------- | --------------------------------------------------------------------------------------- |
| Common    | Papel Picado 1,000 · Running Stitch 2,500 · Woven Reed 4,000                            |
| Rare      | Origami Fold 6,000 · Enamel Pin 9,000 · Iznik Tile 13,000                               |
| Epic      | Khokhloma 18,000 · Qalam 25,000 · Night Hoop 35,000                                     |
| Legendary | Aurora Glass 50,000, gated as today, with a ring of "hello" in nine languages at 64 px+ |

The master sheet also draws six new frames between those rungs: Washi Tape
1,750, Linocut 3,250, Indigo Dye 7,500, Mosaic 11,000, Seal and Fret 21,500
and Marquetry 30,000 — sixteen in all.

Rules the boards follow: outline 2 px and detail 1–1.5 px at 96 px; at 40 px at
most six shapes and no text; at 28 px a silhouette and one accent; no white
grounds in dark mode; 3:1 against the surface. Aurora Glass is the only frame
that moves — a six-second light sweep at most every 20 seconds, on your own
profile and in the store preview only, still under reduce motion.

**Titles** become styled badges with a motif in each end cap, shown under the
name on the profile and, in a compact cut, in the chat header. **Sticker
packs** get a cover and a pack page; the boards draw a new pack, Paper Talk
(greetings paired with everyday objects), and a proofreading-marks pack that
fits corrections. Every price is in tokens with one token glyph, never a
currency.

**How it ships.** All of it is JavaScript and bundled assets, so it ships by
OTA: frames as `react-native-svg` components (already in the binary), the
sweep in Reanimated, stickers as bundled SVG like today. No new native module.

Implementation, in order, each behind `v3Home`:

1. An unknown-tone fallback in `Avatar` (a plain ink ring), shipped first, so
   no client ever draws a ring with no colour.
2. `FrameArt` components for all sixteen frames (the six new ids and the
   ladder rule above land in the same PR), drawn at the three cuts,
   with a test that every frame id in `COSMETICS` has art. `Avatar` draws the
   art where the flag is on and the ring where it is off.
3. Frames where other people look: chat thread header, conversation list and
   Discover cards (today they show only on Me, profile and the leaderboard).
4. The store home and the frames collection, replacing the v3 store's grey
   groups; the frame detail sheet with the one yellow Buy.
5. Title badges on the profile and the chat header.
6. The sticker pack page, and new packs as their own PRs (assets, licence
   notes, `stickerAssets.test.ts`).

Behic's answers (19 October):

- **Sixteen frames.** The six new frames go where the master sheet draws them,
  between today's rungs (few accounts are far up the ladder yet). Two rules
  keep that fair: owning any frame above a new rung counts as owning the rung
  below it, so nobody who owns Woven Reed is locked out of Linocut; and the Pro welcome pack already names its four frames by id (Slate, Bronze, Sky, Silver), so inserting rungs does not change what it grants.
  New ids get new tones, and the unknown-tone fallback ships by OTA before the
  API sends any of them.
- **Paper Talk costs 1,500.** Its price is set per pack, as pixel's already is.
- **Frames take their art names** (Papel Picado, Running Stitch…) in all eight
  locales. The ids stay.

## Decided, not yet built

Nothing waits at the moment. The one item that sat here, unlimited Pro
translations, shipped in #1793 with its companions, langx/website#267 and
langx/docs#49.

## Before the 3.0 release

The 3.0 release round, in one checklist:

- [ ] **Flags to switch on together**, each with the values its PR asked Behic
      to confirm. All start off in `DEFAULT_APP_CONFIG` in
      `packages/shared/src/appConfig.ts`: `v3Home`, `streakRepairPush`,
      `discoveryReplyFirst`, `echoFromCorrections`, `trialEndingReminder`,
      `nudgeNoSilentDrops`, `giveAWeek`, `proWeek`, `newcomerHello`,
      `promoPaywallLinks` (only after the limits nudge is narrowed) and
      `copilotEnabled` (Copilot v1 opens to the operator's allow-list first).
- [ ] **A one-week free trial on monthly and yearly** in every store console
      (Behic), and the app reading it from the store; then the sibling copies
      on langx.io and the docs.
- [ ] **Yearly prices end in .99** in every storefront (App Store, Play,
      RevenueCat web), now that the yearly total is the headline price.
      Behic operates the store consoles; the repo records follow
      (`planSaving.test.ts`, `docs/release-runbook.md`, `docs/decisions.md`).
- [ ] **Bump the app to 3.0** in the same round. The binary also carries the
      new app icons, which cannot ship by OTA.
- [ ] **New store screenshots** for iOS and Android in the v3 look — a gate
      for the submission.
- [ ] **langx.io v3 merges on release day**, with the app.
- **After the code work, the visuals.** Redo the branding repository's visuals
  in the v3 look, folding in the open drafts langx/branding#24–#27, and shoot
  new App Store and Play screenshots from the finished v3 screens. The images
  are prepared in the repositories; Behic uploads them in the consoles.
- Update the store listing copy (`docs/store/listing.md`, the metadata file)
  where the flagged features change what it says: invites, Pro Week, the
  newcomer hello.
- [ ] **Last gate: every screen against its board, on both platforms**
      (Behic, 20 Oct). Once all the work is merged, an agent opens every
      screen in Release builds on the iOS simulator and the Android emulator
      and compares it with its board; no screen in the old look may remain.
      It is checked by screenshots, not by reading code: the code audit
      counted half-migrated screens, such as the chat camera, as done.

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
