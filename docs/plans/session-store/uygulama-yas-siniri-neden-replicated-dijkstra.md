# Lower the minimum age from 18 to 16

## Context

The stores' content-rating questionnaires put LangX at **13+ (Apple) / Teen (Google)**.
That is a rating of the *content*; the **18+** in the app is a *terms-of-use* floor, chosen
in `packages/shared/src/age.ts` because v1's published Terms already said 18 and because
18 keeps the app clear of COPPA / GDPR-K with no parental-consent work. The two do not
have to match, but the repo's own store doc predicted the rating would land at 17+/18+
"which matches the age gate" — that prediction was wrong.

Behic decided on 2026-09-03 to lower the floor to **16**. Why 16 and not 13: GDPR Article 8
lets member states set the digital-consent age anywhere from 13 to 16, and several (DE, NL,
IE, …) chose 16. At 16 no country in the EU/UK needs a parental-consent flow. COPPA only
covers under-13s, so it stays irrelevant. 13 would have required consent flows and extra
minor-safety obligations; 16 costs nothing beyond the text changes below.

Side effect worth stating: v1 accounts aged 16–17 that `legacyRestore.ts` currently bounces
(it treats an under-age `birthDate` as missing) will be able to finish onboarding after
this ships. Nobody currently inside is affected — lowering only admits more people.

The year-based arithmetic (`ageFromBirthDate`, whole years from the birth *year*) is
**not** changing; only the constant moves. Someone born in `now.year - 16` is admitted on
1 January of the year they turn 16, exactly as the 18 rule worked.

## Repos and branches

Two PRs, two repos. Nothing in `docs/` (GitBook has no age statement) or `token-website/`.

- `langx/` — the shared checkout is on a peer's branch (`docs/store-privacy-forms-checklist`);
  create a worktree from `origin/main` (`/root/wt-age16`, then `pnpm install` — every
  worktree needs its own). Rebase merge.
- `website/` — checkout is on `newsletter/v2-api`; branch from `origin/main`. Merge commit.

Land `langx/` first, then `website/` the same day so the published Terms and the enforced
rule do not disagree for longer than necessary.

## 1. `langx/` — code

**`packages/shared/src/age.ts`**
- `MINIMUM_AGE = 16`.
- Rewrite the header comment: the 18 was inherited from v1's Terms and the COPPA/GDPR-K
  reasoning; the store rating landed at 13+/Teen, and 16 is the highest GDPR Art. 8 consent
  age any EU state chose, so no parental consent anywhere and COPPA (under-13) still
  irrelevant. Keep the "server-side, the picker is a convenience" sentence.
- `meetsMinimumAge` doc comment: replace the literal `18`s with "`MINIMUM_AGE`" wording;
  the reasoning about the year-based boundary stays.

