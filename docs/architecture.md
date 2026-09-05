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
**no match/like/swipe mechanic**. A paid plan can message anyone; free can start 5 new
conversations per rolling 24 hours and reply to everything they receive without
limit. HelloTalk/Tandem, not Tinder. Users correct each other's sentences, and
the whole thing is wrapped in a game: streaks, token, leaderboards. Mobile
(iOS/Android) and web come out of **one Expo codebase**. Minimum age **16**.

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
   `settings/visitors.page` offers "who viewed me", both **free**. In v2 the gender and
   city filters are Fluent and "who viewed me" is Polyglot; country, age and
   level went back to free.
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
  we follow the Families policy / COPPA". 18+ wins. (Lowered to 16+ in
  September 2026 — see `decisions.md`.)
- Privacy policy: new backend, Sentry, location, gender, activity/token data.
- The `docs.langx.io` litepaper: state plainly that the on-chain design in it
  is not being built, and that tokens are not transferable.
- Store listing copy and the **App Privacy / Data Safety** forms.
- **Check Play Console's "target audience" declaration** — a Families
  declaration changes Data Safety, ad SDK rules and content policy entirely,
  and contradicts an adults-and-teens-only policy.

> **Flag — community reaction.** Making this change without explaining it to
> the community on Discord, Reddit and GitHub damages the brand's strongest
> differentiator. Recommendation: publish a reasoned note alongside the v2
> announcement (sustainability + Copilot cost), and emphasise that the code
> stays open. The call is the owner's; the plan carries it as a deliverable.

## Decisions

| Topic               | Decision                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Topology            | One Fastify container (Better Auth + REST + Socket.io in one process) + Atlas                                                                                                                                                                                                                                                                                                                           |
| Auth                | Better Auth + `@better-auth/expo` + `mongodbAdapter`                                                                                                                                                                                                                                                                                                                                                    |
| Realtime            | Socket.io, same process                                                                                                                                                                                                                                                                                                                                                                                 |
| Discovery UX        | One ranked list + filters (no swipe); two sort presets (For you / Active) — a light equivalent of v1's five tabs that works on the indexes already present. "New Users" and "Enthusiasts" deferred to P1 (they need a new `createdAt` index and the badge system respectively); Visitors is already a separate Pro feature via `profileViews`                                                           |
| **Match model**     | **None.** No like/match/swipe — a direct "message" CTA on every profile and list row. Access is governed purely by quota: Pro unlimited, free 5 new conversations per rolling 24h. No `matches` collection, and no like/match/swipe **gate**. A `likes` collection does exist, but it is a signal on feed _content_ (`targetType: 'post' \| 'correction'`) — never on a person, and it opens no channel |
| Billing             | RevenueCat as the single entitlement system: StoreKit/Play Billing natively, RevenueCat Web + **our own Stripe Billing account** on the web                                                                                                                                                                                                                                                             |
| Free quota          | **5 new conversations per rolling 24 hours**; replying is **unlimited**                                                                                                                                                                                                                                                                                                                                 |
| Fluent bundle       | Unlimited conversations · advanced filters (gender, city) · 300 translations a day · 2 languages learned, 2 spoken                                                                                                                                                                                                                                                                                      |
| Polyglot bundle     | Everything in Fluent · who viewed me + incognito · 1000 translations a day · 5 languages learned, 5 spoken · **Nearby** (distance-sorted discovery; sharing a location stays free) · AI copilot (not built)                                                                                                                                                                                             |
| Pricing             | Monthly + yearly, 7-day trial, regional pricing                                                                                                                                                                                                                                                                                                                                                         |
| **Product promise** | **Changes** — langx.io + Terms + privacy + store listings get rewritten (section above)                                                                                                                                                                                                                                                                                                                 |
| Message correction  | **P0**, and **unlimited for everyone** (no quota)                                                                                                                                                                                                                                                                                                                                                       |
| Gamification        | **In the MVP**: streak + token + daily pool + 4 leaderboards. Non-transferable token                                                                                                                                                                                                                                                                                                                    |
| **Token**           | **Kept, not retired** (reversed 2026-08-27) — the name stays and v1 balances migrate at 1:100. What does not come across: the wallet/checkout UI, the `/token` leaderboard, and the on-chain roadmap                                                                                                                                                                                                    |
| **Copilot quota**   | **P1** (does not block the MVP). Keeps the name "Copilot" (already promised publicly under it). Free: 5 uses a day. Polyglot: unlimited within fair use                                                                                                                                                                                                                                                 |
| **Profile photos**  | One avatar is not enough — v1 parity means a **multi-photo gallery** (avatar + extras, capped by `PLAN_LIMITS.maxPhotos`); an account with none gets a face generated by `GET /public/avatar/:id`                                                                                                                                                                                                       |
| Token sinks         | **Only** streak freeze, filling in a missed day, and cosmetics (frame/title). Tokens can never buy a paid feature                                                                                                                                                                                                                                                                                       |
| Streak condition    | Opening the app holds the day. A **meaningful action** (send a message, write a correction, or answer a pronunciation request) is what pays the milestone bonus for it                                                                                                                                                                                                                                  |
| Username            | Old usernames are reserved; **claimed once, proven by a verified email match**                                                                                                                                                                                                                                                                                                                          |
| Storage             | S3-compatible abstraction; **Backblaze B2** today (v1's account, new bucket), R2 reachable by config                                                                                                                                                                                                                                                                                                    |
| Migration           | Profile data + avatars + username reservations out of Appwrite, idempotent ETL                                                                                                                                                                                                                                                                                                                          |
| **Minimum age**     | **16+** (was 18+ until September 2026; the Terms moved with it); age gate at sign-up, verified via `birthDate`                                                                                                                                                                                                                                                                                          |
| **Licence**         | **BSD 3-Clause, public repo** — same as v1                                                                                                                                                                                                                                                                                                                                                              |
| **Codebase**        | Written from scratch in langx2; the abandoned Expo rewrite used only as a screen/route reference                                                                                                                                                                                                                                                                                                        |
| Release model       | Brownfield update — same bundle ID and package name, staged rollout                                                                                                                                                                                                                                                                                                                                     |

## Open-source constraints

A public repo puts four items on the plan:

1. **No secrets.** No key ever lives in the repo. `.env.example` plus the
   platform's secret store. Things that legitimately _are_ public (RevenueCat
   SDK public key, Stripe publishable key) get names that make that obvious.
