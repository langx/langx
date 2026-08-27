# LangX v2 — architecture and design

This is the plan v2 was built from, kept as a record of _why_ the system looks
the way it does. Decisions taken during implementation — including the places
reality contradicted the plan — are in [`decisions.md`](./decisions.md).

## Context

**What v1 is.** `langx-angular` **0.15.0** — Ionic + Angular + Capacitor on an
Appwrite backend, published on the App Store and Play Store
(`tech.newchapter.languageXchange`, versionCode/buildNumber **119**), BSD
3-Clause, open source. A second, abandoned Expo/expo-router rewrite exists
(26 routes, ~11.3k lines, Appwrite + Redux Toolkit) — v2 was written from
scratch and used that only as a reference for screen structure.

**Why leave Appwrite.** Self-hosting and operations. We did not want to run
Appwrite's installation, upgrades and backups. The target is a single
deployable unit on managed services.

**The product.** Users declare the languages they speak and the ones they are
learning. Discovery _ranks_ by mutual fit, but listing is not a gate — there is
**no match/like/swipe mechanic**. Pro can message anyone; free can start 5 new
conversations per rolling 24 hours and reply to everything they receive without
limit. HelloTalk/Tandem, not Tinder. Users correct each other's sentences, and
the whole thing is wrapped in a game: streaks, token, leaderboards. Mobile
(iOS/Android) and web come out of **one Expo codebase**. Minimum age **18**.

**v2 stays open source** — BSD 3-Clause, public repo. That is an architectural
constraint, not a footnote: no secrets in the repo, entitlement enforced
server-side, anti-abuse resting on server-side enforcement rather than secrecy.
See "Open-source constraints".

**v1 has no payments and its data is real but dormant.** Verified against the
live Appwrite instance: **4787 Auth accounts, 3479 populated profiles**
(username, gender, birthdate, languages, streak). Last activity dates are one
to two months old — nobody has a live session, so nothing gets interrupted
mid-flow. There is no billing history to migrate, no need for a bridge running
both systems in parallel, and no tight cutover window. The ETL's volume is
real (thousands of records) but its one-shot assumption holds.

**Telling users is the owner's job.** When v2 goes live, the owner emails every
v1 user directly. In-app "returning user" flows were deliberately left out —
normal onboarding plus the username claim (already in the MVP) covers it.

**v2 is not a new listing.** It ships as an update over the existing store
listings, same bundle identifier and package name, preserving ratings, reviews
and install base. With no active users this is not a product problem, only a
**store identity** one. See "Store continuity".

**Inherited from v1:** usernames (reclaimable once by the original owner) and
profile data. Files currently live in Backblaze B2. **Token balances are not
migrated.**

Appwrite did four jobs for v1: auth, realtime, file storage, and
**document-level authorisation**. The last one matters most — "only these two
people can read this message" used to be a database guarantee and is now our
API's responsibility. Two more responsibilities join it in the same layer:
**entitlement checks** and the **integrity of the token economy**.

Verified external constraints:

- **Atlas BaaS (App Services / Device Sync / Data API) shut down on 30
  September 2025** → a custom API layer is mandatory.
