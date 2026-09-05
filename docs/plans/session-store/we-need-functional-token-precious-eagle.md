# Functional "Today's pool"

## Context

The daily token pool is fully implemented on the server — `TOKEN_RULES.pool`
(10,000/day, 5% ceiling, 24h ramp-up), `runDailyPool` in
`apps/api/src/modules/tokens/pool.ts`, a self-healing 15-minute scheduler, and 6
tests in `routes/leaderboard.test.ts`. It is also fully published: the mechanic
is described on docs.langx.io (`docs/token/distibution.md`), token.langx.io and
langx.io.

**Nothing about it reaches the app.** No HTTP endpoint exposes pool state at
all — not the pool total, not how many people are active, not your share.
`store.tsx:66-71` says so explicitly and shows message counters instead:

> Today's counters, not a projected pool share. The design draws "+84 your
> share so far", and the server is explicit that a share is only known when the
> pool closes the day […]

That reasoning is being reversed on purpose. The published docs already frame a
same-day share as **provisional** — `docs/learn-2-earn/daily-tokens.md`: "the
pool share for today reaches your balance tomorrow […] the pool share against
them is provisional" — so a live, clearly-provisional projection is sanctioned
copy, not a new promise.

Outcome: the fixed 10,000-token pool, shared out by activity score exactly as
`distibution.md` describes, becomes visible and real in the app.

**No published number changes.** No sync needed to `website/`,
`token-website/` or `docs/`.

## The design is a blocker for the card only

The screenshot in this thread is the original ten-screen handoff. PR #968
already records it as partly stale — its `Cosmetic frame 350 / "Four
available"` and `Title «Corrector» 500` lost to `packages/shared`
(`500/1500/5000`, Learner/Tutor/Polyglot). The pool's 500/day ceiling is the
part that still matches.

The current Tokens screen is to be built from the **updated Claude Design
project**, which this session cannot reach:

> **Action needed:** run `/design-login` once from an interactive Claude Code
> session on this machine. Headless runs then reuse that authorization and
> `DesignSync` can read the project.

So the work splits. **Stage A is design-independent and is the whole hard
part.** Stage B is a rendering job against a fixed contract.

---

# Stage A — the pool becomes readable (no design needed)

## 1. Extract the day's eligibility + scores — `apps/api/src/modules/tokens/pool.ts`

`runDailyPool` does one `profiles.findOne` per active user (an N+1 at
`pool.ts:96-114`). Pull that loop out so the payout and the live preview apply
**one** eligibility rule:

```ts
export interface PoolDay {
  day: string
  active: number                              // any activity, before filtering
  eligible: { userId: string; score: number }[]
  totalScore: number
  skippedNewAccounts: number
  skippedFrozen: number
}
export async function readPoolDay(db: Db, day: string, closedAt: Date): Promise<PoolDay>
```

Same predicate as today, batched: `dailyActivity.find({ day })` (the `{day:1}`
index), then a single `profiles.find({ _id: { $in: userIds } }, { projection:
{ createdAt: 1, tokenFrozenAt: 1, deletedAt: 1 } })` into a `Map`. Reuse
`countersOf` and `activityScore`; keep the `score > 0` filter. Plain finds and
JS, not an aggregation pipeline — the API has no `$lookup` anywhere and this is
not the place to introduce one.

Export the existing `dayCloseAt(day)` helper (`pool.ts:40`); the preview needs
the same instant so a ramp-up account is judged identically.

`runDailyPool` becomes: lock → `readPoolDay` → `poolShare` + `awardTokens` per
eligible user → write `PoolResult`. `PoolResult`'s fields are unchanged, so the
6 existing pool tests are the regression guard. **Behaviour-preserving.**

## 2. Live preview — new `apps/api/src/modules/tokens/poolPreview.ts`

`getPoolPreview(db, userId, at = new Date())`:

- `day = utcDayKey(at)`; eligibility judged at `dayCloseAt(day)`, exactly as the
  payout will.
- Day totals (`active`, `totalScore`) from `readPoolDay`, behind an in-process
  TTL cache keyed by day — copy the shape of
  `modules/appConfig/appConfig.ts:20-35` (`let cached = { day, value, at }`,
  `POOL_PREVIEW_CACHE_MS = 60_000`). Scanning every active user's document
  cannot be a per-request cost.
- **Your** score is read fresh, not from the cache: `readActivity(db, userId,
  at)` + `scoreOf` — one `_id` point lookup, already how `summary.ts:28` does
  it. Your own number then reacts immediately while the crowd total lags ≤60s.
  Guard the lag with `totalScore = Math.max(cachedTotalScore, score)`.
- Your own eligibility from `profiles.findOne` (`createdAt`, `tokenFrozenAt`,
  `deletedAt`): ineligible ⇒ `share: 0`.
- `share = poolShare(score, totalScore)` — the same pure function the payout
  uses, so preview and payout cannot drift.

Export `clearPoolPreviewCache()`; without it the cache leaks across test cases.

## 3. DTO — `packages/shared/src/token.ts`

```ts
export const poolPreviewSchema = z.object({
  day: z.string(),
  active: z.number(),      // eligible members sharing today's pool
  totalScore: z.number(),
  score: z.number(),       // yours
  share: z.number(),       // provisional, already clamped to maxShareOfPool
  eligible: z.boolean(),
  rampUp: z.boolean(),     // ineligible *because* the account is under 24h
})
export type PoolPreview = z.infer<typeof poolPreviewSchema>
```