2. **Enforcement does not rest on secrecy.** Quotas, entitlement, token rules and
   anti-abuse thresholds are all readable. That is accepted: the defence is
   server-side validation, rate limiting and idempotency, not "nobody knows".
   `TOKEN_RULES` and `PLAN_LIMITS` are config, so weights can change at deploy.
3. **Forks can disable the paywall.** Open source plus a paid tier makes that
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
- **Scheduled work:** the daily token pool, account purging, streak reminders,
  and the notification passes (unread digest, profile visits, badge round-up).
  A unique `{job, periodKey}` in `jobRuns` makes a double run of the pool
  physically impossible; the notification passes use `notificationLedger`,
  whose `_id` is `<job>:<userId>:<periodKey>`, for the same reason.

**Infrastructure:** MongoDB Atlas · one container on Railway/Render ·
Backblaze B2 (R2 by config) · Resend · RevenueCat + Stripe · a translation provider. No Redis
at the start.

**Storage:** a `StorageProvider` interface over `@aws-sdk/client-s3` with
presigned uploads — B2 and R2 run the same code, the target is an env variable.
Keys are prefixed `avatars/{userId}/`, `photos/{userId}/`,
`messages/{conversationId}/` and `posts/{userId}/`. The feed's prefix is keyed
by user rather than by post because the post does not exist when the URL is
signed; every prefix is one the account purge can sweep. Attachments on posts
and corrections share `mediaSchema` and `PLAN_LIMITS.mediaPer24h` with chat —
one shape, one ceiling table, one abuse budget. The ceilings are per kind, in
`MEDIA_LIMITS`: 8MB for an image, 16MB and two minutes for a voice note, 64MB
and sixty seconds for a video. A message or a post carries up to
`MAX_ATTACHMENTS` of them and spends one unit of the budget however many that
is — the per-file byte ceiling is what bounds storage, not the count.

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
- **Sessions are visible and revocable.** Settings → _Sign in on another
  device_ lists every session (`GET /list-sessions`) with a per-row sign-out
  (`POST /revoke-session`) and _sign out everywhere else_. `freshAge: 0` in
  `auth.ts` is what makes the list readable: the default gates it behind a
  24-hour freshness check, and a phone that signed in last week got a 403.
- **QR sign-in on the web** is RFC 8628's device flow. The browser polls
  `/device/token`; the phone claims the code (`GET /device?user_code=`) and
  then approves. The QR encodes a `langx://link-device` link so the phone's own
  camera lands in the app, and an `after` hook writes the session cookie for
  the browser — the token endpoint is OAuth and answers with a bearer token
  nothing in this app sends. See `decisions.md` → _Device sign-in_.
- **Emailed sign-in link** (5 September 2026). The mail carries a page on
  `app.langx.io` — a universal link, so the app opens — and the app spends
  the token itself, so the session lands in the app rather than in a browser.
  Sign-up through it is disabled; unknown addresses get the same 200 and no
  mail. See `decisions.md` → _Sign in with an emailed link_.
- **Age gate:** `birthDate` (`YYYY-MM-DD`) is required at onboarding and
  under-16s cannot complete it. The check is server-side, before `profiles` is
  written — the client's date picker is not trusted. The rule still counts
  whole years from the birth _year_, so somebody who turns 16 in December is
  admitted in January; collecting the day made the strict version possible and
  did not adopt it. Only the age is ever public — the date itself never leaves
  `GET /profiles/me`.