- **Expo SDK 57**: RN 0.86.2, React 19.2.3, expo-router 57, TypeScript 6.0.3
  (the template's pin; TS 7 exists but typescript-eslint wants `<6.1.0`). New
  Architecture and Android edge-to-edge are **mandatory** in SDK 57 — the
  `newArchEnabled` and `edgeToEdgeEnabled` config keys no longer exist.
- **RevenueCat Web supports connecting your own Stripe Billing account** → the
  existing Stripe setup is preserved.

Out of scope: video calls, group rooms, vocabulary notebook, moderation
console, badge system, on-chain token.

## The product promise changes — this is a deliverable

langx.io currently claims _"free and entirely open-source"_, _"absolutely no
hidden charges or in-app purchases"_, _"All other features will remain freely
available for lifetime use"_, with the Language Copilot subscription as the
only exception. The brand position is _"100% Open Source Alternative to
Tandem!"_. The homepage also advertises a **"Learn to Earn" LangX Token** as a
live feature.

v2 breaks both:

1. **Things that were free become paid.** v1's `community/filters.page` offers
   gender + country + level (CEFR) + min/max age filters, and
   `settings/visitors.page` offers "who viewed me", both **free**. In v2 they
   are Pro.
2. **The token stays, but everything it implied goes.** v1's homepage sells a
   "Learn to Earn" token and the litepaper describes something tradable,
   staked and eventually listed. v2 keeps the **name** and drops all of that:
   LangX Token becomes an in-app point, earned by practising and teaching,
   spent on a streak freeze and cosmetics. Balances carry over, divided by 100
   (see "Gamification"). The trading, staking and marketplace claims must come
   off the site — see [`token-messaging-brief.md`](./token-messaging-brief.md).

This is communication work, and it is part of the delivery:

- `langx.io` homepage: rewrite the "no in-app purchases" / "lifetime free"
  claims and the "Learn to Earn" section.
- `langx.io/terms-conditions`: dated 7 June 2024. Add subscription terms,
  cancellation, renewal, and the token's non-transferability. **Clean up §11** — today
  it contains both "under-18s may not use this" and "our users may be children,
  we follow the Families policy / COPPA". 18+ wins.
- Privacy policy: new backend, Sentry, location, gender, activity/token data.
- The `docs.langx.io` litepaper: state plainly that the on-chain design in it
  is not being built, and that tokens are not transferable.
- Store listing copy and the **App Privacy / Data Safety** forms.
- **Check Play Console's "target audience" declaration** — a Families
  declaration changes Data Safety, ad SDK rules and content policy entirely,
  and contradicts an 18+ policy.

> **Flag — community reaction.** Making this change without explaining it to
> the community on Discord, Reddit and GitHub damages the brand's strongest
> differentiator. Recommendation: publish a reasoned note alongside the v2
> announcement (sustainability + Copilot cost), and emphasise that the code
> stays open. The call is the owner's; the plan carries it as a deliverable.

## Decisions

| Topic               | Decision                                                                                                                                                                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topology            | One Fastify container (Better Auth + REST + Socket.io in one process) + Atlas                                                                                                                                                                                                                                                                 |
| Auth                | Better Auth + `@better-auth/expo` + `mongodbAdapter`                                                                                                                                                                                                                                                                                          |
| Realtime            | Socket.io, same process                                                                                                                                                                                                                                                                                                                       |
| Discovery UX        | One ranked list + filters (no swipe); two sort presets (For you / Active) — a light equivalent of v1's five tabs that works on the indexes already present. "New Users" and "Enthusiasts" deferred to P1 (they need a new `createdAt` index and the badge system respectively); Visitors is already a separate Pro feature via `profileViews` |
| **Match model**     | **None.** No like/match/swipe — a direct "message" CTA on every profile and list row. Access is governed purely by quota: Pro unlimited, free 5 new conversations per rolling 24h. No `likes`/`matches` collection                                                                                                                            |
| Billing             | RevenueCat as the single entitlement system: StoreKit/Play Billing natively, RevenueCat Web + **our own Stripe Billing account** on the web                                                                                                                                                                                                   |
| Free quota          | **5 new conversations per rolling 24 hours**; replying is **unlimited**                                                                                                                                                                                                                                                                       |
| Pro bundle          | Unlimited conversations · advanced filters (gender, location, age, CEFR, city) · unlimited translation · who viewed me + incognito                                                                                                                                                                                                            |
| Pricing             | Monthly + yearly, 7-day trial, regional pricing                                                                                                                                                                                                                                                                                               |
| **Product promise** | **Changes** — langx.io + Terms + privacy + store listings get rewritten (section above)                                                                                                                                                                                                                                                       |
| Message correction  | **P0**, and **unlimited for everyone** (no quota)                                                                                                                                                                                                                                                                                             |
| Gamification        | **In the MVP**: streak + token + daily pool + 4 leaderboards. Non-transferable token                                                                                                                                                                                                                                                          |
| **Token**           | **Kept, not retired** (reversed 2026-08-27) — the name stays and v1 balances migrate at 1:100. What does not come across: the wallet/checkout UI, the `/token` leaderboard, and the on-chain roadmap                                                                                                                                          |
| **Copilot quota**   | **P1** (does not block the MVP). Keeps the name "Copilot" (already promised publicly under it). Free: 5 uses a day. Pro: unlimited within fair use                                                                                                                                                                                            |
| **Profile photos**  | One avatar is not enough — v1 parity means a **multi-photo gallery** (avatar + extras, capped by `PLAN_LIMITS.maxPhotos`)                                                                                                                                                                                                                     |
| Token sinks         | **Only** streak freeze + cosmetics (frame/title). Tokens can never buy a Pro feature                                                                                                                                                                                                                                                          |
| Streak condition    | At least one **meaningful action** per day (send a message or write a correction) — opening the app does not count                                                                                                                                                                                                                            |
| Username            | Old usernames are reserved; **claimed once, proven by a verified email match**                                                                                                                                                                                                                                                                |
| Storage             | S3-compatible abstraction; **moving to R2**, B2 reachable by config                                                                                                                                                                                                                                                                           |
| Migration           | Profile data + avatars + username reservations out of Appwrite, idempotent ETL                                                                                                                                                                                                                                                                |
| **Minimum age**     | **18+** (already in the Terms); age gate at sign-up, verified via `birthYear`                                                                                                                                                                                                                                                                 |
| **Licence**         | **BSD 3-Clause, public repo** — same as v1                                                                                                                                                                                                                                                                                                    |
| **Codebase**        | Written from scratch in langx2; the abandoned Expo rewrite used only as a screen/route reference                                                                                                                                                                                                                                              |
| Release model       | Brownfield update — same bundle ID and package name, staged rollout                                                                                                                                                                                                                                                                           |

## Open-source constraints

A public repo puts four items on the plan:

1. **No secrets.** No key ever lives in the repo. `.env.example` plus the
   platform's secret store. Things that legitimately _are_ public (RevenueCat
   SDK public key, Stripe publishable key) get names that make that obvious.
