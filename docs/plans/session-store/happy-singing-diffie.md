# LangX Mobile v2 — redesign from the Claude Design handoff

## Context

Behiç mocked up a ten-screen redesign of the v2 mobile app in Claude Design and
exported a handoff bundle (two uploaded zips, identical content, at
`/root/.claude/uploads/de4bddce-b671-593b-899f-3f8a26fbd950/`). The design
rebuilds the app on the **website's brand palette** — yellow `primary`, blue
`accent`, violet `pro`, amber `streak`, and the four callout pairs — with
Comfortaa titles, 16px cards and pill controls, in a light and a dark variant.

Today the app looks nothing like this: `apps/mobile/src/lib/theme.ts` is a flat,
light-only token set with a near-monochrome palette (`primary` is `#111113`),
there is no dark mode at all, no custom font, and two primitives bypass the
tokens entirely. So this is not a reskin of a themed app — it is adding the
theming layer and then reskinning.

Two of the ten screens describe product that does not exist: the community
**Feed** has no route, no API and no collections, and **badges** have no data
model anywhere in `packages/shared`. Behiç asked for all ten screens, built
full-stack, with live theme switching.

### What the bundle actually is

- `LangX Mobile v2.dc.html` (light) and `LangX Mobile v2 Dark.dc.html` (dark) are
  **line-for-line identical, 699 lines each**, same screen markers at the same
  line numbers. Only inline colour values differ. **Dark is a pure token swap** —
  the two "implement this file" requests are one job, not two.
- Each screen is a 390×844 phone mockup on a canvas. The phone frame, the 36px
  frame radius, the `9:41` status bar and the `sc-if` caption toggles are
  presentation scaffolding — **not** app surface to build.
- `_ds/organic-…/styles.css` is a generic cream/terracotta "Organic" starter
  system with Caprasimo and Figtree. It is `<link>`ed but **nothing in either
  design uses it** — every value is inline-styled with LangX palette hexes.
  Ignore it. The real token source is `project/uploads/langxwebsitepalette.md`
  and `project/dark-theme.md`.
- `project/LangX Mobile.dc.html` is the older pre-palette draft. Ignore it.

### Conflicts found between the design and `packages/shared`

`langx/CLAUDE.md` says limits and rules are config and must never be hard-coded,
so **`packages/shared` wins** everywhere these disagree. Screens must render
these from source, not from the mockup's numbers:

| Design says | `packages/shared` says | Action |
| --- | --- | --- |
| Cosmetic frame `350`, "Four available" | `frame.bronze 500`, `silver 1500`, `gold 5000` — three frames | Render `COSMETICS` |
| Title «Corrector» `500` | `title.learner 1000`, `tutor 3000`, `polyglot 10000` — no "Corrector" | Render `COSMETICS` |
| Streak freeze `200` | `sinks.streakFreeze: 200` | ✅ matches |
| `+2 tokens / message` | `award.message: 2` | ✅ matches |
| `Cap 500 a day` (pool) | `pool.total 10_000 × maxShareOfPool 0.05` | ✅ matches |
| `100 days … Pays 1,000 tokens` | `streakMilestones[100]: 1000` | ✅ matches |

Flag the two mismatched rows back to Behiç so the design file can be corrected
too — otherwise the mockup stays a source of wrong prices.

---

## Phase 0 — Theme foundation

The load-bearing phase. Everything else depends on it.

**`apps/mobile/src/lib/theme.ts` → a light/dark pair.** Replace the flat
constants with two palettes transcribed from `dark-theme.md`, keeping the
existing export names where they still fit so the diff stays reviewable. Roles,
straight from the handoff:

- ground `page-background` `#f4f8fb` / `#1c1e26`; feed ground `post-page-background`
  `#f3fbfc` / `#141519`; `surface` `#ffffff` / `#32343e`; `border` `#e3e3e6` / `#43454f`
- `text` `#000` / `#fff`; `textShade` `#5d5f65` / `#9eb4b5`; `textInverseShade` `#9eb4b5` / `#5d5f65`
- `primary` `#ffc409` **in both themes**, `primaryShade` `#e0ac08`, and text on
  yellow stays `#000` in both — deliberate, per `dark-theme.md`
- `secondary` `#ff571a` / `#ff723f`; `accent` `#3b6cf6` / `#7ba0ff`;
  `pro` `#7a5af8` / `#9b83ff`; `streak` `#f79009` / `#ffa93d`