- **Country:** read from `CF-IPCountry` at `POST /profiles`, not asked for.
  Cloudflare's header is only believed on a request carrying `EDGE_SECRET`,
  since the Fly origin is reachable directly by IP. A device that grants
  location permission can overwrite it through `PATCH /profiles/me/country`;
  nothing else can. **The header only exists on a proxied record**, and
  `api.langx.io` was DNS-only until 4 September 2026 — so between the day the
  onboarding question was removed and that day, every account was created
  without a country and nothing anywhere reported it. A returning v1 account
  still gets one, because the restore fills `country` from the staged record;
  a v2-native account from that window has nothing on file to recover it from.
  See `scripts/backfill-country.ts`.

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

### Free vs Fluent vs Polyglot

The tiers are `free | pro | pro_plus` in code and **Free**, **Fluent** and
**Polyglot** on screen. The two are deliberately separate: a RevenueCat
entitlement identifier cannot be renamed after creation, so the display names
live in `TIER_NAMES` and the identifiers never move.

|                            | Free                                         | Fluent         | Polyglot       |
| -------------------------- | -------------------------------------------- | -------------- | -------------- |
| Starting new conversations | **5** per rolling 24h                        | Unlimited      | Unlimited      |
| Replying                   | **Unlimited**                                | Unlimited      | Unlimited      |
| Filters                    | Language, country, age, CEFR, only-my-gender | + gender, city | same as Fluent |
| Sort by distance (Nearby)  | —                                            | —              | **Yes**        |
| Translation                | **20** per rolling 24h                       | **300**        | **1000**       |
| Languages you are learning | **1**                                        | **2**          | **5**          |
| Languages you speak        | **1**                                        | **2**          | **5**          |
| **Message correction**     | **Unlimited**                                | **Unlimited**  | **Unlimited**  |
| Who viewed me              | Count only                                   | Count only     | **Identities** |
| Incognito                  | —                                            | —              | **Yes**        |
| Hiding that you are online | **Yes**                                      | **Yes**        | **Yes**        |
| AI copilot                 | —                                            | —              | **Not built**  |

Every threshold lives in `packages/shared/src/limits.ts` → `PLAN_LIMITS`, never
hard-coded.

**No tier is unlimited on translation.** It is the one feature with a real
per-request cost to a third party, so it carries a number on every tier rather
than a promise the free tier subsidises. `PLAN_LIMITS` holds all three.

The target language is the reader's own: `settings.translateTo` on the profile,
which `updateProfile` only accepts when it is one of the profile's native
languages, and `translateTargetFor` (shared) resolves at read time — the choice
if it is still native and translatable, else the first native language that
is. Settings → Appearance → _Translate into_ offers only the native languages,
and only opens a picker when there is more than one (5 September 2026).

**Hiding your online status is free on every tier**, and it is not in
`PlanLimits` at all — a boolean that is `true` everywhere is a privacy setting,
not a plan limit, and leaving it in the table would have kept `hasFeature`
answering a question with no paid answer. It became free when the profile and
the chat header started publishing "last seen": charging someone to hide data
the app has only just begun to show about them is not defensible.

**Both language lists are capped, and the cap is checked at write time only.**
A profile that already holds more languages than its tier allows keeps working
and can still be edited — the refusal is "this write would leave you with more
than your plan allows _and_ more than you already had". Without the second
half, every migrated v1 user with five languages could never edit a level or
even remove one.

**Polyglot is a superset of Fluent**, which is why its RevenueCat products
grant both entitlements. It adds who-viewed-you, incognito, Nearby and the
copilot, and raises both numbers again.

**Distance is a sort, not a filter.** There is no "within X km" filter next to
gender and country: Nearby re-orders the same list by distance, with a radius
that bounds the search rather than narrowing a result set the user could
otherwise have had. Sharing a location is free on every tier — a Polyglot-only
pool would have been empty on the day it shipped.

**Correction quota was deliberately dropped:** writing a correction is a favour
to the other person, and limiting it would shrink the value a free user
_provides_ a paying one. `PLAN_LIMITS.correctionsPer24h = null` on both tiers.

**Filters and visitors are a regression:** gender/country/age/CEFR filters and
"who viewed me" were free in v1. Moving gender, city and "who viewed me"
behind a paid plan is a deliberate change of
promise — the communication items above are part of that decision, not
optional. Level, age, country and only-my-gender have since been given back;
the paid line is now "a filter that names somebody else's attribute", which
leaves `gender` and `city`.

### Entitlement flow

1. The client shows offerings via `react-native-purchases` natively and
   `@revenuecat/purchases-js` in the browser — one surface, `lib/purchases.ts`,
   with the web half split into `lib/webBilling.web.ts` so that the browser SDK
   never reaches a native bundle. **The RevenueCat appUserID must equal the
   Better Auth user id** on all three, `Purchases.logIn(userId)` after sign-in.
   Without it a subscription bought on the web is invisible on iOS.
2. Purchase: StoreKit/Play Billing natively, RevenueCat Web Billing + the
   connected Stripe Billing account on the web. Three stores, one
   `app_user_id`, one set of package identifiers (`PACKAGES`) and one set of
   entitlement ids (`ENTITLEMENT_TIERS`) — everything after this step is
   store-agnostic, which is why the webhook and `/billing/refresh` needed no
   change when the web was added.
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
→ `402 QUOTA_EXCEEDED`. A paid plan skips the step wherever its limit is
`null`, which is every quota except translation — that one has a number on all
three tiers. `GET /me/quota` returns
what is left and when the next slot opens.