`rampUp` rather than a general reason enum: a frozen account must not learn it
is frozen from an API response. Frozen yields `eligible: false`, `rampUp:
false`, `share: 0` and renders as a plain zero.

Pool total and the 500 ceiling are **not** in the DTO — the client already
reads `TOKEN_RULES` directly (`store.tsx:50`), and copying config into a
response is the drift the repo avoids.

## 4. Route — `apps/api/src/routes/tokens.ts`

`GET /me/tokens/pool` (`preHandler: requireAuth`) → `getPoolPreview`. A separate
endpoint, not a field on `GET /me/tokens`: `useTokens()` also backs the profile
screen, which should not pay for a day-wide scan.

## 5. Query hook — `apps/mobile/src/api/queries.ts`

`keys.pool = ['tokens', 'pool'] as const` beside `keys.tokens` (queries.ts:67),
and `usePool()` → `api.get<PoolPreview>('/me/tokens/pool')` with
`staleTime: 60_000` to match the server cache.

## Stage A tests

- `apps/api/src/routes/tokens.test.ts` — new `Faz 9 — daily pool preview`
  describe. Its helpers (`ageAccount`, `seedActivity`) live in
  `leaderboard.test.ts:69-99`; lift them into `src/testSupport/` rather than
  copying. Cases: two active users share proportionally; a solo active user is
  capped at 500; an account under the 24h ramp-up gets `share: 0, rampUp: true`;
  a frozen account gets `share: 0, rampUp: false`; a user with no activity gets
  `score: 0` while `active` still counts the others; an empty day returns zeros.
  `clearPoolPreviewCache()` in `beforeEach`.
- `apps/api/src/routes/leaderboard.test.ts` — the existing 6 pool tests must pass
  untouched; that is the proof the `readPoolDay` extraction changed nothing.

## Stage A docs — `langx/docs`

- `architecture.md` pool section (~l.388-411): the open day's totals are
  readable at `GET /me/tokens/pool`, cached 60s, and the share it returns is
  provisional.
- `decisions.md`: a short entry recording the reversal — a same-day share was
  deliberately withheld, is now shown as provisional, and why.

---

# Stage B — the card (after `/design-login`)

Pull the updated Tokens screen with `DesignSync` (`list_projects` →
`list_files` → `get_file`), then build the section in `app/(app)/store.tsx`
against it. The contract is already fixed by Stage A, so this is layout and
copy only:

- `usePool()` supplies `share`, `active`, `score`, `totalScore`, `rampUp`.
- `TOKEN_RULES.pool.total` and `maxShareOfPool` supply the 10,000 and the
  500/day ceiling — read, never written as copy (the rule PR #968 established
  after the handoff's numbers went stale).
- Existing primitives and idiom: `Card`, `ProgressBar`, `StatTile`, `Callout`,
  `makeStyles`/`useTheme` for light and dark. Never import a palette directly.
- Whether the pool section replaces, merges with or sits beside the current
  "Today" card (`store.tsx:66-96`, message counters + 100/day cap bar) is the
  design's call. Whatever it decides, the 100/day and 30/partner caps must
  still be stated somewhere on the screen — they are live rules.
- Replace the stale `store.tsx:66-71` comment with why a provisional share is
  now shown. Add `pool.refetch()` to `refresh()` (store.tsx:52).
- **Do not touch the offers list.** Its rows come from `COSMETICS`; the
  handoff's 350 frame and «Corrector» title are the stale numbers #968 already
  rejected.

**Pure helper + test** — `src/lib/poolCard.ts`, `poolCard.test.ts`. Same reason
`storeOffers.ts` exists: vitest cannot import `react-native`, so logic lives
outside JSX. `buildPoolCard({ pool, t })` returns the bar ratio (`share /
floor(total * maxShareOfPool)`, clamped 0–1), the active-members label, and
which note applies (ramp-up vs the normal cap line). Tests cover zero score,
the cap being hit, and the ramp-up branch.

**i18n** — `src/i18n/messages/en.ts` plus all 7 locales (`ar, de, es, fr,
pt-BR, ru, tr`), which are typed against `en.ts`, so an untranslated key fails
typecheck. The member count needs a **plural** entry (`{ one, other }`), never
`count === 1 ? …`. Final keys follow the design's copy.

While here: `purchase.mutate(id)` at store.tsx:106 has no `onError`, so a failed
purchase is silent — out of scope, flagged only.

---

## Verification

Branch from `origin/main` (local `main` can carry peers' unpushed commits), then:

```bash
cd ~/Developer/langx/langx
pnpm -r typecheck && pnpm lint && pnpm format:check && pnpm test
```

Stage A can be verified without any UI — sign two accounts in, seed
`dailyActivity`, and curl `GET /me/tokens/pool` against a local replica-set
Mongo (`pnpm dev`, API :4000).

End-to-end once Stage B lands, driven with Playwright on the Expo web build
:8081 — raise `inotify` limits first or Metro dies with ENOSPC:

1. Sign up two accounts, backdate `profiles.createdAt` past the 24h ramp-up.
2. Exchange messages and write a correction so both have real counters.
3. Profile → balance tile → Tokens. The section shows a non-zero share, two
   members active, and a bar that moves when the second account sends more and
   the screen is pulled to refresh.
4. A third account created just now shows a zero share and the ramp-up line.
5. Run `runDailyPool(db, { day: <today> })` by hand and check the awarded
   `dailyPool` ledger amount equals the last previewed `share` — preview and
   payout must agree.