- four callout `background`/`accent` pairs: success (corrections), info
  (Copilot **only**), warning (streak/level), error (empty/unread/destructive)
- radii `sm 8 · md 12 · lg 16 · xl 24 · pill 999`; spacing
  `3xs 4 · 2xs 8 · xs 12 · sm 16 · md 24 · lg 32 · xl 48`
- card shadow `0 4px 10px rgba(0,0,0,.1)` light, same geometry at `rgba(0,0,0,.5)` dark

**Theme context + hook.** New `src/lib/theme/ThemeProvider.tsx` exposing
`useTheme()` (returns the resolved palette) and `useThemedStyles(factory)` — a
`useMemo` over a `StyleSheet.create` factory keyed on the active scheme. Mount it
in `app/_layout.tsx` inside `SafeAreaProvider`, outside `AppGate`. Preference is
`light | dark | auto`, defaulting to `auto` off `useColorScheme()`, persisted
with the existing `src/lib/localFlags.ts` idiom. Drive `<StatusBar>` and the
React Navigation theme from it too.

**Convert the ~46 files that import `lib/theme`.** Mechanical: each
bottom-of-file `const styles = StyleSheet.create({...})` becomes a
`const useStyles = makeStyles((t) => ({...}))` factory called in the component.
Do this per-directory, not in one commit.

**Retokenise the files that bypass tokens** — `src/components/ui/Button.tsx`
(`'#111'`/`'#fff'`), `src/components/ui/FormField.tsx` (incl.
`placeholderTextColor="#999"`), `src/components/PhotoGallery.tsx`, and the six
`app/(auth)/*` screens. 21 hardcoded hexes across 9 files; they would otherwise
stay light in dark mode.

**Comfortaa.** Add `@expo-google-fonts/comfortaa` (400/500/600/700), load with
`useFonts` in `app/_layout.tsx`, gate render on it alongside the existing splash
handling. Add `fontFamily` to the `font` tokens. **Display only** — titles,
buttons, numerals in stat tiles; body text stays the platform stack.

**Icons.** The design specifies Lucide at stroke-width 2.75. `lucide-react-native`
would pull in `react-native-svg`, which is not a dependency. Use **Feather from
the already-installed `@expo/vector-icons`** — Lucide is a fork of Feather, so
the shapes match — and replace the emoji tab icons in `app/(app)/_layout.tsx` and
in `EmptyState`. Keep genuine emoji where the design uses it as content (🔥 streak
chips, 🇹🇷 country).

**Record the decision.** Append a section to `langx/docs/decisions.md` next to
"Client — StyleSheet instead of NativeWind" explaining the theme-factory
approach and why NativeWind stayed rejected.

## Phase 1 — Primitives

Extend `src/components/ui/` to cover what the ten screens repeat. Reuse the
existing `Screen.tsx` shell (safe area, `layout.maxWidth` centring, `fluid`
escape hatch for chat) as-is — only its colours change.

- Update `Button` (pill, 54px tall, Comfortaa 700, yellow fill, `#000` label,
  card shadow), `Chip`, `Avatar`, `EmptyState`, `Skeleton`, `TierBadge`
- New: `Card` (surface, `radius.lg`, 1px border), `Callout` (the four semantic
  pairs), `ListRow` (label + value + `›` chevron, the settings/filters workhorse),
  `Toggle` (**knob stays `#ffffff` in dark**, per `dark-theme.md`),
  `SegmentedControl` (A1–C2, gender), `ProgressBar`, `StatTile`, `RangeSlider`
- `Avatar` fill cycles `accent → pro → secondary → callout-accent--success`,
  derived from the handle. Decorative, no token of its own.

## Phase 2 — Reskin the eight existing screens

Straight visual work against the design, one screen per commit. Read the
matching region of `LangX Mobile v2.dc.html` for each (line numbers below).

| # | Design lines | Route |
| --- | --- | --- |
| 01 Onboarding · languages | 36–99 | `app/(onboarding)/languages.tsx` |
| 02 Discover | 100–177 | `app/(app)/discover.tsx` |
| 03 Filters | 178–254 | `app/(app)/filters.tsx` + `src/lib/discoveryFilters.ts` |
| 04 Chat | 255–319 | `app/(app)/chat/[id].tsx` (665 lines — the biggest) |
| 05 Correction + Copilot sheet | 320–377 | `src/lib/messageActions.ts`, `MessageMenuHost.tsx` |
| 07 Me | 454–533 | `app/(app)/me.tsx` |
| 09 Tokens | 574–620 | `app/(app)/store.tsx` — render `COSMETICS`, not mock prices |
| 10 Settings | 621–685 | `app/(app)/settings.tsx` |