### Paywall rules (store compliance)

- Prices are read **dynamically** from the store / Web Billing; trial terms,
  auto-renewal, the cancellation path and links to Terms/Privacy are shown.
- A **"Restore purchases"** button (required by Apple).
- On a paid-gated action the server returns `403 UPGRADE_REQUIRED` plus the
  feature name, and the client opens a contextual paywall.
- If a free user sends a paid filter parameter the request is **rejected**, not
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
transferred, and can never unlock a paid feature.** That rule holds without
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

- Condition, in two halves. **Opening the app** credits the day and holds the
  streak — `POST /me/check-in`, once per local day, idempotent. A **meaningful
  action** — sending a message, writing a correction, or answering a
  pronunciation request — is what pays the milestone bonus for that day.
- The streak was strict for a while, and the cost of that was not the people it
  motivated but the ones who had a quiet day and lost two hundred of them. A
  streak that punishes a day with nothing to say teaches people to stop looking.
  Paying the milestone for showing up would be the other error: 365 days of
  opening an app is not worth five thousand token on a table other people climb
  by teaching strangers.
- Two fields, because the two facts came apart: `streak.lastQualifiedDay` is the
  last day credited by anything, `streak.lastActionDay` the last day real work
  happened. Each has its own conditional write, so a milestone crossed by a
  check-in in the morning is paid by the first real action that evening.
- A banked freeze **is** spent by a check-in. The gap it bridges is yesterday's;
  refusing to spend it would let opening the app silently reset a streak the
  user had paid to protect, with no later action able to undo it.
- `profiles.streak = { current, longest, lastQualifiedDay: 'YYYY-MM-DD' }`. On
  an action: same day is a no-op, previous day increments, a gap resets to 1.
- The day is the **user's local day**. Timezone updates are rate-limited to
  stop someone farming a second day by moving their clock.
- Milestones (7/30/100 days) pay bonus token.

### Earning token — three channels

**1) Direct token**, immediate and deterministic:

| Action                            | Note                                                                        |
| --------------------------------- | --------------------------------------------------------------------------- |
| Sending a message                 | Daily cap + **per-partner cap**                                             |
| Writing a correction              | Weighted above messages — rewarding teaching is the point                   |
| Answering a pronunciation request | Its own kind, at the correction's rate — the same act in a different medium |
| Reciprocity bonus                 | Only conversations **both** sides have spoken in                            |
| Streak milestone                  | Fixed bonus                                                                 |

Both teaching awards are filed under the **post's** id, not the row's, so
deleting a correction or a recording and writing a new one cannot be paid
twice: the ledger's `{userId, kind, refId}` unique index is the rule.

**2) Referrals**, and the only award paid to somebody other than the person who
acted. Nothing is paid for a sign-up: the invitee has to verify an email,
finish onboarding and _earn_ — a message, a correction or a pronunciation
answer — before their referrer is paid `TOKEN_RULES.referral.activation`. If
that invitee later starts a paid plan, on `INITIAL_PURCHASE` only, the referrer
gets `referral.subscription` on top, to `referral.maxPerInvitee` per person,
ever. Both kinds are **grants**: all-time only, never the weekly table, because
inviting is not practising. `referrals._id` is the invitee, so one person has
one referrer forever; `tokenLedger`'s `{userId, kind, refId}` with the invitee
as `refId` is what caps the pair.

**3) The daily pool**, paid out the morning after the day closes: a fixed daily
pool `P` is split among that day's active users **in proportion to an activity
score**, with a per-user ceiling (5% of the pool by default).

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

The day closes at 00:00 UTC; the payout runs at `TOKEN_RULES.pool.payoutHourUtc`
(04:00 UTC). The gap is deliberate — a share is a number about everyone, so it
cannot be computed until every writer has finished with the day — and it makes
the deposit land at one predictable time rather than whenever the process
happened to tick past midnight. The scheduler still asks every 15 minutes, so a
process that was down at 04:00 pays at 04:15 rather than never; `newestPayableDay`
is the shared boundary it and its test agree on.

**The app never shows a projected share.** `GET /me/tokens` carries
`pool.activeToday` and `pool.lastPayout` — how busy today is, and what the pool
actually credited last time — and deliberately no live "your share so far". Such
a projection moves all day as other people act and ignores the eligibility the
payout applies at day close, so an account inside `accountAgeRampUpHours` would
watch a share climb until midnight and be paid nothing. `GET /me/tokens/history`
pages the ledger a day at a time for the same reason: it reports what happened.

A pool row is written at `dayCloseAt(D)`, so its `day` field is already `D+1`
while its `refId` is `D`. Anything showing a share to a user must date it by
`refId` — `earnedDayOf` in `packages/shared` is that rule, used by the history
aggregation and by `readLastPoolPayout`.

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

