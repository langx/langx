# LangX v2 — onboarding, tiers, chat and fixes

## Context

Twenty-two requests, arriving as one product push on the v2 app (`~/Developer/langx/langx`). They
fall into four groups:

1. **Acquisition** — the app demands an account before it shows anything. A guest path plus a
   welcome screen lets someone see real people before signing up, and a terms tickbox closes a
   compliance gap that exists today (nothing anywhere records consent).
2. **Monetisation** — Pro/Pro+ are renamed to **Fluent/Polyglot**, two features move up to
   Polyglot, hiding your presence becomes **free**, both language lists become tiered (1/2/5),
   "unlimited translation" becomes a real number, and Settings gets a Subscription section.
3. **Retention / craft** — presence, periodic location refresh, chat-list search and swipe
   actions, big single-emoji messages, in-app tips, a simpler Settings screen, and two new history
   screens (streak, corrections) behind the profile's stat tiles.
4. **Bugs and data loss** — the activity map is visually broken on wide screens, a paid streak
   repair is silently undone by the user's next message, there is no findable way out of search,
   and **a chat message that fails to send disappears without a word while the send button wedges
   permanently**.

Five findings changed the shape of the work and are load-bearing below: the guest **merge does not
exist**; the streak repair bug is **worse than reported**; moving `incognito` to Polyglot **silently
un-hides existing Pro subscribers**; **`emitWithAck` has no ack timeout**, so a send whose ack is
lost never settles and locks the composer forever; and the **check-in time a streak history needs is
stored nowhere at all**.

## Decisions already taken

| Question | Answer |
|---|---|
| Tier names | `pro` → **Fluent**, `pro_plus` → **Polyglot**; badges `FLUENT` / `POLYGLOT` |
| Translation | Finite per-tier daily counts on every tier. No tier is unlimited |
| Guest scope | Browse freely, write nothing. Any write → auth |
| Language cap | Write-time only. Existing over-limit profiles keep working, nothing is stripped |
| Learning languages | free 1 · Fluent 2 · Polyglot 5 |
| Native languages | free 1 · Fluent 2 · Polyglot 5 — same ladder, so it is one rule, not two |
| Offline | Visibility first (timeout, failed row, retry), persisted outbox after |
| Check-in time | New `firstAt` field going forward; older days honestly say "time unknown" |
| Presence | Last seen as min → hours → days → months → years, on profile and in the chat header |
| `hideOnlineStatus` | **Free on every tier** — it is the off-switch for newly-exposed data |

---

## Working constraint: wait for the peer, then start from its merge

`langx/` is one checkout and a peer session (`langx-76`) is working in it. **Nothing here starts
until that session has finished and merged.** Not "it committed and pushed" — finished. An
isolated `git worktree` is not an exemption: the cost being avoided is two sessions landing
overlapping changes on the same files, not tree corruption.

Concretely, before the first edit:

1. Confirm `langx-76` is idle and its open PRs (#995 wallet split, #996 welcome pack, #997) are
   merged.
2. `git fetch origin`; branch from the **merged** `origin/main`, never from local `main`.
3. Expect the peer's landed churn: `store.tsx` → `wallet.tsx`, the `store.*` i18n namespace split
   into `wallet.*` + `tokens.*`, `me.tokens` → `me.wallet`, `cosmetics.*` grown from 6 keys to 20,
   and `settings.push` / `settings.email` / `filters.onlineFirst` / `filters.availability` gone.
   Anything in this plan that adds i18n keys must be written against that, not against what the
   catalogues said before.

**Work already in flight, to be stashed and rebased, not rewritten:** a worktree at
`/root/Developer/langx/wt-activity` (branch `fix/activity-map-layout`, cut from `96858ac3`) holds
a complete, passing implementation of §7's width fix — `activityCellSize()` in
`src/lib/activityMap.ts`, `ActivityMap.tsx` measuring via `onLayout`, and 5 new tests (19/19 green,
`pnpm -r typecheck` clean). Rebase it onto the merged `main` and continue from there rather than
redoing it. The peer confirmed it touched none of those files.

One correction to §7 below, found by running it: the claim that `activityMap.test.ts:24` is
timezone-dependent is **wrong**. Verified under `TZ=America/Los_Angeles` and `TZ=Pacific/Auckland`
— parsing zone-lessly and reading with `getDay()` is self-consistent, so the test passes
everywhere. Leave it alone.

---

## PR order

Twenty-five PRs. Five chains; the guest work is last because it is the only risky part.

```
Chain A — packages/shared/src/limits.ts, strictly sequential
  PR1  Tier display names (Fluent/Polyglot)
   └─ PR2  Feature moves + translation quotas          ← BLOCKED on Q2/Q3 below
       └─ PR3  Tiered learning-language cap

Chain B — billing
  PR4  willRenew truthfulness ─┐
  PR1 ────────────────────────┴─→ PR5  Settings: Subscription section

Chain C — independent, ship in any order
  PR6  Settings: collapse app-language + legal into pickers
  PR7  Presence + last seen   ← needs hideOnlineStatus free (PR2, or free it here)
  PR8  Periodic location refresh
  PR9  Terms acceptance + Checkbox primitive
  PR10 Activity map + weekly chart alignment          ← bug
  PR11 Streak repair writes lastQualifiedDay          ← bug, highest user impact
  PR12 Streak repair price
  PR13 Tips system
  PR14 Big single-emoji messages
  PR15 Search dismiss: back arrow in the field, ✕ clears the text   ← UX bug
   └─ PR16 People search on the Chats tab
  PR17 Swipe actions on chat rows
  PR21 Streak history screen
  PR22 Correction history screen

Chain D — offline (sequential; PR18 is the one that stops data loss)
  PR18 Send: ack timeout, a visible failed row, retry     ← bug, worst data loss
   └─ PR19 Offline banner + onlineManager + networkMode
       └─ PR20 Persisted outbox + clientId idempotency

Tail — riskiest, nothing depends on it
  PR9 ─→ PR23 Guest, server half
          └─ PR24 Guest, client half
              └─ PR25 Guest → member transition
```

**Why these edges:** PR1→PR2 keeps the rename noise out of the semantic diff. PR2→PR3 avoids a
three-way merge on `PLAN_LIMITS`. PR4→PR5 because `willRenew` is currently hardcoded `true` and
PR5 would render that lie as a renewal date. PR9→PR23 because guest→member *is* a sign-up and must
reuse the same consent affordance. PR9 also delivers the `Checkbox` primitive that PR13 needs.
PR2→PR7 is a **product** edge, not a technical one: PR7 starts publishing "last seen", and the switch
that hides it must be free before it does. If PR2 stalls on its blocking questions, free
`hideOnlineStatus` inside PR7 instead — do not ship the disclosure without the off-switch.

**Conflict hazards:** PR8/PR24 both touch `app/(app)/_layout.tsx`; PR2/PR5/PR6/PR13 all touch
`settings.tsx`; PR16/PR17 both touch `chats.tsx`; PR15/PR16 both touch discover's search block;
PR11/PR21 both touch `wallet.ts`'s `repairDay`; PR18/PR20 both touch `messageCache.ts` and the
composer. Trivial merges — just don't run them concurrently.

---

## 1. Guest onboarding (PR23–25)

### There is no merge

A guest cannot write. Across all seventeen domain collections a guest therefore owns **zero rows**.
The only row is `profiles._id`, and the only thing worth keeping in it is the language selection —
which `useOnboardingDraft` already carries on the device, persisted through `localFlags.ts` and
cleared in exactly one place (`app/(onboarding)/handle.tsx` on submit).

So: **sign the anonymous session out, register fresh, let the draft carry the languages.** No
`onLinkAccount`, no id rewrite, no double `grantSignupBonus`, no RevenueCat purchase stranded under
an anon id. `furthestOnboardingStep(getDraft())` already returns `about-you` for a draft holding
languages and levels — **"don't ask for languages again" costs zero new code.**

The one thing a guest genuinely needs a server session for is **browsing**. `discoverProfiles`
(`apps/api/src/modules/discovery/discovery.ts:117`) throws `NOT_FOUND('Complete onboarding first')`
without a viewer profile and derives its entire mutual-fit `$match` from that document; feed and
profile-detail are viewer-scoped too. A client-only guest would need unauthenticated twins of three
read APIs, against `architecture.md`'s statement that `GET /public/profiles/:handle` is *the only*
unauthenticated read. Rejected.

> Say the reason out loud in the code comment: **the guest profile row exists because
> `discoverProfiles` needs a viewer document, not as an observation mechanism.** Funnel analytics is
> PostHog's job (already decided in `decisions.md`, not yet integrated).

### Design

Use Better Auth 1.7.1's **`anonymous` plugin** (`better-auth/plugins/anonymous` + `anonymousClient`)
for the session only — it rides the existing SecureStore cookie bridge, `requireAuth` and
`getSession` unchanged. Never exercise its link path.

| Concern | Handling |
|---|---|
| `_layout.tsx` `Stack.Protected guard={!!session}` | Anon session is truthy → guest lands in the signed-in branch. No change |
| `_layout.tsx` `guard={!session}` | **Breaks** — a guest holds a session, so `(auth)` unmounts. → `guard={!session \|\| isGuestSession(session)}` |
| `app/index.tsx` three-way gate | Works unchanged, twice: 404 → onboarding, then 200 → discover |
| `ws/index.ts:75` throws `EMAIL_NOT_VERIFIED` | **Hard failure.** Early-return in `useSocket`, `usePushRegistration`, `useNotificationRouting` for guests. Do NOT loosen the ws guard |
| `requireVerifiedEmail` routes | Already closed to guests for free — anon users are `emailVerified: false` |
| `grantSignupBonus` | Never runs for a guest (`createGuestProfile` ≠ `createProfile`); ledger unique guarantees once on real signup |
| `handle_unique` (non-sparse) | Synthetic `guest:<userId>` — a colon can never appear in `HANDLE_PATTERN` and it exceeds 20 chars, so no route can resolve it. **Do not make the index partial** |
| `user_email_uidx` | `emailDomainName: 'guest.langx.invalid'` — reserved TLD, unmailable |
| RevenueCat | `identifyForPurchases` **must be skipped for guests** — otherwise a customer per guest under an id that changes at registration |

### Files

- `packages/shared/src/profile.ts` — `guestProfileSchema = { nativeLanguages, learning }` + the
  existing `.refine(learningDoesNotOverlapNative)`
- `apps/api/src/auth.ts` — add `anonymous({...})` to `plugins: [expo()]`
- `apps/api/src/routes/profiles.ts` — `POST /profiles/guest`, `preHandler: requireAuth` (the one
  deliberate `requireVerifiedEmail` exception)
- `apps/api/src/modules/profiles/profiles.ts` — `createGuestProfile()`: `guest: true`,
  `settings.discoverable: false`, country via `countryFromHeaders` (a second call site for the
  existing helper), **no signup bonus**
- `apps/api/src/middleware/requireAuth.ts` — `requireMember`, same shape as `requireVerifiedEmail`,
  403 `GUEST_ACCOUNT`; new code in `packages/shared/src/errors.ts`. Apply to every write route
- `apps/mobile/src/lib/guestGate.ts` — `requireAccount(): boolean`, modelled exactly on
  `src/lib/paywall.ts`'s `openPaywall` and for the same stated reason. Keep the decision in a pure
  `shouldGateGuest(session)` so `vitest.config.ts` covers it
- `apps/mobile/src/api/apiFetch.ts` — third net: intercept `403 GUEST_ACCOUNT` → sign-up
- `apps/mobile/app/(auth)/welcome.tsx` — **new**: Continue as guest · Sign in · Create account
- `apps/mobile/src/lib/authLanding.ts` — `seenIntro ? '/(auth)/welcome' : '/(auth)/intro'`; the
  carousel's "Get started" also goes to `/welcome`. One function, three call sites
- `packages/shared/src/reservedHandles.ts` — add `'welcome'` to `ROUTE_RESERVED`, or
  `routeLiterals.test.ts` fails CI
- `apps/mobile/src/lib/onboardingStep.ts` — `GUEST_ONBOARDING_STEPS = ['languages','levels']`;
  `furthestOnboardingStep(draft, steps)` takes the array; `StepProgress` too, so it reads "Step 1 of 2"
- Cleanup: `purgeStaleGuests` in the existing scheduler family (`account/purgeScheduler.ts` is the
  model) — delete `guest: true` profiles older than a shared `GUEST_TTL`, **and** the Better Auth
  rows via `authId()`

**Critical: the guest submit must not call `resetDraft()`.** That single line is the entire
"not asked again" mechanism, and nothing would fail if it were added.

### The invariant guests break

Today every profile belongs to a verified account (`ws/index.ts:69-73` states it). Audit and pin:
`getSharedProfile`, `searchHandles`, `discoverProfiles` (add `guest: {$exists: false}` as belt and
braces), `getLeaderboard`, `toPublicProfile`.

---

## 2. Terms acceptance (PR9)

Nothing records consent anywhere today — no field, no checkbox, no `acceptedAt`.

- **New `apps/mobile/src/components/ui/Checkbox.tsx`** — there is no checkbox primitive; the only
  `accessibilityRole="checkbox"` in the app is a level pill in `filters.tsx:206`. Build it the way
  `ui/Toggle.tsx` argues for: custom control in the theme palette, not the platform widget. Square
  + `Feather name="check"`, `accessibilityState={{ checked }}`. **PR13 reuses it.**
- `apps/mobile/app/(auth)/sign-up.tsx` — the tickbox, with inline links to `LEGAL_LINKS`
  (`src/lib/externalLinks.ts`, keys `legal.privacy` / `legal.terms`) opened via `openExternal()`.
  Sign-up has no legal text at all today
- Record it server-side in `apps/api/src/auth.ts`'s existing `databaseHooks.user.create.after` hook
  (already there for `tryRestore`): `termsAcceptedAt` + the version accepted
- The welcome screen (PR23) states the same thing for guests

---

## 3. Tier rework (PR1–3)

### The new table — `packages/shared/src/limits.ts`

| | free | pro (Fluent) | pro_plus (Polyglot) |
|---|---|---|---|
| `initiationsPer24h` | 5 | null | null |
| `translationsPer24h` | 20 | **300** | **1000** |
| `correctionsPer24h` | null | null | null |
| `mediaPer24h` | 50 | null | null |
| **`maxLearningLanguages`** *(new)* | **1** | **2** | **5** |
| **`maxNativeLanguages`** *(new)* | **1** | **2** | **5** |
| `advancedFilters` | false | true | true |
| `profileViewerIdentities` | false | **false** | true |
| `incognito` | false | **false** | true |
| `hideOnlineStatus` | *leaves `PlanLimits` — free on every tier, see below* | | |
| `nearby` / `copilot` | false | false | true |
| `maxPhotos` | 6 | 6 | 6 |

```
PRO_FEATURES      = ['advancedFilters']
PRO_PLUS_FEATURES = ['profileViewerIdentities','incognito','nearby','copilot']
PRO_BENEFITS      = ['unlimitedInitiations','advancedFilters','translationQuota','learningLanguages']
PRO_PLUS_BENEFITS = [...the four features, 'translationQuota','learningLanguages']
```

**`hideOnlineStatus` leaves `PlanLimits` altogether.** A boolean that is `true` on every tier is not
a plan limit — it is a privacy setting, like `activityMapVisible` beside it. Leaving it in the table
as a uniform `true` would keep `hasFeature`/`tierUnlocking` answering a question that no longer has a
paid answer. Concretely:

- delete the field from `PlanLimits` and all three `PLAN_LIMITS` rows;
- **delete the write guard at `routes/profiles.ts:165-173`** — its entire job was the tier check;
- `presenceVisibility.ts` needs no change: it never checked the tier, and its comment already argues
  that a privacy setting must not be revoked by a billing event. That reasoning now covers the flag
  outright rather than by exception;
- `settings.tsx:284-300` loses its PRO tag and `disabled` entirely, rather than moving to
  `useHasFeature`;
- it comes out of `PRO_BENEFITS`, so the paywall stops selling it.

This is why only **two** capabilities move to Polyglot rather than three — and it retires one of the
grandfathering hazards before it can bite. `incognito` remains the blocking one.

`unlimitedTranslation` cannot survive — no tier is unlimited. `translationQuota` and
`learningLanguages` appear in **both** benefit lists because Polyglot genuinely raises both
numbers again, and `paywall.tsx:342` renders Pro+ as *extras only* plus "everything in Pro".

`hasFeature`, `tierUnlocking`, `effectivePlanTier` are untouched — they read the real table, which
is the property `limits.ts`'s header comment protects. **Introduce no `tier > 'free'` comparison.**

Consequence in `paywall.tsx`: `BenefitCopy.count` is a module constant read off `PLAN_LIMITS.free`
today; it must become `count?: (tier: PaidPlanTier) => number` so the Fluent row says 300 and
Polyglot says 1000. The `Record<ProBenefit, …>` compile-time enforcement survives.

**"Their level in your language" needs no change** — `minLevel`/`maxLevel` are already free
(`DISCOVERY_PRO_FILTER_KEYS = ['gender','onlyMyGender','city']`), and `discovery.test.ts:42,47`
already pins that.

### Tier display names — one table, six sites

New in `packages/shared/src/limits.ts` (shared, so the API can word an email with the same names):

```
TIER_NAMES:  Record<PlanTier, string>        = { free:'Free', pro:'Fluent', pro_plus:'Polyglot' }
TIER_BADGES: Record<PlanTier, string | null> = { free:null,  pro:'FLUENT', pro_plus:'POLYGLOT' }
```

Preserve both existing rationales verbatim in spirit: names are a brand, identical in every locale
(`paywall.tsx:50-52`); free has no badge, because a chip reading "FREE" is an insult
(`TierBadge.tsx:17-18`).

| Site | Change |
|---|---|
| `paywall.tsx:53-56` local `TIER_NAME` | delete, import `TIER_NAMES` |
| `paywall.tsx:227` `title="LangX Pro"` | new neutral i18n key `paywall.title` — the screen now sells two differently-named plans |
| `TierBadge.tsx:23` | `TIER_BADGES[tier]`. Leave `Chip tone: 'pro' \| 'proPlus'` — theme tokens, not display names |
| `me.tsx:64-68` | `TIER_BADGES[tier]` (it duplicates TierBadge's logic inline today) |
| `settings.tsx:244,289,420` | `TIER_BADGES[tierUnlocking('incognito')]` → POLYGLOT. **`tierUnlocking` already exists for exactly this** and follows future moves automatically |
| `filters.tsx:47` | `TIER_BADGES[tierUnlocking('advancedFilters')]` → FLUENT |

i18n with the brand baked into a sentence, all ×8: `me.proTitle`, `welcomeBack.proForLife`/
`proPlusForLife` (collapse to one `tierForLife` with `{plan}`), `me.viewersLocked`,
`paywall.manageNotice` (already has `{plan}`), `paywall.unlimitedTranslation` → `translationQuota`
with `{count}`, new `paywall.learningLanguages`.

**Never rename** the RevenueCat entitlement ids `pro`/`pro_plus` or the `PACKAGES` keys —
`decisions.md` records that entitlement identifiers cannot be renamed after creation.

### `useIsPro()` → `useHasFeature()`

They agree today only because all four flags sit in `PRO_FEATURES`. After PR2 they diverge:

| Site | After |
|---|---|
| `settings.tsx:244,249` incognito | `useHasFeature('incognito')` |
| `settings.tsx:289,293` hideOnline | **no gate at all** — it becomes a plain free toggle |
| `filters.tsx:61` → 6 call sites | `useHasFeature('advancedFilters')` |
| `discover.tsx:94` → `:143` strip, `:202` label | `useHasFeature('advancedFilters')` — if the client strips and the server disagrees the user gets a 403 instead of a list |
| `settings.tsx:420` app icon | **keep `useIsPro()`** — local cosmetic, not in `PLAN_LIMITS`, "any paid plan" is the intent |
| `me.tsx:48` upsell card | **keep `useIsPro()`** |

`me.tsx:141` reads the server's `locked` flag from `profileViews.ts:97`, so who-viewed-you moves
tiers with **zero client logic change** — only the copy naming the tier.

While in `src/lib/discoveryFilters.ts:141-147`: rewrite `withoutProFilters` as "everything except
`PRO_KEYS`" instead of a hand-written free-key allow-list. One line, latent bug, same file.

### The language caps — learning *and* native (PR3)

Zod cannot express a tier-dependent max — route schemas are registered at boot, before any request.
Keep zod at the ceiling: export `MAX_LEARNING_LANGUAGES` and `MAX_NATIVE_LANGUAGES` from
`packages/shared/src/profile.ts` (today the single private `MAX_LANGUAGES = 5` at line 36), each
defined as its `pro_plus` row so the ceiling cannot drift from the table.

**Native languages are tiered on the same ladder** — free 1 / Fluent 2 / Polyglot 5 — so this is one
rule applied to two arrays, not two rules. Both keep `.min(1).max(5)` in zod.

> **Flag to the owner before PR3 ships.** Capping *native* languages is not the same trade as
> capping learning ones. Discovery's mutual-fit `$match` reads the viewer's `nativeLanguages`, so a
> free user held to one native language is not merely limited — they become **findable by fewer
> people**. For someone raised bilingual a second native language is an identity fact, not a
> feature. This is the same argument `limits.ts` already records for moving level, age and country
> back to free: charging for them "made the free tier worse at the one thing the product is for".
> The ladder is what was asked for and is what is planned; the risk is worth naming once.

**The check goes in `updateProfile()` in `apps/api/src/modules/profiles/profiles.ts`, beside the
existing overlap cross-check at :323-331** — the one place that has both the tier and the stored
profile. Also in `createProfile()`, where the tier is always free, so onboarding caps at 1 of each.
Write it once over both arrays.

> **The grandfathering rule, and the clause that makes it real:** refuse a write only if it would
> leave the user with more languages **in that array** than their tier allows **and more than they
> already had**. Without `&& > current.length`, every migrated v1 user with 3–5 languages could
> never edit a level, reorder priorities, or even *remove* one. Applied to each array
> independently — being over the limit on natives must not block a learning-language edit.

Refusal is `403 UPGRADE_REQUIRED` with `{ limit: 'learningLanguages' | 'nativeLanguages', max }` —
**not** `{ feature }`,
which must be a `PlanFeature` boolean. Client calls `openPaywall()` with no feature key, exactly as
translation already does on `QUOTA_EXCEEDED`.

Client caps (all hardcoded `5` today): `(onboarding)/languages.tsx:93` and `:102` both read the
`free` row (onboarding is always free); `edit-profile.tsx:316` reads the viewer's tier row for
whichever mode the shared picker is in. The i18n key `onboarding.upToFive` bakes `5` into all eight
locales → rename to `onboarding.upToCount` with `{count}`.

### `rules.test.ts`

Pro+ **remains a strict superset** of Pro after the moves — what breaks is the test's *equality*
encoding at :104-106 (`pro_plus.translationsPer24h` 1000 ≠ pro's 300). Replace with an
`atLeastAsGood(a, b)` helper (`null` beats any number; larger beats smaller) applied to all four
numeric rows. **This is strictly stronger than what is there.** Add: no tier is `null` on
translations; **both** language caps strictly increasing and free ≥ 1, asserted over a list of the
two keys so a third tiered array cannot be added without a row here; `PRO_FEATURES` and
`PRO_PLUS_FEATURES` disjoint and together equal `PLAN_FEATURES`.

---

## 4. Settings (PR5, PR6)

### Pickers: new routes, not modals

There is **no Modal or BottomSheet primitive** in `src/components/ui/`. The house pattern already
exists seven times — `(app)/_layout.tsx` registers `blocked`, `starred`, `filters`, `intro`,
`viewers`, `settings`, `kitchen` as `href: null` full-screen routes, and `blocked`/`starred` are the
exact analogues. A route also gets a real URL on web and is validated by `routeLiterals.test.ts`.

New: `app/(app)/app-language.tsx`, `app/(app)/legal.tsx`, both `FULL_SCREEN`. No reserved-handle
change needed — `HANDLE_PATTERN` forbids hyphens, and `legal` is already in
`INFRASTRUCTURE_RESERVED`.

`settings.tsx:368-387` (9 stacked rows) collapses to one `ListRow` with the current language as its
`value`; the `LOCALE_OPTIONS.map()` moves into the new screen unchanged, check icon and all.
`settings.tsx:440-450` collapses the same way.

### Subscription section

Placed first, above Privacy.

| Row | Content |
|---|---|
| Current plan | `TIER_NAMES[useEffectiveTier()]` |
| Renewal | `willRenew && expiresAt` → "Renews on {date}"; `!willRenew` → "Ends on {date}"; paid, no expiry → "Lifetime"; free → nothing |
| Upgrade | free or Fluent → `openPaywall()`; Polyglot → hidden |
| Manage / cancel | store deep link |

`willRenew` and `store` are **already on the wire** — `GET /profiles/me` returns the raw document;
the mobile type at `src/api/queries.ts:134` is just narrower. Widen it. **Zero server change.**

**PR4 first:** `apps/api/src/modules/billing/refresh.ts:27-30` hardcodes `willRenew: true`, and with
no webhook endpoint configured the refresh path is the *only* path. Read the real state from
RevenueCat's subscriber payload (`will_renew` / `unsubscribe_detected_at`) before rendering a
renewal date.

**Cancel** — `src/lib/manageSubscription.ts`, pure and testable:
`customerInfo.managementURL` (correct on all three stores) → iOS
`https://apps.apple.com/account/subscriptions` → Android
`https://play.google.com/store/account/subscriptions` → web `null`. **When null, hide the row** —
`settings.tsx:405-409` already states the rule: a row that cannot work is worse than one that is
not there.

---

## 5. Presence and last seen (PR7) — no new server field

`toPublicProfile` (`modules/profiles/profiles.ts:546-590`) **already ships** `isOnline` and, when the
profile is not hidden, `lastActiveAt`; `src/api/types.ts:61` already types it. The client simply
never reads it. **Nothing is added to the server.**

The rule, on both surfaces: **one line under the display name.** Online → a green dot and "online".
Offline → "last seen {time}". They are mutually exclusive states, so this is one line whose content
swaps, never two stacked — which is also what the chat header physically allows (`chat/[id].tsx:533-537`
records that the header is 40px and a third line pushes the avatar out of alignment).

### The formatter is the part that does not exist yet

`relativeTime` (`format.ts:37`) is **not** usable as-is: it steps `now → {n} min → {n} h → {n} d` and
then, past seven days, **falls back to an absolute date** (`toLocaleDateString` → "12 Aug"). It can
never say "3 months ago" or "2 years ago".

The right model is `accountAgeLabel` (`src/i18n/labels.ts:77-82`), which composes a `MessageKey` from
a unit and passes `{ count }`. So: `lastSeenLabel(t, iso, { locale, now })` in the same file, with
the full ladder — **minutes → hours → days → months → years** — each a `{one, other}` plural entry,
per the house rule that a count never gets a ternary (Russian and Arabic do not split there). Under a
minute reads as online anyway, so the bottom of the ladder is never reached in practice; keep a
"just now" rung regardless for the boundary. Injectable `now`, matching `isOnlineAt(…, now)` and
`PresenceThrottle(now = Date.now)`. It lives under `src/i18n/**`, which `vitest.config.ts` covers, and
`format.test.ts` is the model — `createTranslate('en')`, no React, no `react-native`.

### Three client pieces

1. `lastSeenLabel` as above, plus new `format.lastSeen*` plural keys ×8 locales.
2. **`src/components/PresenceLine.tsx`** — one component, two call sites, so profile and chat header
   cannot drift. `TierBadge`'s doc comment makes exactly this argument ("two screens rendered this
   inline and disagreed"). Props: `{ lastActiveAt?: string }`. **Renders nothing when the field is
   absent** — which is precisely the hidden case, because `toPublicProfile` omits it rather than
   nulling it. That is the privacy rule enforced by the shape of the data, not by a second check.
3. **Recompute `isOnline` on the client** with `isOnlineAt(lastActiveAt, now)` from `@langx/shared` —
   the same function the server used. `useProfileCache`'s `staleTime` is `5 * 60_000`, exactly
   `ONLINE_WINDOW_MS`, and nothing invalidates it on socket events, so the server's boolean can be a
   five-minute-old claim that someone is online. Recomputing lets a stale cache **decay correctly**
   on its own, and means `PresenceLine` needs only the timestamp.

### Placement

- **Profile hero** `profile/[handle].tsx`: between the name (`:204`) and the handle line (`:210`).
  `hero` is `alignItems: 'center'`, so the dot+label needs its own row wrapper — `PresenceLine`
  provides it.
- **Chat header** `chat/[id].tsx:542`: the `: null` becomes `<PresenceLine … />`. Typing still wins
  over presence, so the precedence is typing → presence → nothing, still one line.
- **Not** on `me.tsx:82` (your own profile) and **not** on `app/[username].tsx:87`.
  `sharedProfile.ts` omits `stats` entirely and its comment names "online status and last-active: a
  presence beacon addressable by guessing a handle" as deliberately absent. The data is not even on
  that wire.

### The privacy question this opens, and its answer

`lastActiveAt` is already on the wire but has never been rendered. Showing it publishes something
nobody has seen before — "last seen 3 months ago" is a real disclosure about a dormant user.

The off-switch already exists and already covers both halves: `hideOnlineStatus` makes
`toPublicProfile` omit `isOnline`'s truth **and** the timestamp. **It becomes free on every tier**
(§3) precisely because of this PR — charging someone to hide data we have just started publishing
about them is not defensible, and it is the same argument `limits.ts` already records for giving
level, age and country back to the free tier.

So the ordering matters: **PR7 must not ship before `hideOnlineStatus` is free.** If PR2 slips,
free it in PR7 itself. Also reword `settings.hideOnlineBody` across eight locales — it currently
describes a green dot, and it now governs "when you were last here" too.

---

## 6. Periodic location refresh (PR8) — AppState, not setInterval

`app.config.ts:145-164` disables background location on both platforms with a comment that adding it
changes both stores' privacy forms. So a timer **only ever fires while foregrounded anyway** — the
`AppState` listener in `useAppConfig.ts:34-38` expresses the same thing exactly, and its doc comment
already makes the argument ("polling in the background would spend battery to find out nothing
almost every time"). The app's only `setInterval` is a heartbeat, which must fire on a cadence; this
must not.

- Throttle on `profiles.locationUpdatedAt`, already stored, already returned, rendered nowhere: on
  foreground, if `location` exists and `now - locationUpdatedAt > LOCATION_REFRESH_MIN_GAP_MS`,
  capture and POST. New shared constant in `packages/shared/src/location.ts`, start at 6h — the
  coordinate grid is ~1.1km, so anything finer rewrites the same cell
- **The permission trap:** `captureLocation()` calls `requestForegroundPermissionsAsync()` when
  `!granted && canAskAgain`, so a foreground-driven refresh would fire an OS dialog at people who
  never asked. Add `captureLocation({ promptIfNeeded = true })`; the refresh passes `false` and is
  **silent on every failure**
- `src/hooks/useLocationRefresh.ts`, mounted once in `(app)/_layout.tsx:34` beside `useSocket()`
- While in there: render `locationUpdatedAt` as the `subtitle` on the existing "update location" row
  (`settings.tsx:314-321`) with `relativeTime` — one line, and it is the argument the field's own
  doc comment makes

---

## 7. Activity map + weekly chart (PR10) — two separate bugs

### The grid does not fill the width

`ActivityMap.tsx` is entirely fixed pixels: `WEEKS = 26` (:13), `cell 13×13`, `gap 3` (:226-233), no
`onLayout`. That is `26×13 + 25×3 = **413px**`. `Screen`'s content box on web is
`layout.maxWidth 720 − 2×spacing.lg 16 = **688px**`. **688 − 413 = 275px of dead space** — exactly
the gap in the screenshot. On a 390px phone the same numbers overflow and the horizontal `ScrollView`
does its job, which is why this only shows on wide screens.

Fix: measure with `onLayout` and derive either the cell size or the week count from the available
width, keeping the `ScrollView` for narrow screens. Note `ActivityMap.tsx:39` claims "the server
clamps the range" — **it does not**; `routes/activity.ts:26-61` takes `from`/`to` uncapped. Clamp it
server-side while here.

### The colours are correct, the widgets disagree about "today"

The amber-only-last-column pattern is the account being young, not a bug: `activityMap.ts:46-47`
always winds forward to the Sunday closing this week and marks `> today` as `future`
(`backgroundColor: 'transparent'`), so on a Monday the visually-last column is column 25.

**The real defect is a timezone split.** `WeeklyChart`'s data is **UTC**-bucketed
(`modules/tokens/dailyActivity.ts:119-141` `utcDayKey`; `token.ts:386` says so), while `ActivityMap`
is **local-day** bucketed (`routes/activity.ts:34` `localDayKey(…, profile.timezone)`). At UTC+3,
between 00:00 and 03:00 local, the two widgets on the same screen are a full column out of step and
messages sent in that window land under the previous letter. Pick one — local, matching the map and
the streak — and change `readActivityWeek` to take the timezone.

Also: `activityMap.test.ts:24` uses local `getDay()` against a UTC implementation and will fail west
of UTC. Fix while here.

---

## 8. Streak repair (PR11, PR12)

### The bug is worse than reported — this is the highest-impact fix in the list

`repairDay` (`apps/api/src/modules/tokens/wallet.ts:246-340`) **does** recompute `streak.current`
and `streak.longest` (:307-331), and the client **does** invalidate correctly, so the number moves
immediately. What it never writes is **`streak.lastQualifiedDay`** — compare `restoreStreak`
(:208) and `recordQualifyingAction` (`streak.ts:98`), both of which do.

The next qualifying action then reads the stale value and destroys the purchase
(`streak.ts:80-89`):

> Today 08-31. Last acted 08-29 (`current: 3`, `lastQualifiedDay: '2026-08-29'`), missed 08-30.
> Pay 300 → walk gives 4, 🔥 shows 4. `lastQualifiedDay` is still `'2026-08-29'`. Send one message:
> `nextStreak(4, '2026-08-29', '2026-08-31')` → not consecutive → **returns 1**. The streak
> collapses 4 → 1 and the 300 tokens bought nothing. With a banked freeze it is worse:
> `missedExactlyOne` is true, so a **freeze is also burned** to bridge a day already paid for.

**Fix at `wallet.ts:327-331`** — carry `'streak.lastQualifiedDay'` in the same `$set` (the max of
the existing value and the newest day in the walked run).

Two adjacent defects, same block, worth taking together:
- The `$set` filter is bare `{ _id: userId }` while `current` came from a read at :248, three awaits
  earlier — a concurrent message can be clobbered downward
- `repairDay` pays no `streakMilestoneBonus`, so buying 6→7 days silently skips the 50-token
  milestone that `streak.ts:117-124` is the only writer of

Tests miss it because `tokens.test.ts:495-531` asserts `streak.current` after a repair but never
`lastQualifiedDay`, and **no test sends a message after a repair**. Add that test.

### The price (PR12)

`TOKEN_RULES.sinks.dayRepair: 300` — `packages/shared/src/token.ts:242`, with neighbours
`dayRepairMaxAgeDays: 14`, `dayRepairPerMonth: 2`. **One line.** Every consumer reads the constant;
`300` appears as a literal nowhere else. Note the doc comment at :138-145 explains it is deliberately
dearer than the 200-token freeze — keep that relationship when raising it, and mirror the change into
`website/` and `docs/` if the number appears there (`REPO_MAP.md` → *Links between repos*).

Also worth knowing: `dayRepair` is **not in the token store** (`storeOffers.ts:80-100` builds only
`streakFreeze`, `streakRestore` and cosmetics). It is purchasable only by tapping an amber square in
`ActivityMap`.

---

## 9a. Getting out of search (PR15) — the dismiss is in the wrong place

Reported as "after you tap search, the close button is very hard to find." It is, and the reasons
are measurable rather than a matter of taste:

- **It is the smallest dismiss control in the app.** `discover.tsx:184-196` is a bare 22px glyph
  with `hitSlop={8}` — about 38×38. Every back arrow in the app (`ScreenHeader.tsx:31-41`,
  `chat/[id].tsx:509`, `profile/[handle].tsx:181`) is a 30×30 box with `hitSlop={12}`, about 54×54.
- **It is the interior of a two-icon cluster.** The ✕ sits immediately left of the sliders/filters
  icon, same size, same colour, same style — so the dismiss and an unrelated navigation action are
  neighbours that look alike.
- **Its position is not even stable.** The `pair` badge carries `marginStart: 'auto'`
  (`discover.tsx:407`), which is what pushes the icons right. A user with no language pair set
  renders no badge, the auto margin disappears, and both icons jump left against the title.
- **It lies to screen readers.** `accessibilityLabel` is hard-wired to
  `t('discover.searchHandles')` in both states, so the ✕ announces itself as "Search by username".
- It is also a long way from where the eye and thumb are, which is the caret in the field below.

**The fix — take the user's second option, and split the two meanings that are currently one
button:**

| Affordance | Where | Means |
|---|---|---|
| `arrow-left`, 30×30, `hitSlop={12}` | **leading edge of the search row**, replacing the decorative non-pressable magnifier at `discover.tsx:216` | leave search |
| `x`, `hitSlop={10}` | **trailing edge of the same row**, only while `term` is non-empty | clear the text, stay in search |
| header magnifier | unchanged when closed, **hidden while searching** | enter search |

That puts the dismiss inside the search field, one row down from where it is now and directly
beside the caret, at house-standard back-button geometry — and it removes the ✕ from the header
entirely, so the two-icon confusion goes with it.

Reuse rather than invent:

- **`common.backPlain`** (`'Back'`) already exists and is exactly what every other back arrow uses.
  **No new i18n key for the back button.**
- The in-field ✕ needs a `common.clear` — this is the one new key, ×8 locales.
- `FormField.tsx:66-77` is the only in-field trailing affordance in the codebase (the password
  eye). Copy its shape: `accessibilityRole="button"`, a **state-dependent** `accessibilityLabel`,
  `accessibilityState`, `hitSlop={10}`, 18px `colors.textMuted`. Note its comment on using `end`
  rather than `right` for RTL — `searchRow` is a flex row, so the ✕ is simply a third flex child
  after the `flex: 1` input and needs no absolute positioning at all.
- **Fix `styles.searchRow` first.** It is applied both to the input container (`:215`) and to every
  result row (`:238`), so results currently render as pills wearing the input's background, pill
  radius and `marginTop: spacing.md`. Split into `searchField` and `resultRow` before touching any
  padding, or every geometry change leaks into the list. This split is needed by PR16 anyway.

While in there, two free correctness wins: give the toggle a state-dependent label, and clear
`term` on dismiss from *both* paths (today only the header toggle clears it, at `:190`).

Deliberately **not** in scope: `router.back()` / `goBackTo()`. `backHref.ts` documents that every
`(app)` screen is a `Tabs.Screen` with `href: null`, so `back()` resets to the first tab and
`canGoBack()` returns `true` while doing it. Discover is a tab root; search is state, not a route.
The arrow must be `setSearching(false); setTerm('')` and nothing more. An Android `BackHandler` to
close search is a genuine gap but a separate, optional addition — nothing registers one today.

---

## 9b. People search on the Chats tab (PR16)

**Most of this already exists.** Commit `2ab906cd` shipped handle search: `GET /discovery/handles`
(`routes/discovery.ts:23-33`, `requireAuth`, own 60/min rate limit),
`modules/discovery/handleSearch.ts` (anchored `^prefix` regex riding `handle_unique`, limit 10,
excludes self + blocks + `discoverable: false` + deleted), `useHandleSearch`
(`queries.ts:498-506`), and `useDebounced` (300ms).

Work needed:

1. **Extract the search UI from `discover.tsx` into a component** — it is ~45 lines of JSX plus 8
   style rules hardcoded at `discover.tsx:184-257, 410-431`. There is no reusable search component
   today. PR15 has already split `searchRow` into `searchField`/`resultRow` and moved the dismiss
   into the field, so this PR extracts the fixed version rather than inheriting the bug.
2. Mount it in `chats.tsx` — either as a third element in `styles.titleRow` (:59-69, mirroring
   discover's magnifier toggle) or a new `View` below it
3. **It is already free** — `requireAuth`, no tier check. Nothing to do
4. **The privacy opt-out already exists and is enforced**: `settings.discoverable: false` excludes
   someone from handle search (`handleSearch.ts:54`, pinned by `discovery.test.ts:789-797`), and the
   Settings toggle is at `settings.tsx:226-238`. **Decision needed (Q5):** reuse `discoverable`, or
   add a separate "findable by name" boolean? If reusing, the copy is Discover-specific today
   (`settings.showInDiscoverBody: 'Turn this off and nobody will find you in Discover.'`) and needs
   rewording across eight locales
5. Optional: display-name search. It has **no index** — `{ displayName: 'text', bio: 'text' }` exists
   and is queried by nothing, and `$text` cannot prefix-match ("beh" would not find "Behic"). It
   needs a folded `displayNameKey` field mirroring the existing `cityKey` pattern. **Out of scope
   unless asked** — handle prefix search is what ships
6. `HandleSearchResult` has no `isOnline`, so a result row cannot draw a presence dot without
   widening the DTO

---

## 10. Swipe actions on chat rows (PR17)

### What exists

**Star and pin are both per-MESSAGE, not per-conversation.** `Message.starredBy?: string[]` with
`GET /me/starred` and the `starred.tsx` screen; `Conversation.pinned` holds **one messageId** —
it pins a message *inside* a thread, not the thread to the top of the list. **Archive, mute and
delete-conversation do not exist at all** (zero hits repo-wide).

So `archive` / `delete` / `star` / `pin` at the *conversation* level are four new features, not four
new gestures on existing ones. Scope this explicitly.

### Storage

Follow `unread: Record<string, number>` — the only per-participant precedent on the conversation
document. But note: **`GET /conversations` ships raw documents** (`routes/messages.ts:25-27`, no
`toConversationView` mapper, unlike messages which have `toMessageView` stripping `starredBy`). Add a
mapper or a projection, or you ship the other person's archive state to the client.

- **Archive** = a filter clause in `listConversations` — cheap, `participants_recent` still usable,
  keyset stays correct
- **Pin-to-top** = a sort change, and a `pinned` key ahead of `lastMessage.createdAt` **breaks the
  `decodeDateIdCursor` keyset** exactly as `onlineBucket` did for discovery (documented at length in
  `2ab906cd`: `sort=active` paging returned `400 Cursor has expired`). Given a handful of pins,
  fetch them separately and prepend; leave the keyset alone
- `src/lib/conversationCache.ts`'s `moveToHead` assumes "newest activity = top" and would yank a
  pinned row

### Gestures — the constraint that shapes this

- **`react-native-gesture-handler` is NOT a dependency.** It exists only as a transitive peer of
  expo-router's drawer, so under pnpm's isolated layout the app cannot import it without adding it
  directly **plus a fresh native build**. `GestureHandlerRootView` is mounted nowhere
- **`react-native-reanimated` 4.5.1 is installed but imported by nothing**, and `ui/Skeleton.tsx:7-15`
  states the house rule: reaching for it "would put its worklets bundle into the shipped web build".
  Use RN's `Animated`
- **The precedent is right there and is directly reusable**: `src/lib/swipeToReply.ts` — pure,
  tested, with `SWIPE_ACTIVATE_PX`, `SWIPE_MAX_PX`, `SWIPE_LOCK_PX`, `RUBBER`, `HORIZONTAL_BIAS`,
  plus `MessageBubble.tsx:112-131`'s `PanResponder` wiring (`onStartShouldSetPanResponder: () => false`
  so tap and long-press survive; `onPanResponderTerminationRequest: () => true` so the list wins
  mid-scroll). Its comment even notes it is "rightwards only… leaves the other direction free"
- **Web:** `swipeToReplyEnabled(platform, hasTouch)` already encodes the rule — native always, web
  only with a touch pointer, because a mouse drag fights the browser's text selection. **A desktop
  user must get a real alternative**: `chats.tsx`'s `renderItem` has `onPress` only, so a chat-row
  long-press/overflow menu has to be built alongside the gesture. `messageActions.ts:66-71` makes
  exactly this argument for Reply
- New vs `MessageBubble`: a row that **stays open** needs a shared "currently open row id" — the
  bubble always springs back, so there is no precedent

---

## 11. Big single-emoji messages (PR14)

- **No emoji-detection helper exists anywhere.** Write `src/lib/singleEmoji.ts` — pure, no
  `react-native` in its import graph, so `vitest.config.ts` covers it. Must handle ZWJ sequences,
  skin-tone modifiers and variation selectors, not just `\p{Emoji}` (which matches digits)
- **A plain tap on a bubble currently does nothing** — every `Pressable` in `MessageBubble.tsx`
  (:214, :229, :283, :308) has `onLongPress` and no `onPress`. So a tap handler is free of
  collisions, and the `PanResponder` returns `false` from `onStartShouldSetPanResponder` precisely so
  tap and long-press survive
- New branch in `MessageBubble.tsx` between `:304` and `:306` (after media, before text), still
  returning through `shell(...)` so swipe-to-reply and menu anchoring keep working. Drop the bubble
  chrome; `MessageMeta` draws no background of its own and works standalone underneath
- Size: `IntroCarousel`'s hero emoji is 64, `AppGate`'s 48 — **48–64 is the house range**. Bubble
  text is 16
- Animation: **RN `Animated`, not Reanimated.** `ui/Button.tsx:35-45`'s `Animated.spring` scale on
  press is the exact precedent, `useNativeDriver: true`, works on react-native-web
- Two details: `MessageBubble` is `memo`'d and its doc comment says the memo is load-bearing (the
  screen re-renders on every composer keystroke) — a new `onTap` prop **must** be a `useCallback` at
  the call site. And `MessageMenuHost.tsx:200-203` draws its own copy of the bubble as plain `Text`,
  so it needs a flag to render the preview large too
- `endsGroup` (`messageGroups.ts:108-113`) is sender/type/day based and would still give a chrome-less
  emoji a tail — drop it in the new branch

---

## 12. In-app tips (PR13)

No hint/tip/coach-mark system exists; `dismiss` appears only on transient overlays and there is no
"don't show again" mechanism anywhere.

- **Reuse `ui/Callout.tsx`** (57 lines, currently rendered nowhere — a dead-but-designed primitive),
  extended with `onDismiss`. **Use `tone="warning"`** — its doc comment declares the tones semantic:
  `info` belongs to Copilot, `success` to corrections, "neither may borrow the other's colour to
  look nice." `warning` is the unclaimed one
- **Per-tip suppression → one JSON blob in `localFlags`.** `FlagKey` is a union of four literal
  values, so `tipSeen:${id}` cannot be passed. `readJsonFlag`/`writeJsonFlag` already exist
  (`localFlags.ts:95-112`) — add a fifth key holding `Record<tipId, true>`
- **The global toggle defaults ON, which is a trap:** `setBoolFlag` writes `'1'` or **clears**, and
  `readBoolFlag` cannot tell "never set" from "explicitly off". Either store the inverse
  (`tipsSuppressed`) or use `readFlag` with explicit `'0'`/`'1'`, which is what
  `ThemeProvider`/`I18nProvider` do for their three-state preferences
- **The toggle belongs in `localFlags`, not `profile.settings`** — Settings states this rule twice
  (`:357-360`, `:361-367`): presentation preferences are device-local like theme and locale, because
  a shared tablet should not inherit someone else's. It also then works signed-out, which
  `profile.settings` does not. Copy `ThemeProvider.tsx:60-80`'s hook shape verbatim
- **Where they appear:** `src/lib/listState.ts` is the single decision point for "the user is
  waiting" (`'skeleton' | 'empty' | 'content'`, used by chat, chats, discover, feed). Hook the tip
  slot off `state === 'skeleton'`. The genuinely long waits are the paywall's offer fetch
  (`paywall.tsx:352`), app boot (`_layout.tsx:114`) and first thread/discover load
- **Tip text must be `MessageKey`s, not inlined strings** — `IntroCarousel.tsx:23-28` records why: a
  module-scope constant is fixed at import time and stays English after a language change
- The ✕ + "don't show again" checkbox reuses the `Checkbox` primitive from PR9

---

## 13. Offline and the message that vanishes (PR18–20)

**There is no offline awareness anywhere in `apps/mobile`.** No NetInfo, no `navigator.onLine`, no
`onlineManager` wiring, no outbox, no pending/failed concept, no idempotency key. What follows is
ordered so the first PR alone stops the data loss.

### PR18 — the wedge and the silence

Two defects in the same twenty lines, and together they are the worst thing in this document.

1. **`emitWithAck` (`src/lib/socket.ts:44-60`) sets no ack timeout.** It calls a bare
   `s.emit(event, payload, cb)`. In socket.io-client 4.8.3, `_registerAckCallback` with no timeout
   registers the handler with **no timer at all**, and `_clearAcks()` on close only invokes handlers
   whose `withError` is set — which only `.timeout()` sets. So if the connection dies after the
   frame goes out but before the ack returns, **the promise never settles**. `finally { setSending(false) }`
   never runs, `sending` stays `true`, and the send button is disabled forever. The server sets no
   `pingInterval`/`pingTimeout` (`ws/index.ts:90-95`), so the window is up to ~45s of a dead radio
   while `socket.connected` is still `true`.
   → `socket.timeout(ms).emit(...)`, with the timeout a shared constant.
2. **`send()` (`chat/[id].tsx:225-267`) is `try/finally` with no `catch`,** and both call sites are
   `void send()` — so a rejection is an unhandled promise rejection and there is no global handler.
   **A failed text send shows the user nothing.** Its own siblings already do better: `emit()`
   (`:382-389`) and `sendMedia()` (`:189-198`) both catch. Text send is the only path that does not.

**What was asked for on top: the un-sent message must be visible as un-sent, and retryable.** That
needs a send-state row, which does not exist today — `messageCache.ts` has no `pending`/`failed`/
`tempId` concept and every mutator keys on `String(a._id) === String(b._id)`, a server ObjectId.
So:

- a client-minted `clientId` and `status: 'sending' | 'failed'` on the row;
- injected by `messagesNewestFirst` (`messageCache.ts:73-79`) ahead of server rows, so the existing
  read stays the only sanctioned one;
- reconciled away when the server's `message:new` echo arrives (`useSocket.ts:46-63`) — note
  `messageCache.ts:29-30` carries a **stale comment** claiming the sender already appends
  optimistically, which is no longer true; fix it while there;
- the failed marker belongs beside the tick glyphs in `MessageMeta.tsx`, and tapping it retries.

New `errors.offline` / retry keys ×8 — the `errors.*` namespace (`en.ts:173-186`) has no network key
at all. Note the house rule in `toast.ts`: *something that worked gets a toast, something that failed
gets an alert.* A failed row is neither; it is state on the message, which is why it goes there.

### PR19 — connectivity, and a live fork between the two builds

- **`expo-network` (`~57.0.1`) is already a dependency and imported by nothing.** Zero-install
  connectivity source, and it works on web. Nothing else needs adding.
- **`onlineManager` is never wired**, and `@tanstack/query-core` only binds listeners when
  `window.addEventListener` exists. React Native defines none. So on **native** `isOnline()` is
  permanently `true` and `networkMode: 'online'` degenerates to `'always'` — queries burn three
  attempts against a dead radio and land in `isError` with no message; on **web** it tracks
  `navigator.onLine` and *pauses* instead. **Two different behaviours from one codebase, untested.**
  Wire `onlineManager.setEventListener` in `app/_layout.tsx:28-42` and set `networkMode` explicitly
  on queries *and* mutations.
- The retry predicate (`_layout.tsx:36`) branches on `ApiRequestError`, but a network failure is a
  bare `TypeError` from `fetch` — `apiFetch.ts` has no try/catch, no `AbortSignal`, no timeout. It
  falls to `failureCount < 2` and is therefore correct *by accident*. Give it a real error type.

### PR20 — the persisted outbox

Larger, and deliberately last.

- **`clientId` on `sendTextMessageSchema` + a sparse-unique `{ clientId: 1 }` index on `messages`**,
  mirroring `legacy_id_unique` (`db/indexes.ts:206`) — without it every retry double-posts. This is
  the repo's own written doctrine: `decisions.md:1376-1386` and `learn-module.md:155-161`,
  *"idempotency by index, not by the handler remembering to check"*. Chat is the one write path that
  never got it.
- Model the queue on `useOnboardingDraft` — module store outside React, `writeJsonFlag`, debounced,
  never write before hydrate. **But two caveats that make this a real project, not a detail:**
  `localFlags` swallows every write error by design (*"a nicety lost, never a failure worth
  surfacing"*), which is the wrong contract for a queue; and `expo-secure-store` is Keychain-backed
  and warns above ~2KB — the wrong size class. `docs/learn-module.md:57-61` already flags local
  persistence as *"a new dependency and a new failure mode, not a detail."*
- **Pace the drain.** `ws/rateLimit.ts` gives `message:send` `{ capacity: 20, refillPerSecond: 1 }`,
  so a queue of more than 20 starts getting `RATE_LIMITED` acks. Treat that as retryable-with-delay,
  never as permanent failure.
- Keep the queue a **pure state machine** in `src/lib/outbox.ts` (`enqueue` / `markSent` /
  `markFailed` / `nextDue`) with a thin hook on top. `vitest.config.ts` only sees `src/lib/**` and
  `src/i18n/**`, so the same logic inside the chat screen would never be tested.

Other surfaces, for the record: the feed composer, `profile/[handle].tsx`'s first message and
`edit-profile.tsx` all *keep* their typed input on failure and all show something. Chat is the only
one that fails invisibly, and the only one that can wedge.

---

## 14. Streak history (PR21)

Tapping 🔥 opens a per-day history: when each check-in happened, which days were missed, and the
same buy-back the activity map already offers.

**`StatTile` already supports `onPress` (`StatTile.tsx:10`) — no component change.** Follow the
wallet tile at `me.tsx:130-134`, which appends a literal ` ›` because "a number nobody can act on
reads as decoration". Make `me.tsx:121` tappable.

### The check-in time does not exist anywhere

`streakDays` is `{ _id, userId, day, source, actions }` — no `createdAt`, no `firstAt`, nothing with
a clock. `recordStreakDay` (`streakDays.ts:47-61`) does not even take a `Date`. `dailyActivity` has
only an `updatedAt` that every later action overwrites, and it is bucketed by **UTC** day while the
streak day is the user's **local** one.

- Give `recordStreakDay` an `at` and write `$setOnInsert: { firstAt: at }` — `$setOnInsert` is
  exactly "the first qualifying action of the day". The caller `streak.ts:73` already holds `at`.
- **`repairDay` must not set it** (`wallet.ts:305-317`): a bought day has `actions: 0` and no
  check-in, and stamping one would be a lie the screen then tells. Show it as bought instead.
- Days before the deploy honestly say **time unknown**. No migration, no backfill.

### The rest

- Route `app/(app)/streak.tsx` + one `<Tabs.Screen name="streak" options={FULL_SCREEN} />` line in
  `(app)/_layout.tsx`. **`'streak'` must go into `ROUTE_RESERVED`** or `routeLiterals.test.ts:338-354`
  fails — it matches `HANDLE_PATTERN`, so it would otherwise shadow a real user.
- Reuse verbatim, do not re-derive: `repairEffect` (`activityMap.ts:93-111`) and the whole confirm
  flow at `ActivityMap.tsx:79-132`, whose docstring records the intent — the dialog must say what
  the purchase does *before* it happens, **including when the answer is "nothing much"**. Every
  `activity.*` i18n key for that dialog already exists.
- Give the new query a key **under `['activity']`**, or `useRepairDay`'s invalidation
  (`queries.ts:410-412`) will not reach it. It also does not invalidate `keys.me` or
  `['profileActivity']` — extend it if the screen shows a streak sourced from `useMe`.
- **Clamp the range server-side.** `activityRangeSchema` has no span or ordering check and
  `routes/activity.ts:33-35` passes `from`/`to` straight through — while `ActivityMap.tsx:39` already
  claims "the server clamps the range". Make the comment true.
- Privacy: gate a foreign profile's history on `activityMapVisible`, and only make the tile tappable
  when `usePublicActivity().data?.visible === true`. The public endpoint strips `source`
  (`activity.ts:113-115`) so a stranger cannot see which days were bought — keep that. Note
  `settings.activityMapBody` currently promises *"Your streak stays visible either way"*, which needs
  rewording if the history is reachable from someone else's profile.
- New keys ×8: a title, a missed-day label, `Checked in at {time}`, an unknown-time fallback, a
  bought-day marker. Time formatting precedent: `MessageMeta.tsx:14`, `toLocaleTimeString(locale,
  { hour: '2-digit', minute: '2-digit' })` using the **app** locale, not the device's.

---

## 15. Correction history (PR22)

Tapping the corrections tile opens the list behind the number.

**The number already means the right thing.** `me.tsx:122-126` reads
`summary.lifetime.corrections` → `countCorrectionsWritten` (`modules/tokens/corrections.ts`) =
chat corrections + post corrections, lifetime, counting *acts* rather than ledger awards. That is
exactly the list to show, so the tile and the screen cannot disagree.

- **Template: `GET /me/starred`** (`routes/messages.ts:66-73` + `app/(app)/starred.tsx`) — the only
  other cross-conversation list, and its doc comment explains why it hangs off `/me`. **Do not copy
  its paging**, though: starred is a flat capped list because "a bookmark list people actually keep
  is tens of items". A corrections history grows without bound — use `listPostCorrections`'s
  `decodeDateIdCursor` keyset instead (`feed.ts:461-527`).
- **Two sources, one list.** Chat corrections carry their own `original` snapshot
  (`correction: { targetMessageId, original, corrected, note? }`); `postCorrections` **does not** —
  the original is the post's `body` on a different document. The post half must therefore carry the
  post alongside, or the row has nothing to diff against.
- **A new index is required.** `sender_type` `{senderId, type}` gives the exact filter but carries no
  `createdAt`, so newest-first is an in-memory sort of every correction the user ever wrote — fine
  for the `countDocuments` it was built for, wrong for a paged list. Add
  `{ senderId: 1, type: 1, createdAt: -1, _id: -1 }` in `db/indexes.ts` under a **new name**
  (widening a live index raises `IndexOptionsConflict`). `author_recent` covers the post half but
  has no `_id` tiebreak for a keyset.
- **"Corrections I received" is not queryable and is out of scope.** Nothing stores the corrected
  person's id: a chat correction points only at `targetMessageId`, a post correction only at
  `postId`. Answering it needs a new field, not a new query.
- **Rendering: reuse `foldCorrection`** (`feedCache.ts:114+` → `FoldRun[]`), the one-line folded diff
  already used by the feed panel and `post/[id].tsx` — its comment says the chat bubble has room for
  two lines and a row does not. `diffCorrection` is the two-line bubble variant. Do **not** reuse
  `MessageBubble` itself; its `shell()` carries the swipe-to-reply gesture.
- Server DTO needs nothing new for the chat half — `toMessageView` already ships the full
  `correction` object. The client `MessageDto` drops `targetMessageId`; add it if the row links back.
- Route: `corrections` matches `HANDLE_PATTERN` so it must be reserved, or use a hyphenated segment
  (`edit-profile` is the precedent). Nothing in the `corrections.*` i18n namespace exists yet.

---

## Definition of done

Not per PR — the whole body of work is finished when all six hold.

1. **Every PR merged to `origin/main`**, `langx/` merging by rebase (`docs`/`langx` rebase,
   `website` takes a merge commit — see the repo's merge conventions).
2. **CI green** — `typecheck`, `lint`, `format:check`, tests. All four gate.
3. **API deployed to `api2.langx.io`** — `flyctl deploy`, app `langx-api`. `FLY_API_TOKEN` is in
   `langx/.env`; `flyctl` is at `/root/.fly/bin`.
4. **Web deployed to `app2.langx.io`** — `pnpm build:web`, then
   `wrangler pages deploy dist --project-name langx-web`. A push does **not** publish; this is a
   manual step. `CLOUDFLARE_API_TOKEN`, same `.env`.
5. **New indexes applied at boot** via `ensureIndexes` — this work adds at least the corrections
   index and, with PR20, the sparse-unique `clientId`. Any migration script is **dry-run first**,
   then re-run with `--apply`.
6. **Cleanup** — merged branches deleted locally *and* on the remote; temporary worktrees removed
   with `git worktree remove` (including `wt-activity`); the hand-kept mirrors `REPO_MAP.md` lists
   (`docs/`, `website/`, `token-website/`) updated. Nothing checks these mirrors, so a plan-limit or
   token-rule change that skips them silently makes the site lie.

> **Note on 3 and 4:** `app2.langx.io` reads the **production** database, and
> `app2.langx.io/<handle>` currently returns HTTP 404 while still rendering (Expo static export on
> Cloudflare Pages). Do not try to fix that with a `_redirects` rewrite — it turns into a 308 that
> shadows `/discover` and `/settings` before assets are matched. It needs a Pages Function, and it
> is not part of this work.

---

## Blocking questions

1. **`incognito` grandfathering.** `profileViews.ts:57` re-checks the tier at the *write of a view*,
   unlike `hideOnlineStatus`, which is now free anyway and which `presenceVisibility.ts` never
   re-checked. So the
   moment PR2 deploys, **every Fluent subscriber with `privacy.incognito: true` starts leaving
   profile-view records again, silently, with the toggle still showing on.** That is exactly the
   failure `presenceVisibility.ts`'s comment forbids, arriving through the other door.
   *Recommended:* ship a one-off script with PR2 setting `privacy.incognito: false` for every
   effective-`pro` profile, and notify them. An honest "this is no longer in your plan" beats a
   toggle that lies. **Blocks PR2.**
2. **Live RevenueCat subscriber count.** If non-zero, PR2 takes three features off paying customers
   and becomes a promise change under `docs/legal/promise-change.md`. **Blocks PR2.**
3. **Guest age gate.** `onboardingProfileSchema` enforces 18+ via `birthDate`; a guest supplies none.
   *Recommended:* state 18+ on the welcome screen and collect `birthDate` at real onboarding as
   today — a guest cannot talk to anyone, which is what the gate protects. Touches the Play "target
   audience" declaration `architecture.md` already flags as unresolved. **Blocks PR24.**
4. **Translation numbers** — confirm 300 / 1000. One line in `PLAN_LIMITS`; the paywall copy
   interpolates `{count}` from the table, so confirming late is cheap.
5. **Chat search opt-out** — reuse `settings.discoverable`, or a separate "findable by name" boolean?
6. **New streak repair price** — currently 300, must stay above the 200 freeze.
7. **Conversation archive/pin scope** — none of the four swipe actions exist at the conversation
   level today. Confirm all four are wanted, or trim.

---

## Verification

```bash
# MongoDB must be a replica set — a standalone mongod fails on the first sign-up
pnpm dev                                                    # API :4000, Expo :8081
pnpm test && pnpm -r typecheck && pnpm lint && pnpm format:check   # all four gate CI
```

**Guest walkthrough (the one that matters):** clear SecureStore/localStorage → welcome → *Continue
as guest* → 1 native + 1 learning + a level → discover shows real people → tap Message → **auth
screen, not an error** → register → click the verification link from the API log → onboarding opens
on **about-you with languages already filled in** → complete → discover. Then check
`db.profiles.countDocuments({guest:true})`, that the guest never appears in a second account's
discovery, that `tokenLedger` has exactly one `signupBonus` for the new id, and that RevenueCat has
no customer for the guest id.

**Tiers:** `REVENUECAT_FAKE_STORE=1` + `POST /billing/test-event` to move between tiers
(`docs/billing-testing.md`). Verify: incognito and hide-online disabled with a POLYGLOT tag on
Fluent; gender and city filters open on Fluent; who-viewed-you returns `locked: true` with a real
total on Fluent; a Fluent user refused a 3rd learning language **while a grandfathered 5-language
profile can still save a level edit**.

**Streak repair — the regression test that does not exist today:** repair a gap, then **send a
message**, then assert the streak did not collapse and no freeze was consumed.

**Presence:** two accounts, two browsers. Send a message, watch the dot and "online" in both the chat
header and the profile hero; close one; confirm the other flips to "last seen …" within
`ONLINE_WINDOW_MS` **on its own**, from the client-side `isOnlineAt` recompute, with no refetch.
Then walk the whole ladder by seeding `stats.lastActiveAt` directly — minutes, hours, days, months,
years — and check the plural forms in Russian and Arabic, which are exactly where a ternary would
have been wrong. Finally set `privacy.hideOnlineStatus` on a **free** account and confirm both the
dot and the last-seen line vanish for a viewer, and that the toggle carries no PRO tag.

**Activity map:** load Me in a browser window wider than 720px and confirm the grid fills the content
box; then between 00:00 and 03:00 local (or with a faked timezone) confirm the weekly chart's last
bar and the map's `today` refer to the same day.

**Offline — the test that matters, and DevTools cannot do it.** Chrome's *Offline* preset kills the
websocket cleanly, which only exercises the easy path (emit while known-disconnected → socket.io's
`sendBuffer`). The nasty path needs the connection to die **without a close frame**: kill the API
process mid-send, or black-hole packets with a proxy. Expect ~45s before socket.io's ping timeout
notices. Assert: the send button does **not** wedge, the message appears as failed rather than
vanishing, tapping it retries, and after PR20 the retry does **not** double-post (check
`db.messages.countDocuments({ clientId })` is 1). Then repeat on native and on web — the two builds
disagree about `onlineManager` today and must agree after PR19.

**Streak history:** check in today, open the screen, confirm the time shown matches when the first
message was actually sent. Then confirm a day from before the deploy says *time unknown* rather than
inventing one, and that a **bought** day shows as bought with no time at all. Buy a gap back from
this screen and confirm the same confirm-dialog copy appears as on the activity map.

**Correction history:** write one chat correction and one post correction, then open the screen and
confirm both appear, newest first, and that paging past the first page does not repeat or skip a
row. Confirm the count on the tile equals the number of rows.

**Search dismiss:** open discover, tap the magnifier, and confirm the way out is the arrow at the
left of the field and not a glyph in the header. Type two letters and confirm a ✕ appears at the
trailing edge that clears the text *without* leaving search. Then repeat as a user with **no
language pair set** — that is the case where the old header icons jump position — and with a screen
reader, where the control must announce "Back" rather than "Search by username".

**Web-specific:** swipe actions and tap-to-replay must be exercised in a desktop browser *with a
mouse* — the desktop fallback (row menu) is the deliverable there, not the gesture.

### Docs to update in the same PRs

`docs/architecture.md`'s Free/Pro/Pro+ table and its "Pro bundle"/"Pro+ bundle" rows, and
`decisions.md`'s "A third tier…" entry, all become false in PR2. `docs/store/privacy-data-safety.md`
if guests change what is collected before consent. Per `REPO_MAP.md`, a plan-limit or token-rule
change also has hand-kept copies in `website/src/lib/data/` and `docs/` — nothing checks these.