2. **Enforcement does not rest on secrecy.** Quotas, entitlement, token rules and
   anti-abuse thresholds are all readable. That is accepted: the defence is
   server-side validation, rate limiting and idempotency, not "nobody knows".
   `TOKEN_RULES` and `PLAN_LIMITS` are config, so weights can change at deploy.
3. **Forks can disable the paywall.** Open source plus a Pro tier makes that
   inherently possible. It is a consequence of the model, not a bug; revenue
   comes from the instance we host.
4. **Contribution surface.** `CONTRIBUTING.md`, `SECURITY.md` and
   `CODE_OF_CONDUCT.md` carry over from v1. The self-hosting guide
   (`docs/self-host.md`) is heavier than v1's single-Appwrite setup because it
   needs Atlas + R2 + Resend + RevenueCat — and it says so honestly.

## Technology choices

**Mobile/web — `apps/mobile`**

- Expo, `expo-router` (file-based; real URLs on the web, so `/user/[handle]` is
  shareable).
- **TanStack Query** for server state.
- `react-hook-form` + zod; schemas come from `packages/shared`.
- `react-native-purchases` (RevenueCat, same SDK on iOS/Android/web),
  `expo-image`, `expo-secure-store`, `expo-notifications`.

**API — `apps/api`**

- Node 24 + **Fastify** + TypeScript.
- **The official `mongodb` driver — no Mongoose.** Better Auth's adapter wants
  a native `Db`; Mongoose would be a second abstraction and a second connection
  pool, and its schema validation collides with zod. One `MongoClient`, shared
  with Better Auth.
- Validation: zod + `fastify-type-provider-zod`. Indexes are declared in
  `src/db/indexes.ts` and applied at boot by `ensureIndexes()`.
- `socket.io`, `pino`, Sentry.
- **Scheduled work:** the daily token pool, account purging and streak reminders.
  A unique `{job, periodKey}` in `jobRuns` makes a double run physically
  impossible.

**Infrastructure:** MongoDB Atlas · one container on Railway/Render ·
Cloudflare R2 · Resend · RevenueCat + Stripe · a translation provider. No Redis
at the start.

**Storage:** a `StorageProvider` interface over `@aws-sdk/client-s3` with
presigned uploads — B2 and R2 run the same code, the target is an env variable.

**Translation:** a `TranslationProvider` interface. Default **Google Cloud
Translation v3** for its language coverage; DeepL as an optional quality
upgrade on supported pairs (P1). Results are cached by `{sourceHash,
targetLang}`. Authentication uses the service-account JWT bearer flow signed
with `jose` rather than the `@google-cloud/translate` SDK — the key's
_contents_ live in `GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON` rather than Google's
usual file-path convention, because a platform secret store holds strings, not
files.

## Auth, age gate and username claim

- Server: `betterAuth({ database: mongodbAdapter(db, { client }) })` —
  email/password + Google + Apple, with verification, password reset and
  session management included.
- Client: `@better-auth/expo`; the session lives in SecureStore natively and in
  a cookie on the web. For our own API calls the cookie is read back with
  `authClient.getCookie()` and attached by hand with `credentials: "omit"`, all
  of it hidden behind one `apiFetch` wrapper.
- The Socket.io handshake validates the same session → `socket.data.userId`.
- **Age gate:** `birthYear` is required at onboarding and under-18s cannot
  complete it. The check is server-side, before `profiles` is written — the
  client's date picker is not trusted.

