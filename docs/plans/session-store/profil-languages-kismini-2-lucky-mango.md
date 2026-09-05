# Profile languages → two cards with a visual level indicator

## Context

Both profile screens render languages as `Chip`s with the level printed as the
raw enum value — a user literally sees **“Spanish · absoluteBeginner”**
(`app/(app)/me.tsx:187`, `app/(app)/profile/[handle].tsx:162`, and again in
`app/(app)/discover.tsx:53`). `LEVEL_LABELS` / `LEVEL_SHORT_LABELS` exist in
`packages/shared/src/level.ts` and are used correctly by `edit-profile` and
`filters`, so the profile screens are the odd ones out.

Behic wants v1’s layout back: two separate cards — **Study Language(s)** and
**Mother Tongue(s)** — each with a subtitle, and the level shown as an **icon,
not as text**. That design still exists in v1 at
`langx-angular/src/app/components/profile/languages-card/languages-card.component.html`
and its level icons map 1:1 onto v2’s four levels (v1’s `0..3` are exactly
`V1_LEVEL_TO_LANGUAGE_LEVEL`).

Decided with Behic: add a real icon library rather than fake the icons with
Views; mother-tongue rows get the 🗣️ emoji; also fix `discover.tsx`, tighten the
`level: string` DTOs, and show `nativeName`.

## Approach

### 1. Add `@expo/vector-icons`

The mobile app currently has **no** icon library at all — no vector-icons, no
`react-native-svg`; the house style is emoji in `<Text>` (documented in
`src/components/IntroCarousel.tsx`, used by `app/(app)/_layout.tsx` tab icons).

Add exactly one dependency:

```bash
cd apps/mobile && npx expo install @expo/vector-icons   # SDK-57-matched version
cd ../.. && pnpm install
```

Ionicons ships the four names v1 used verbatim, so this is font-glyph rendering
— no `react-native-svg`, no native rebuild, and `expo-font` (already a
dependency) handles loading on native and web.

### 2. Level → icon map, kept pure

New `apps/mobile/src/lib/languageLevel.ts` — no `react-native` import, so
vitest can load it (`vitest.config.ts` only includes `src/lib/**/*.test.ts`,
and per the mobile testing constraint anything touching `react-native` is
untestable):

```ts
import type { LanguageLevel } from '@langx/shared'

/** v1's icons, level for level — its 0..3 are exactly V1_LEVEL_TO_LANGUAGE_LEVEL. */
export const LEVEL_ICON = {
  absoluteBeginner: 'battery-dead-outline',
  beginner: 'battery-half-outline',
  intermediate: 'battery-full-outline',
  fluent: 'rocket-outline',
} as const satisfies Record<LanguageLevel, string>
```

Plus `languageLevel.test.ts` asserting every `LANGUAGE_LEVELS` entry has an
icon — that is what catches a fifth level being added later.

### 3. `apps/mobile/src/components/LanguageCards.tsx` (new, shared by both screens)

```tsx
<LanguageCards native={profile.nativeLanguages} learning={profile.learning} />
```

Renders two cards, Study first (as in the screenshot):

| Card                | Subtitle                                   | Row left           |
| ------------------- | ------------------------------------------ | ------------------ |
| `Study Language(s)` | `The language(s) that you Practice & Learn` | `<Ionicons name={LEVEL_ICON[level]} />` |
| `Mother Tongue(s)`  | `The language(s) you speak at home`         | `🗣️` in a `<Text>`  |

Row is `[icon] Name ……… nativeName`, `nativeName` muted and right-aligned,
omitted when it equals `name` (so “English” does not print twice). Both
`getLanguage` and the row shape come from `@langx/shared`.

Details that matter:

- **Icon colour `colors.accent`**, not v1’s amber. `colors.streak` (`#f79009`)
  is the amber in the screenshot but in v2 that token means streak everywhere
  else (`me.tsx:145`, `leaderboard.tsx`); reusing it here would make it mean
  two things. There is also an open decision behind this —
  `docs/release-runbook.md` → **Design pass** has “keep v1’s amber or make the
  black-and-blue drift official” still unticked, and this change should not
  quietly settle it. Reading the token rather than a hex means one edit flips
  every icon once that is decided.
- **`accessibilityLabel={LEVEL_LABELS[level]}`** on the level icon. Removing
  the text is the whole point of the change, so the label is the only thing
  left telling a screen reader what the battery means.
- **Sort `learning` by `priority`.** The field is on the DTO, the API fills it,
  and nothing has ever used it. One line, and it makes the first language the
  user picked appear first.
- Card styling is local `StyleSheet.create` — no `Card`/`Section` component
  exists in `src/components/ui/`, and inventing one for two call sites is not
  worth it. Follow `me.tsx:295-304`’s `card` style (border, `radius.lg`,
  `spacing.md` padding) and the `sectionTitle`/`cardBody` font pairing.