**`packages/shared/src/discovery.ts:112-113`** — `ageMin`/`ageMax` use `.min(18)` literals.
Import `MINIMUM_AGE` from `./age` and use `.min(MINIMUM_AGE)`. (This is the "limits are
config, never hard-code a threshold" rule from `CLAUDE.md`; it would silently have kept 18.)

**`apps/api/src/modules/profiles/profiles.ts:230`** — error text hard-codes "18 or older".
Use `` `You must be ${MINIMUM_AGE} or older to use LangX` `` (import from `@langx/shared`).

Mobile needs **no change**: `sign-up.tsx` and `about-you.tsx` already read `MINIMUM_AGE`, and
all eight locales interpolate `{age}` (`auth.minimumAge`, `onboarding.tooYoung`).
`legacyRestore.ts` calls `meetsMinimumAge` — no change.

## 2. `langx/` — tests

**`packages/shared/src/rules.test.ts:29-43`**
- `it('is 16+')`, `expect(MINIMUM_AGE).toBe(16)`.
- Boundary with `NOW = 2026-08-26`: `'2010-12-31'` → true (turns 16 in 2026), `'2011-01-01'`
  → false. Update the comment ("turns 16 in December is let in in January").
- `'2015-06-15'` in the schema test is still under-age at 16; leave it.

Other fixtures already use `year - 10` (`profile.test.ts:44`, `profiles.test.ts:611`) and stay
valid. `apps/mobile/src/lib/birthDate.test.ts` only round-trips dates; untouched.
`login.test.ts:296` comment says "the 18+ rule" — change to "the age rule".

## 3. `langx/` — docs

Pattern: every "18+" / "under-18s" / "turns 18" that describes the *current* rule becomes 16.
Lines that narrate v1 history ("§11 said under-18s…", "18+ wins") stay as history, with a
one-line note that the floor was later lowered to 16.

- `docs/architecture.md` — line 26 ("Minimum age **18**"), 112, 145 (decision table: drop
  "already in the Terms", say "16+; Terms updated with it"), 226-231 (age-gate bullet), 968
  (risk table), 991 (MVP P0). Lines 104-105 are v1 history: keep, add the later-lowered note.
- `docs/decisions.md` — append an entry **"The age gate went from 18 to 16"**: what the store
  rating actually came out as, why 16 (Art. 8 ceiling, COPPA unaffected), why not 13, the
  arithmetic being unchanged, and the 16–17 v1-restore side effect.
- `docs/store/privacy-data-safety.md` — line 15 table cell; lines 180-191: rewrite
  "Play target audience and content" to say **16+**, declare the **16–17** and **18+**
  groups, still no Families audience (Families only applies when under-13 groups are
  declared); rewrite "Age rating inputs" to record the **actual** outcome (Apple 13+, Google
  Teen) and state explicitly that the rating and the terms floor are different things.
- `docs/store/privacy-forms-checklist.md` — line 82 cell, lines 90-92 target-audience paragraph
  (same 16–17 + 18+ wording).
- `docs/legal/promise-change.md` — line 99 table row (16+); lines 117-121: the age gate is
  **not** unchanged any more — say it moved from 18 to 16, arithmetic the same, and that
  v1 accounts under 16 remain excluded while 16–17 regain access.
- `docs/release-runbook.md` store-form checklist (~485-508): add one line for the Play
  target-audience declaration (16–17 + 18+).

## 4. `website/` — published legal copy

- `src/lib/components/organisms/TermsAndConditions.svelte:11` — §2: 18 → 16 in both sentences.
- `src/lib/components/organisms/PrivacyPolicy.svelte:19` — "16+ requirement".
- `PrivacyPolicy.svelte:160` — §12: "16+ service … at least 16 … anyone under 16 … belongs to
  someone under 16". "Not directed to children" and "no designed-for-families programme" stay
  true and stay.
- Both files carry `*Effective Date: 31, Aug 2026*` (line 3) — bump to the merge date.

## 5. Manual, outside the repos (after both PRs merge)

- **Play Console → Target audience and content**: add the 16–17 group next to 18+. Do not
  add any under-13 group. Content rating (Teen) needs no resubmission.
- **App Store Connect**: age rating (13+) unchanged; nothing to do.
- No EAS build needed: the constant lives in shared code that the OTA update carries, and
  the server enforces it regardless of client version.

## Verification

1. In the worktree: `pnpm test` in `packages/shared` and `apps/api`; `pnpm -r typecheck`;
   `pnpm lint`; `pnpm format:check`.
2. Residue sweep before opening the PR:
   ```bash
   grep -rn -E "18\+|18 or|18 years|under-18|under 18|turns 18" docs packages apps/api/src apps/mobile --include=*.ts --include=*.tsx --include=*.md | grep -v node_modules
   ```
   Every remaining hit must be v1 history.
3. Isolated stack (`langx-isolated-verify-stack-recipe`: API on :4100, Expo on :8082, never the
   shared :4000): sign up, onboarding with birth date `2010-06-15` completes; `2011-06-15` is
   refused with the `UNDERAGE` message that now says 16. Discovery with `ageMin=16` returns 200;
   `ageMin=15` returns 400.
4. `website/`: `pnpm check` and `pnpm build`; read the two rendered pages.
5. After merge: CI on Actions, then the Play Console declaration above.