Screen 05 is the only place Copilot may use the **info** callout, and
corrections the only user of **success** — the design is explicit that the two
voices must never be confusable. Screen 07's weekly chart is a plain 7-bar
two-series block; build it with Views, not a chart library.

## Phase 3 — Feed, full-stack

New product surface. Follow the existing module/route/schema split exactly.

- **`packages/shared/src/feed.ts`** — zod schemas for a post (author, language,
  level, body, `createdAt`, correction count) and a post correction (original
  span, replacement, note, author). Export from `index.ts`. Unit tests alongside,
  matching `discovery.test.ts`.
- **`apps/api`** — add `posts` and `postCorrections` to
  `src/db/collections.ts`; indexes in `src/db/indexes.ts`; business logic in
  `src/modules/feed/feed.ts`; routes in `src/routes/feed.ts` behind
  `requireAuth`, registered in `src/app.ts`. Cursor pagination via the existing
  `src/lib/dateIdCursor.ts`. Two filters the design shows: **Needs a correction**
  and **Following**. Route tests mirroring `routes/discovery.test.ts`.
- Correcting a feed post should award through the existing
  `src/modules/tokens/awards.ts` path rather than a parallel one — same
  `correction` kind, same caps.
- **`apps/mobile/app/(app)/feed.tsx`** (design lines 378–453) + a query in
  `src/api/queries.ts`.
- **Tab bar** (`app/(app)/_layout.tsx`): the design shows Discover · Chats ·
  Feed · Me. Move `leaderboard` to `FULL_SCREEN` (reachable from Me → Badges,
  which the design already draws as a row) and add `feed`.

## Phase 4 — Badges, full-stack

- **`packages/shared/src/badges.ts`** — the catalogue as config, derived from
  existing rules rather than duplicating them: streak badges keyed off
  `TOKEN_RULES.streakMilestones` (7/30/100/365), correction-count badges
  (first, 1,000). The design's "6 of 14" is mock; the real count comes from the
  catalogue length.
- **`apps/api`** — no new collection. Badges are **computed**, not stored:
  streak milestones already leave `streak`-kind rows in `tokenLedger` (that is
  where the design's "Earned · Apr 2026" date comes from), and correction totals
  are already in `tokenAggregates`. Add `src/modules/tokens/badges.ts` and a
  `GET /me/badges` route in the existing `src/routes/leaderboard.ts`.
- **Mobile** — screen 08 (design lines 534–573) on `app/(app)/leaderboard.tsx`:
  next-milestone progress card, badge grid, and the existing weekly/all-time
  ranking rows restyled.

## Phase 5 — Wrap-up

- Sweep for remaining hardcoded colour; both themes should be reachable from the
  in-app toggle in Settings.
- Update `langx/docs/architecture.md` with the Feed and badges surfaces.
- No `website/` or `docs/` change is needed — no plan limit or token rule moves.
  If any does, `REPO_MAP.md` → **Links between repos** lists the mirrors.

## Working conventions

Standing rules for this checkout: branch off `main` and open a PR (never commit
to `main`), **rebase** merge convention for `langx/`, push over SSH as `xuelink`.
CI on GitHub Actions gates `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
`pnpm test` — all four must pass. Artefacts in English; replies to Behiç in
Turkish. Given the size, this wants a stack of PRs by phase, not one branch —
and rebasing shifts SHAs under stacked branches, so land them in order.

## Verification

- `pnpm -r typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` at each phase.
- New shared schemas and API routes get tests next to their neighbours
  (`packages/shared/src/*.test.ts`, `apps/api/src/routes/*.test.ts`).
- Local run: `pnpm dev` (API on :4000, Expo on :8081). MongoDB must be a
  **replica set** — Better Auth wraps writes in transactions and a standalone
  `mongod` fails on first sign-up (`langx/docs/self-host.md`).
- Visual check on the droplet: Expo web on :8081 driven by Playwright — raise
  the inotify limit first or Metro dies with `ENOSPC`. Toggle light/dark and
  compare each screen against its region of the two `.dc.html` files.
- Watch for the known traps: `router.back()` resets to the first tab (use
  `goBackTo`), route literals are not typechecked despite `typedRoutes`, and
  mobile vitest cannot load `react-native` — any test touching `Platform` or the
  API client must lazy-import it.
- One live pass at the very end rather than per-phase ceremony.