**Username claim**

1. The ETL fills `handleReservations` from Appwrite: `{ handle,
legacyEmailHash, legacyUserId, expiresAt, claimedBy?, claimedAt? }`, unique
   on `handle`. The email is stored **hashed** — enough to match on, without
   carrying PII we do not need.
2. After the user signs up and **verifies their email**, onboarding looks for a
   match and offers "your old username **@x** is waiting". Accepting is
   one-shot and `claimedBy` is written with an atomic `findOneAndUpdate`.
3. Reserved handles are held until `expiresAt` (12 months by default).
4. v1 users whose email has changed go through a manual support path.

## Authorisation and quota (replacing Appwrite's document permissions)

One rule: **no handler queries a collection directly.** Every module has
repository functions, and access control lives there:

- `requireAuth` → `req.userId`
- `requireConversationAccess(conversationId)` → is a participant, and no block
  either way. **No match check** — anyone may write to anyone, the only gate is
  a block
- `requirePro(feature)` → entitlement is read **from the database**, never
  trusted from the client
- `consumeQuota(kind)` → atomic decrement; charged when a conversation is
  _started_, never when writing into an existing one
- Discovery and profile queries always filter through `blocks`

**Socket events pass through the same guards.** The WebSocket must not become a
back door around authorisation, quota or token.

## Monetization

### Free vs Pro

|                            | Free                  | Pro                                         |
| -------------------------- | --------------------- | ------------------------------------------- |
| Starting new conversations | **5** per rolling 24h | Unlimited                                   |
| Replying                   | **Unlimited**         | Unlimited                                   |
| Filters                    | Language, online      | + gender, country, distance/city, age, CEFR |
| Translation                | N per day (config)    | Unlimited                                   |
| **Message correction**     | **Unlimited**         | **Unlimited**                               |
| Who viewed me              | Count only            | Identities                                  |
| Incognito                  | —                     | Yes                                         |

Every threshold lives in `packages/shared/src/limits.ts` → `PLAN_LIMITS`, never
hard-coded.

**Correction quota was deliberately dropped:** writing a correction is a favour
to the other person, and limiting it would shrink the value a free user
_provides_ a Pro one. `PLAN_LIMITS.correctionsPer24h = null` on both tiers.

**Filters and visitors are a regression:** gender/country/age/CEFR filters and
"who viewed me" were free in v1. Moving them to Pro is a deliberate change of
promise — the communication items above are part of that decision, not
optional.

### Entitlement flow

1. The client shows offerings via `react-native-purchases`. **The RevenueCat
   appUserID must equal the Better Auth user id** — `Purchases.logIn(userId)`
   after sign-in. Without it a subscription bought on the web is invisible on
   iOS.
2. Purchase: StoreKit/Play Billing natively, RevenueCat Web + the connected
   Stripe Billing account on the web.
3. **Webhook → `POST /webhooks/revenuecat`**: signature verified, processed
   idempotently by `event.id`, written to `subscriptions`, `profiles.
entitlement` updated.
4. The server decides **only** from `profiles.entitlement`; the client's
   `customerInfo` is for UI.
5. If the webhook is late, the client calls `POST /billing/refresh` and the
   server verifies against RevenueCat's REST API.
6. Cancellation, refund, chargeback and trial expiry all revoke the
   entitlement; if `expiresAt` has passed, the guard refuses.

### Quota decrement (rolling 24h, race-safe)

Quota is charged **when you send the first message into a conversation you have
never spoken in**. Replying costs nothing.

`conversations` carries `firstMessageBy` + `firstMessageAt` (index
`{ firstMessageBy: 1, firstMessageAt: -1 }`).

_Count-then-write_ overruns the quota under concurrent requests. The decrement
is one atomic document update instead: `profiles.quota.initiations` is an array
of timestamps, and a **pipeline update** both prunes entries older than 24h and
conditionally appends a new one. If the array did not grow, the quota is spent
→ `402 QUOTA_EXCEEDED`. Pro skips the step entirely. `GET /me/quota` returns
what is left and when the next slot opens.

### Paywall rules (store compliance)

- Prices are read **dynamically** from the store / Web Billing; trial terms,
  auto-renewal, the cancellation path and links to Terms/Privacy are shown.
- A **"Restore purchases"** button (required by Apple).
- On a Pro-gated action the server returns `403 UPGRADE_REQUIRED` plus the
  feature name, and the client opens a contextual paywall.
- If a free user sends a Pro filter parameter the request is **rejected**, not
  silently ignored.