`tokenLedger` also carries `{ userId: 1, day: -1 }` (`user_day`) for the history:
`user_created` almost serves it and does not, because a pool award is written at
its day's close and so interleaves with the next day's messages.

### Leaderboards

Four tabs: **weekly / monthly / yearly / all time**. The query is
`find({periodType, periodKey}).sort({tokens:-1}).limit(100)` over `tokenAggregates`.
A user outside the top 100 gets their rank from
`countDocuments({periodType, periodKey, tokens: {$gt: mine}}) + 1`.

**Period keys are UTC** (`2026-W35`, `2026-08`, `2026`) because a global table
has to be comparable. **Streaks use the local day.** The asymmetry is
deliberate: one is about fairness, the other about how it feels.

### Where tokens are spent

**Only** three places: a **streak freeze** (rescuing one day ahead of time),
**filling in a missed day** afterwards, and **cosmetic frames and titles**.
Tokens can never buy a paid feature — if they could, a subscription's value
erodes and farming tokens becomes a substitute for subscribing.

### Attachments unlock after five messages from the other person

You can send no image, video or voice note to somebody until they have sent
you `MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES` messages — what you received, not
what the thread carries, so one person cannot open the gate alone. No tier is
exempt. Enforced when the upload URL is **signed** — the client PUTs
straight to the bucket, so a check at send time would arrive after the bytes —
and re-checked in `sendMediaMessage`. `conversations.messageCountBy` backs it and
rides the write `recordMessage` was already making; an absent value means the
thread predates the counter and is counted on demand.

### Anti-abuse

The reciprocity requirement, per-partner caps, daily caps, a ramp-up for new
accounts (no pool share in the first 24 hours), freezing the token of a user who
has been reported or blocked, and reversal via an `adjustment` row. **Every
threshold is visible in the public repo** — the defence is server-side
enforcement and idempotency, not secrecy.

### Copilot

The only paid feature ever promised publicly. The plan keeps it as a **P1 Polyglot
feature**. For the integrity of that promise it should land close to the v2
launch; it does not block the MVP, but it is what the monetization story ought
to be built around.

Verified live in v1: the chat screen header has a robot-icon toggle that checks
what you are typing for grammar and phrasing errors in real time and suggests a
correction ("I have a apple" → "I have an apple", with a short reason). v2
rebuilds the same function under the name **Copilot**, as part of the chat
module. Quota: free 5 uses a day, Polyglot unlimited within fair use.

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
  bio, birthDate,
  gender: 'female' | 'male' | 'other' | 'undisclosed',   ← set once, like birthDate
  referredBy,                         ← who invited them; written once, never in a public view
  country, cityId, cityName, cityCountryCode, timezone, timezoneUpdatedAt,
  location: { type: 'Point', coordinates: [lng, lat] },
  nativeLanguages: [{ code: 'tr' }],
  learning: [{ code: 'en', level: 'B1', priority: 1 }],
  interests: ['music', 'tech'],
  settings: { discoverable, notifications: { <kind>: { push, email } } },
  locationUpdatedAt,
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

`location` is opt-in and **already coarsened** — every write goes through
`toGeoPoint`, which rounds to ~1 km first, so no precise position is ever
stored. Its presence is the consent record; there is no separate flag, because
a flag and the data could disagree. It never leaves the server, not even to its
owner's own public profile — Nearby returns a bucketed distance instead.

Indexes: **two separate** discovery indexes —
`{ 'nativeLanguages.code': 1, 'stats.lastActiveAt': -1 }` and
`{ 'learning.code': 1, 'stats.lastActiveAt': -1 }`. MongoDB refuses to combine
two array fields in one compound index ("cannot index parallel arrays",
confirmed by hand: a single combined index threw on every insert). Plus
`2dsphere` on `location` (sparse by nature, which is what keeps a profile with
no location out of Nearby without a filter of its own), unique `handle`, and a
text index on `displayName + bio`.

A user who picks `gender: 'undisclosed'` does not appear in gender-filtered
results, and onboarding says so. Neither `gender` nor `birthDate` is editable
afterwards — both decide whose results you appear in, so neither belongs in a
free-form PATCH. `POST /profiles/me/gender` is the one exception: it answers
the question if onboarding left it blank, once, and cannot write over an
answer that is already there.

**`conversations`** — no match gate, a conversation starts directly. Unique
`pairKey: '<minId>_<maxId>'` is the one thing `matches` used to provide: two
people can never open a second thread. Plus `participants: [a,b]`, a
denormalized `lastMessage`, `unread: {<userId>: n}`, `firstMessageBy`,
`firstMessageAt`, `bothSpoke`.

**`messages`** — a separate collection; embedding would hit the 16MB limit.

```ts
{ conversationId, senderId, type: 'text'|'correction'|'image'|'audio'|'video',
  body,                                    // caption for the attachments
  correction?: { targetMessageId, original, corrected, note },
  attachments?: [{ url, contentType, sizeBytes, durationSeconds?, width?, height? }],
  media?: <attachments[0]>,                // legacy; see below
  readAt?, createdAt, deletedWithAccount? }
```