- Guard each card with `length > 0`. The schema says `.min(1).max(5)`
  (`packages/shared/src/profile.ts:35,76`) so it should not happen, but an
  empty bordered card reads as a bug.

### 4. Call sites

- `app/(app)/me.tsx` — replace lines 179-191 (`My languages` + `chips`) with
  `<LanguageCards …/>`.
- `app/(app)/profile/[handle].tsx` — replace lines 150-166 (`Speaks` /
  `Learning` sections) with the same component.
- Drop the now-unused local styles/imports (`chips`, possibly `Chip`) only
  where nothing else on the screen uses them — both files still use `Chip` for
  badges and interests, so the import stays.

### 5. Agreed side fixes

- `app/(app)/discover.tsx:51-53` — `${l.level}` → `LEVEL_SHORT_LABELS[l.level]`
  in `LanguageLine`. Text list, no icons; the fix is the label, not the layout.
- `src/api/types.ts:36` (`PublicProfileDto`) and `:~57` (`DiscoveryItem`), and
  `src/api/queries.ts:67` (`MeProfile`) — `level: string` →
  `level: LanguageLevel` imported from `@langx/shared`. Required anyway:
  indexing `LEVEL_ICON`/`LEVEL_LABELS` with a bare `string` does not typecheck.

Nothing here changes a plan limit or token rule, so no `website/` or `docs/`
mirror needs updating.

## Verification

```bash
cd ~/Developer/langx/langx
pnpm -r typecheck        # catches the LanguageLevel narrowing everywhere
pnpm test                # incl. the new src/lib/languageLevel.test.ts
pnpm lint && pnpm format:check
```

Then look at it, which is the only check that matters for a visual change and
the one thing CI cannot do:

```bash
pnpm dev                 # API :4000, Expo :8081
```

Open the web build on `:8081`, sign in, and check **three** places — `/me`,
someone else’s `/profile/<handle>`, and `/discover`. Confirm no screen prints
`absoluteBeginner` any more, the battery/rocket icons actually render (a
missing glyph shows as a **box** — that is the font-loading failure mode to
watch for, on web and again after the OTA below), and `nativeName` appears on
the right. On the droplet, raise the inotify limit before starting Metro or it
dies with `ENOSPC`, then drive the page with Playwright and screenshot both
profile screens.

## Ship it — in this order

The repo is currently clean and on `main`, and `origin` is already
`git@github.com:langx/langx.git` over SSH, so pushing works from here.

1. **Branch first.** `git switch -c profile/language-cards` — never commit
   straight to `main`.
2. **Implement, then run the four local checks above** and do the visual pass.
   Fixing lint locally is free; fixing it from a red CI run costs a round trip.
3. **Commit.** English message, as with everything that lands on disk here, and
   the `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer.
   **`pnpm-lock.yaml` must be in the commit** — `expo install` changes it, and
   `ci.yml` installs with `--frozen-lockfile`, so a forgotten lockfile fails at
   the install step before a single check runs.
4. **Push and open the PR** (`git push -u origin …`, then `gh pr create`).
   Describe it as a visual change and attach the two screenshots — nothing in
   CI can show a reviewer that the icons are right.
5. **Wait for CI green.** `.github/workflows/ci.yml` runs on `pull_request`:
   typecheck → lint → format:check → test, all four must pass. The
   `ci-checker` agent reads the run and auto-fixes lint/format failures if one
   slips through.
6. **Merge by rebase**, per this repo’s convention — no merge commit. That
   reruns CI on `main` (the workflow also triggers on `push` to `main`).
7. **Deploy, per layer** — the three ship independently:
   - **API — nothing to do.** This change does not touch `apps/api`; no Fly
     deploy is needed or wanted.
   - **Web — manual.** Merging does **not** publish `app2.langx.io`; there is
     no deploy workflow, only `ci.yml`. Run it by hand:
     ```bash
     cd apps/mobile
     EXPO_PUBLIC_API_URL=<production API origin> pnpm run build:web
     pnpm run deploy:web      # wrangler → Cloudflare Pages project langx-web
     ```
     That origin is deliberately not in the repo — `.env.example` only has
     `http://localhost:4000` and the real value lives on the EAS build
     profiles (`docs/release-runbook.md:398`). It is baked in at build time, so
     omitting it ships a bundle that talks to `localhost`.
   - **Mobile — OTA, not a store build.** `@expo/vector-icons` is JS plus font
     assets with no native module, so `eas update --branch production`
     (`docs/architecture.md` → *Over-the-air updates*) is enough; EAS Update
     ships assets alongside the bundle. Applied on the **next** launch, not
     immediately.
8. **Check the deploy, then be ready to undo it.** Load `app2.langx.io` and one
   device that took the OTA. If the glyphs render as boxes on the device while
   the web is fine, the font asset did not make it into the update — that is
   the one outcome that needs an EAS Build rather than another update. A bad
   update backs out with `eas update:rollback`.