- **v1 was free with no IAP**, so adding a subscription invites a fresh review:
  subscription group setup, paid apps agreement, bank and tax details, Play
  subscription products. All of it is a prerequisite.

## Gamification: streaks and the token economy

The original plan retired the token outright and dropped the balances. Both
halves were reversed on 2026-08-27: the **name stays** and the **balances
migrate**. What does not come across is everything the name used to imply —
the wallet and checkout UI, the `/token` leaderboard, and the on-chain
roadmap.

**LangX Token cannot be bought, sold, traded, staked, withdrawn or
transferred, and can never unlock a Pro feature.** That rule holds without
exception, and the reversal does not weaken it: nothing in v1 was ever
purchased either. `CHECKOUT_COLLECTION` reads like a purchase log and is a
daily payout calculation (see [`v1-reference.md`](./v1-reference.md)), so
migrating balances cannot put money-bought currency into the system.

Balances are credited to **earned** tokens, divided by
`TOKEN_RULES.legacyTokenDivisor` (100). A question of scale rather than
principle: v1 balances reach 2.28 million while a very active day here is
about 700, so a 1:1 credit would freeze the all-time table for years.

The ledger is **append-only, idempotent and period-bucketed** — correct
engineering for any point economy (audit, dispute, recompute), and it is what
makes a one-off migration credit safe to apply exactly once.

### Streak

- Condition: at least one **meaningful action** per day — sending a message or
  writing a correction. Opening the app does not advance the streak; it only
  triggers the check and shows a "send one message today" nudge.
- `profiles.streak = { current, longest, lastQualifiedDay: 'YYYY-MM-DD' }`. On
  an action: same day is a no-op, previous day increments, a gap resets to 1.
- The day is the **user's local day**. Timezone updates are rate-limited to
  stop someone farming a second day by moving their clock.
- Milestones (7/30/100 days) pay bonus token.

### Earning token — two channels

**1) Direct token**, immediate and deterministic:

| Action               | Note                                                      |
| -------------------- | --------------------------------------------------------- |
| Sending a message    | Daily cap + **per-partner cap**                           |
| Writing a correction | Weighted above messages — rewarding teaching is the point |
| Reciprocity bonus    | Only conversations **both** sides have spoken in          |
| Streak milestone     | Fixed bonus                                               |

**2) The daily pool**, distributed by cron at day close: a fixed daily pool `P`
is split among that day's active users **in proportion to an activity score**,
with a per-user ceiling (5% of the pool by default).

```
activityScore = w1·mutual conversations
              + w2·corrections written
              + w3·min(messages, cap)
              + w4·distinct partners
share = P × (activityScore / Σ activityScore)   [clamped to the ceiling]
```

Weights are config in `TOKEN_RULES`. The pool is deliberately **relative** —
making your share depend on everyone else's activity is what keeps the table
worth watching.

### Data model

- **`tokenLedger`** (append-only): `{ userId, kind, amount, refId?, day, week,
month, year, createdAt }`. **Unique `{ userId, kind, refId }`** → the same
  message or day can never be paid twice.
- **`tokenAggregates`**: `_id = '<userId>:<periodType>:<periodKey>'`. Atomic
  `$inc` on every award, index `{ periodType: 1, periodKey: 1, tokens: -1 }`.
  **This is token's only source of truth** — no duplicate counter in `profiles`,
  which would only drift.
- **`dailyActivity`**: `_id = '<userId>:<day>'`, live counters the pool reads.
- **`jobRuns`**: unique `{ job, periodKey }`, the cron idempotency lock.

### Leaderboards

Four tabs: **weekly / monthly / yearly / all time**. The query is
`find({periodType, periodKey}).sort({tokens:-1}).limit(100)` over `tokenAggregates`.
A user outside the top 100 gets their rank from
`countDocuments({periodType, periodKey, tokens: {$gt: mine}}) + 1`.

**Period keys are UTC** (`2026-W35`, `2026-08`, `2026`) because a global table
has to be comparable. **Streaks use the local day.** The asymmetry is
deliberate: one is about fairness, the other about how it feels.

### Where tokens are spent

**Only** two places: a **streak freeze** (rescuing one day) and **cosmetic
frames and titles**. Tokens can never buy a Pro feature — if they could, Pro's
value erodes and farming tokens becomes a substitute for subscribing.

### Anti-abuse

The reciprocity requirement, per-partner caps, daily caps, a ramp-up for new
accounts (no pool share in the first 24 hours), freezing the token of a user who
has been reported or blocked, and reversal via an `adjustment` row. **Every
threshold is visible in the public repo** — the defence is server-side
enforcement and idempotency, not secrecy.