Attachments restore v1 parity and are what let the message migration bring a
whole thread rather than a text-only skeleton. `media` is the field they were
written to before there could be more than one; every new write fills it with
the first of `attachments` so that a binary predating the list shows a photo
rather than an empty bubble, and everything reads through `attachmentsOf`.
Nothing is migrated — dropping `media` is a change of its own. Video is stored
exactly as uploaded: no transcoding, and no thumbnail file, because the player
already holds the first frame. Audio has exactly one exception, and it is the
only thing this server converts: a voice note recorded in a browser is
WebM/Opus, which no iPhone can decode at any level, so `normalizeAttachments`
fetches it, runs ffmpeg over it and stores AAC in MP4 instead — before the
insert, so the row is right the first time anything reads it. Everything else
comes back as it went in, and a host without ffmpeg stores the original. Size is capped when the upload
URL is _signed_ rather than after the bytes have been paid for, and
`PLAN_LIMITS.mediaPer24h` caps the count on the free tier — a ceiling on abuse
rather than a paywall, since v1 offered both free. Corrections stay uncapped
because they cost nothing to store.

Index `{ conversationId: 1, createdAt: -1 }` → cursor pagination, with `_id` as
the tiebreak for a true keyset.

**`subscriptions`** — RevenueCat events plus current state; unique `eventId`.
**`handleReservations`** — unique `handle`, index on `legacyEmailHash`.
**`legacyProfiles`** — v1 profile data staged by the ETL, keyed by Appwrite id.
**`legacyRooms`** / **`legacyMessages`** — v1 chat history, staged with its
attachments already copied into our bucket. Consumed pairwise: a thread is
imported only once _both_ of its participants have returned, so these outlive
any single restore. `messages.legacyId` is a sparse unique index, which is what
makes a replayed import write nothing twice.
**`profileViews`** — unique `{viewerId, viewedId}` (upsert), 90-day TTL. No row
is written at all for an incognito viewer.
**`translationCache`** — unique `{sourceHash, targetLang}`, TTL.
**`blocks`**, **`reports`**, **`devices`**, **`streakReminders`**,
~~`appwriteIdMap`~~ — removed. It had a collection, a unique index and a purge
step, and nothing ever wrote to it. The plan claimed ETL idempotency came from
here; it did not. The real mechanism is `legacyProfiles._id` (the Appwrite
document id) together with `restoredBy`, which is what every re-run actually
checks.

The language list and CEFR levels are constants in `packages/shared`.

**Discovery aggregation:**

```
$match:    discoverable, !deleted, !blocked (either direction),
           nativeLanguages.code ∈ my learning,      ← mutual fit
           learning.code ∈ my nativeLanguages
           country / age / CEFR / only-my-gender (free), [if Fluent] gender / city
$addFields onlineBucket = active in the last 5 min AND not hiding it → 1/0
$addFields score = language fit + shared interests + activity recency
$sort:     onlineBucket desc, score desc, lastActiveAt desc  → cursor pagination
```

`onlineBucket` is an **ordering, not a filter** — everyone still comes back,
the online ones lead. It was a chip once and is now unconditional, but only on
`recommended`: `sort=active` orders by `lastActiveAt` and so already puts that
window on top, and bucketing ahead of `sort=nearby` would put someone online
90 km away in front of someone offline in the next street. The cost is a
blocking in-memory sort, because a computed field cannot be indexed.

**`GET /discovery/handles?q=`** is the other way in: an anchored `^prefix`
match on `handle`, riding `handle_unique`, capped at ten. It applies the same
blocks and `discoverable` rule as the feed and deliberately **not** the mutual
language fit — finding somebody whose name you already know cannot depend on
whether you are learnable to each other.

**`sort=nearby` (Polyglot)** replaces that leading `$match` with a single
`$geoNear`, because `$geoNear` must be the pipeline's first stage and cannot
share the position. The match above is handed to it as its `query` argument
instead, so both still apply; what changes is that the 2dsphere index drives
the query and the language arrays are filtered over the candidates it returns.
`maxDistance` is what keeps that candidate set small. See `decisions.md`.

### Handles are public addresses

A profile answers at `/<handle>` — root level, so a shared link is short enough
to say out loud. `app/[username].tsx` sits at the top of the `app/` tree, which
is what puts it outside both `Stack.Protected` branches: a link has to resolve
for somebody who has never signed in, and every other profile route is behind
the session guard. Signed in it redirects to the full screen; signed out it
renders a card from `GET /public/profiles/:handle`.

That endpoint is **the only unauthenticated read in the API**, and it answers a
second, smaller allow-list than `toPublicProfile` — handle, display name,
avatar, bio, country, languages. Age, city, photos, presence, streak and tier
are absent: individually mild, together the set that makes a link somebody
shared feel like one they did not mean to. It carries its own rate limit,
because a handle is guessable and the global 300/minute is an enumeration
budget.

Three consequences for handles:

- **Every top-level route name is reserved.** Static routes win over the
  dynamic one, so a collision would not break the screen — it would break the
  _user_, whose link quietly resolves to a page instead of to them.
  `RESERVED_HANDLES` holds them, and `routeLiterals.test.ts` walks `app/` and
  fails if a route name is missing from it.