### Copilot

The only paid feature ever promised publicly. The plan keeps it as a **P1 Pro
feature**. For the integrity of that promise it should land close to the v2
launch; it does not block the MVP, but it is what the monetization story ought
to be built around.

Verified live in v1: the chat screen header has a robot-icon toggle that checks
what you are typing for grammar and phrasing errors in real time and suggests a
correction ("I have a apple" → "I have an apple", with a short reason). v2
rebuilds the same function under the name **Copilot**, as part of the chat
module. Quota: free 5 uses a day, Pro unlimited within fair use.

## MongoDB schema

Principle: what is read together is embedded, what grows without bound is
split out.

**Owned by Better Auth:** `user`, `session`, `account`, `verification`. We never
write to them directly and never change their shape.

**`profiles`** — `_id = user._id`; all domain data lives here.

```ts
{
  _id: userId, handle (unique), displayName, avatarUrl,
  photos: [{ url, createdAt }],
  bio, birthYear,
  gender: 'female' | 'male' | 'other' | 'undisclosed',
  country, city, timezone, timezoneUpdatedAt,
  location: { type: 'Point', coordinates: [lng, lat] },
  nativeLanguages: [{ code: 'tr' }],
  learning: [{ code: 'en', level: 'B1', priority: 1 }],
  interests: ['music', 'tech'],
  settings: { discoverable, notifications, ageRange, distanceKm },
  privacy: { incognito: false },
  entitlement: { tier: 'free' | 'pro', expiresAt?, willRenew?, store?, updatedAt },
  quota: { initiations: [Date], translations: [Date] },
  streak: { current, longest, lastQualifiedDay },
  streakFreezes?, tokenSpent?, cosmetics?, tokenFrozenAt?,
  stats: { lastActiveAt, messagesSent },
  deletedAt?,
  createdAt, updatedAt
}
```

Indexes: **two separate** discovery indexes —
`{ 'nativeLanguages.code': 1, 'stats.lastActiveAt': -1 }` and
`{ 'learning.code': 1, 'stats.lastActiveAt': -1 }`. MongoDB refuses to combine
two array fields in one compound index ("cannot index parallel arrays",
confirmed by hand: a single combined index threw on every insert). Plus
`2dsphere` on `location`, unique `handle`, and a text index on
`displayName + bio`.

A user who picks `gender: 'undisclosed'` does not appear in gender-filtered
results, and onboarding says so.

**`conversations`** — no match gate, a conversation starts directly. Unique
`pairKey: '<minId>_<maxId>'` is the one thing `matches` used to provide: two
people can never open a second thread. Plus `participants: [a,b]`, a
denormalized `lastMessage`, `unread: {<userId>: n}`, `firstMessageBy`,
`firstMessageAt`, `bothSpoke`.

**`messages`** — a separate collection; embedding would hit the 16MB limit.

```ts
{ conversationId, senderId, type: 'text'|'correction'|'image'|'audio',
  body,                                    // caption for an attachment
  correction?: { targetMessageId, original, corrected, note },
  media?: { url, contentType, sizeBytes, durationSeconds?, width?, height? },
  readAt?, createdAt, deletedWithAccount? }
```

Attachments restore v1 parity and are what let the message migration bring a
whole thread rather than a text-only skeleton. Size is capped when the upload
URL is _signed_ rather than after the bytes have been paid for, and
`PLAN_LIMITS.mediaPer24h` caps the count on the free tier — a ceiling on abuse
rather than a paywall, since v1 offered both free. Corrections stay uncapped
because they cost nothing to store.

Index `{ conversationId: 1, createdAt: -1 }` → cursor pagination, with `_id` as
the tiebreak for a true keyset.

**`subscriptions`** — RevenueCat events plus current state; unique `eventId`.
**`handleReservations`** — unique `handle`, index on `legacyEmailHash`.
**`legacyProfiles`** — v1 profile data staged by the ETL, keyed by Appwrite id.
**`profileViews`** — unique `{viewerId, viewedId}` (upsert), 90-day TTL. No row
is written at all for an incognito viewer.
**`translationCache`** — unique `{sourceHash, targetLang}`, TTL.
**`blocks`**, **`reports`**, **`devices`**, **`streakReminders`**,
**`appwriteIdMap`**.

The language list and CEFR levels are constants in `packages/shared`.

**Discovery aggregation:**

```
$match:    discoverable, !deleted, !blocked (either direction),
           nativeLanguages.code ∈ my learning,      ← mutual fit
           learning.code ∈ my nativeLanguages
           [if Pro] gender / country / age / CEFR / city
$addFields score = language fit + shared interests + activity recency
$sort:     score desc, lastActiveAt desc  → cursor pagination
```

If the Pro distance filter is on, `$geoNear` must be the pipeline's **first**
stage.

## Updates, maintenance and remote config

Three layers ship independently, and the difference between them decides how
fast a fix reaches anyone.

| Layer                  | How it updates                                    | How long                 |
| ---------------------- | ------------------------------------------------- | ------------------------ |
| Web                    | redeploy the static export                        | next page load           |
| API                    | redeploy the container                            | immediate                |
| Mobile — JS and assets | **EAS Update** (`eas update --branch production`) | minutes, next app launch |
| Mobile — native        | EAS Build + store submission                      | days, store review       |

### Over-the-air updates

`expo-updates` points at EAS Update on the `production` and `preview` channels
already declared in `eas.json`. Screens, logic, copy and most bug fixes go out
this way without a store review; a new native module, a new permission or an
SDK bump still needs a build.

`runtimeVersion` follows the SDK version, which is what stops a JS bundle
being offered to a binary whose native layer cannot run it.

Launch never blocks on the network (`fallbackToCacheTimeout: 0`): the app
starts on the bundle it has and picks up a new one in the background, applied
on the **next** launch. Reloading under someone mid-conversation is worse than
shipping the fix a few minutes later. A bad update is undone with
`eas update:rollback`.

### Runtime config

One document (`appConfig`, `_id: 'current'`) answers three questions that would
otherwise each need their own mechanism, because all three are "the server
needs to tell the client something now":

```ts
{
  maintenance: { enabled, message, until },
  minVersion:  { ios, android, web },
  flags:       { translationEnabled, discoveryEnabled, signupsEnabled }
}
```

`GET /app-config` is unauthenticated and exempt from the maintenance gate —
it is how a client finds out _why_ everything else is refusing it. The client
reads it at launch and whenever the app returns to the foreground, not on a
timer: someone who left the app open overnight should learn about maintenance
when they come back, and polling would spend battery to learn nothing almost
every time.

Reads are cached in memory for 10 seconds, so consulting it on every request
costs nothing while a flipped switch still feels immediate.

### Maintenance mode

Two switches, checked in this order:

1. `MAINTENANCE_MODE=true` — a hard kill switch that keeps working when the
   **database** is the problem, which is exactly the situation it exists for.
   Toggling it needs a redeploy.
2. The `appConfig` flag — the everyday one. A single write, effective within
   the cache TTL, no redeploy.

While maintenance is on every route returns `503 MAINTENANCE` with a
`Retry-After` header, except `/health` (a 503 there would make the platform
restart the container in a loop), `/app-config`, and Better Auth's routes — so
an admin listed in `ADMIN_USER_IDS` can sign in and verify the fix against the
real system before letting anyone else back in.

Operated from a script rather than an admin endpoint, because this is the
control you reach for when something is wrong and it should not depend on the
API being healthy enough to authenticate you:

```bash
tsx scripts/maintenance.ts on "Back at 14:00 UTC" 2026-08-27T14:00:00Z
tsx scripts/maintenance.ts off
tsx scripts/maintenance.ts min-version ios 2.1.0
tsx scripts/maintenance.ts flag translationEnabled false
```

### The version gate

OTA updates are not instant — someone who has not opened the app in a month is
still on an old bundle, and a server change that assumes a newer client breaks
for them silently. Raising `minVersion` turns that into an explicit "update to
continue" screen, which first tries an OTA update and only falls back to the
store when there is nothing to download.

A missing **or unparseable** version header never forces an update. Parsing
junk as `0.0.0` would compare below every minimum and lock the user out, which
is exactly backwards: a header we cannot read is our problem, not theirs.

The client gate fails **open**. If `/app-config` is unreachable the app runs
normally — a config endpoint being down must never be the reason a working app
refuses to start. The server's own 503s remain the real enforcement; the screen
only makes them legible.

## Account deletion and data rights

App Store guideline 5.1.1(v) requires in-app account deletion for any app that
creates accounts; GDPR additionally requires access and portability.

- `POST /me/delete` → typed confirmation, then a **soft delete**:
  `profiles.deletedAt` is written, the user drops out of every list, sessions
  are destroyed and push tokens deleted.