- **New handles are at least `HANDLE_MIN_LENGTH`.** Short names are where route
  collisions live, and a floor is what stops squatting on a public address.
- **Two schemas, not one.** `handleSchema` reads; `newHandleSchema` claims. v1
  handles came across under the old rule, so tightening the reading schema
  would 400 an existing account's own profile — including the link they have
  already shared. The claim rules are applied in `createProfile` rather than in
  the schema, because only there is it visible whether the handle is reserved
  _for this person_: a returning v1 user taking `ada` back is not a new claim.

`WEB_HOST` is where links point and `APP_LINK_HOST` is what the app claims in
`associatedDomains` and `assetlinks.json`. They are separate constants on
purpose — collapsing them would make re-pointing links a store-submission
change wearing the clothes of a URL edit.

### What can be shared

Every share is a sentence and a link through the platform share sheet — one
call site, `src/lib/share.ts`, and the wording in `src/lib/shareText.ts`, which
is pure so the sentences are tested. Nothing is rendered to an image: a card
would need `react-native-view-shot`, a native module, for a picture.

| What                     | Where                                     | Link         |
| ------------------------ | ----------------------------------------- | ------------ |
| Your own profile, QR too | Me → Share my profile                     | `profileUrl` |
| Somebody else's profile  | the kebab on their profile                | `profileUrl` |
| A feed post              | the row's action strip, the post's header | `postUrl`    |
| Your streak              | the streak screen, once it is above zero  | `inviteUrl`  |
| Your leaderboard rank    | the leaderboard, when you are on it       | `inviteUrl`  |
| An earned badge          | its row on the leaderboard screen         | `inviteUrl`  |
| A chat message           | long-press → More… → Share, text only     | none         |

Two rules. An **achievement carries the invite link**: a streak, a rank and a
badge are the moment a friend is most likely to try the app, and `inviteUrl`
is the profile link with the referral marker, so the brag and the invite are
one sentence. And **no balances**: `token-messaging-brief.md` says an
achievement, never money, so a token total never goes out on the sheet.

The profile card above is still the only unauthenticated read. A post link
resolves inside `Stack.Protected`, so on the web a stranger lands on sign-in
and a member on the post; the excerpt in the sentence is what tells the
recipient whether that is worth doing. When the app claims the host its links
point at, the same links open the app instead — nothing here changes.

### Community feed

Six collections, none of them a conversation with one participant: a post has
no pair, no read state and no delivery, and every index on `messages` is built
around `conversationId`.

```
posts                 { authorId, body, language, kind?, correctionCount, answerCount?, media?, createdAt }
postCorrections       { postId, authorId, corrected, note?, media?, createdAt }
pronunciationAnswers  { postId, authorId, media, slowMedia?, note?, createdAt }
postComments          { postId, authorId, body, createdAt }
likes                 { targetType: 'post' | 'correction' | 'answer', targetId, userId, createdAt }
follows               { followerId, followeeId, createdAt }
```

The feed has two sections, and `posts.kind` is which one a post is in:
`'correction'` for a sentence to be rewritten, `'pronunciation'` for a word to
be said out loud. It is **absent on every post written before the sections
existed**, and those are all corrections — the correction section matches
`{ $in: ['correction', null] }` rather than backfilling. `$ne` would read the
same and cannot be bounded by an index, which would turn the main feed into a
collection scan.

`correctionCount` and `answerCount` are the two denormalized counts here, and
both are denormalized because they are **sort keys**: each section orders by its
own count ascending, and an index cannot sort on a count it would have to join
to find. Putting the unanswered ones first is what makes the queue drain.

Comment, like and follower counts are **not** stored, for the mirror-image
reason: nothing sorts by them, so they are the `tokenAggregates` case — one
source of truth, no second counter to drift. Neither likes nor comments may
become a sort key, or the feed stops being a correction queue and becomes a
popularity contest.

A comment is text only, unlimited per person, and pays nothing — the one thing
in the feed that costs nothing to leave and earns nothing for leaving it, which
is what makes it safe to be unlimited. It is not a likeable target, for the
same reason.

A pronunciation answer carries one required recording and an optional slower
second take. Two files, **one** unit of the media quota: charging twice would
make the optional take feel expensive and be skipped, which is the behaviour it
exists to encourage. One per person per request, enforced by a unique index
that doubles as the guarantee the award is paid once.

Deleting your own post takes its corrections, answers, comments, likes and
stored objects with it. Earned token is not clawed back — the ledger is
append-only, and the people who answered did the work.

Both counting reads are a `$group` after an index-backed `$match`, returning one
row per target rather than one per like, so a post with four hundred likes costs
a page the same as one with two.

`likes` is not a match gate. `targetId` is an `ObjectId`, which rules out liking
a profile, since profiles are keyed by a string — the no-like/match/swipe rule
expressed as a type. A like grants nothing, pays nothing and opens no channel.

`follows` is one-directional and unconfirmed. The feed has no tabs: it puts
posts by the union of the follow graph and the people you have talked to first,
capped at `FEED_FOLLOWING_SOURCE_LIMIT`, then everybody else — uncorrected first
within each half. Two queries stitched end to end, with the cursor recording
which half it stopped in; see `decisions.md`.

## Updates, maintenance and remote config

Three layers ship independently, and the difference between them decides how
fast a fix reaches anyone.

| Layer                  | How it updates                           | How long                 |
| ---------------------- | ---------------------------------------- | ------------------------ |
| Web                    | redeploy the static export               | next page load           |
| API                    | redeploy the container                   | immediate                |
| Mobile — JS and assets | **EAS Update**, on every merge to `main` | minutes, next app launch |
| Mobile — native        | EAS Build + store submission             | days, store review       |

### Over-the-air updates

`expo-updates` points at EAS Update on the one channel this project has,
`production`; both build profiles in `eas.json` use it, so an internal APK and
a store install read the same stream. Screens, logic, copy and most bug fixes
go out this way without a store review; a new native module, a new permission
or an SDK bump still needs a build.

Publishing is automatic: `update.yml` runs on every merge to `main`. There is
no second channel to hold a change back on — see `decisions.md` for why, and
for the guard that makes it safe.

`runtimeVersion` is `{ policy: 'fingerprint' }`, a hash of the native layer
itself, so a bundle is only ever offered to a binary that can run it. A commit
that changes the native side changes the fingerprint, and the update reaches
nobody until the matching build ships.

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

- **Two steps, and neither is a dialog.** `settings/delete-account` asks the
  viewer to type their own handle — not a literal like `DELETE`, which is a
  word people type without reading — and `POST /me/delete/request` re-checks it
  server-side (a client-side gate is a suggestion) before mailing a link.
  Typing proves it is you at the keyboard; the link proves it is you at the
  mailbox, so a borrowed unlocked phone gets through neither.
- The token is **stored, not signed**, unlike the unsubscribe HMAC: it expires
  in a day and is spendable once, so a forwarded mail cannot delete an account
  twice. Only its hash is kept (`deletionTokens`, TTL-indexed).
- `GET /account/delete/confirm` only **asks**; the `POST` acts. Previewers and
  scanners follow a GET before any human sees the message.
- That POST calls the same `requestDeletion` the direct path always did → a
  **soft delete**: `profiles.deletedAt` is written, the user drops out of every
  list, sessions are destroyed and push tokens deleted.
- `POST /me/delete` still exists and is the fallback for a deployment with no
  `RESEND_API_KEY`, where the sender is `ConsoleEmailSender` and a link would
  only reach a log. The request endpoint answers `deliverable: false` in that
  case rather than leaving the client to guess — 5.1.1(v) does not care that
  email is unconfigured.
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
| Play "target audience" declaration    | A Families declaration contradicts the 16+ policy and changes Data Safety and SDK rules                                                               |
| Install base OS distribution          | minSdk is rising; devices below the threshold stop receiving updates                                                                                  |
| iOS associated domains                | If `app.langx.io` is declared on iOS too, it must move into entitlements                                                                              |

### Releasing

- **Play releases to everyone at once**, phased release on iOS. It was a 5–10%
  staged rollout on Play until 4 September 2026 — see the release runbook for
  what the stage was buying and what now has to be checked before the
  submission instead of after it.
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
   **16+ age gate** (18+ at launch)
2. Onboarding: languages + levels → gender/bio/avatar/interests → **username
   claim**
3. Profile view/edit, presigned avatar upload + **multi-photo gallery**
4. Discovery: ranked list + free filters + **two sort presets**, infinite
   scroll, **direct message start** from a profile or the list
5. 1-1 chat: realtime, read receipts, typing, pagination, **message correction
   (unlimited)**
6. Translation service + usage quotas
7. **Monetization:** RevenueCat (native + web), paywall, webhook → entitlement,
   quota, paid filters, who-viewed-me + incognito
8. **Gamification:** streak, token ledger, daily pool, 4 leaderboards, streak
   freeze + cosmetic sinks
9. Notifications: push, email and in-app (message / streak / badge / profile
   visits / promotions)
10. Block + report
11. **Account deletion + data export**
12. Web: same code, responsive, working URLs
13. Appwrite migration (profiles + avatars + username reservations)
14. **Promise update:** langx.io homepage, Terms, privacy policy, litepaper
    note, store listing copy

**P1:** Copilot, badges, availability hours, discovery boost, the "New Users"
and "Enthusiasts" sort presets. _(Voice messages moved into P0 — the message
migration needs them.)_
**P2:** video calls, groups, the **learning module**, moderation console, an
on-chain distribution layer (after legal review). The learning module — spaced
repetition over curated per-language, per-level courses — is what this list
used to call the vocabulary notebook, widened from a personal word list into a
content product; it is planned in [`learn-module.md`](./learn-module.md).

> **Note — v1 feature parity:** voice messages and images are back in P0,
> because the message migration would otherwise have to drop 1,270 voice notes
> and 3,604 images. Badges remain P1, so the store listing's feature list still
> needs correcting on that one point.