- After 30 days a scheduler **hard-deletes**: `profiles`, Better Auth's
  `user`/`session`/`account`, `blocks`, `devices`, `profileViews`, the token
  ledger and aggregates. Messages the user _sent_ stay in place with their
  content cleared — they are part of a conversation the other person is also a
  party to.
- A user with an active subscription is shown the cancellation path first; a
  store subscription cannot be cancelled from our side.
- `GET /me/export` → one JSON document with everything we hold.

## Store continuity (brownfield)

With no active users and no sold subscriptions this is not a product flow; the
only thing that matters is preserving store identity.

### Values carried over from v1

| Prerequisite            | Value                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| iOS bundle identifier   | `tech.newchapter.languageXchange`                                     |
| Android `applicationId` | `tech.newchapter.languageXchange`                                     |
| Published version       | 0.15.0 · versionCode 119 · iOS build 119                              |
| iOS URL scheme          | `tech.newchapter.languagexchange` _(lowercase x)_ — must be preserved |
| Android App Link        | `https://app.langx.io`, `autoVerify` — must be preserved              |
| min/target SDK          | minSdk 22 · target 34 — minSdk will rise                              |
| EAS project             | `c331c0a6-b2fc-4664-a9a3-c04d1fb2c115`                                |
| IAP in v1               | none                                                                  |

`app.config.ts` pins the bundle ID and package byte-for-byte and declares
**both** v1's URL scheme and `langx`. The abandoned Expo rewrite declared only
`langx`, which would have broken every deep link already in the wild.

### Still unknown — needs console access

| Check                                 | Why it blocks                                                                                                                                         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Play App Signing status**           | If enabled, a lost keystore is recoverable via an upload key reset. If disabled and the original keystore is lost, that listing **cannot** be updated |
| Apple Developer + Play Console access | Certificates, provisioning, listing management                                                                                                        |
| Play "target audience" declaration    | A Families declaration contradicts the 18+ policy and changes Data Safety and SDK rules                                                               |
| Install base OS distribution          | minSdk is rising; devices below the threshold stop receiving updates                                                                                  |
| iOS associated domains                | If `app.langx.io` is declared on iOS too, it must move into entitlements                                                                              |

### Releasing

- **Staged:** 5–10% staged rollout on Play, phased release on iOS.
- The existing keystore is imported into EAS; `versionCode`/`buildNumber` start
  **above 119**.
- **App Privacy / Data Safety forms updated** — see
  [`store/privacy-data-safety.md`](./store/privacy-data-safety.md), which is
  derived from what the code actually stores.
- Third-party SDK **privacy manifests** (RevenueCat, Sentry) declared on iOS.
- **16 KB page size is already in force** — Google's extended deadline was 31
  May 2026. Expo SDK 57 / RN 0.86 handle it; the risk is third-party native
  libraries, and each must be checked for `.so` alignment before building.
- **A forced logout is a real but low cost:** all ~4787 accounts will be signed
  out. Acceptable because their last activity is one to two months old — no
  live session is interrupted.

## MVP (P0)

1. Sign-up/sign-in (email + Google + Apple), verification, password reset,
   **18+ age gate**
2. Onboarding: languages + levels → gender/bio/avatar/interests → **username
   claim**
3. Profile view/edit, presigned avatar upload + **multi-photo gallery**
4. Discovery: ranked list + free filters + **two sort presets**, infinite
   scroll, **direct message start** from a profile or the list
5. 1-1 chat: realtime, read receipts, typing, pagination, **message correction
   (unlimited)**
6. Translation service + usage quotas
7. **Monetization:** RevenueCat (native + web), paywall, webhook → entitlement,
   quota, Pro filters, who-viewed-me + incognito
8. **Gamification:** streak, token ledger, daily pool, 4 leaderboards, streak
   freeze + cosmetic sinks
9. Push notifications (message / streak reminder)
10. Block + report
11. **Account deletion + data export**
12. Web: same code, responsive, working URLs
13. Appwrite migration (profiles + avatars + username reservations)
14. **Promise update:** langx.io homepage, Terms, privacy policy, litepaper
    note, store listing copy

**P1:** Copilot, badges, availability hours, discovery boost, the "New Users"
and "Enthusiasts" sort presets. _(Voice messages moved into P0 — the message
migration needs them.)_
**P2:** video calls, groups, vocabulary notebook, moderation console, an
on-chain distribution layer (after legal review).

> **Note — v1 feature parity:** voice messages and images are back in P0,
> because the message migration would otherwise have to drop 1,270 voice notes
> and 3,604 images. Badges remain P1, so the store listing's feature list still
> needs correcting on that one point.
