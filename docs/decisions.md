# Decision log

What was built, in what order, and every place implementation contradicted the
plan. The design itself is in [`architecture.md`](./architecture.md).

Each note exists because someone later will look at the code and wonder why it
is shaped that way. Several of them record a plan that turned out to be wrong.

## Phases

| #   | Output                                                                                                                             | Done when                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Play signing key check · monorepo, `shared`, TS/lint/CI, Atlas, `ensureIndexes()`, `/health`, `.env.example`, BSD-3 + CONTRIBUTING | **Done** — `pnpm dev` brings up API + iOS + web together                                                                                                                                                                                                         |
| 1   | Better Auth (server + Expo client + `apiFetch`) — email/password + Google + Apple                                                  | **Done**, verified end to end in a real browser: sign-up → email link → session → sign-out → sign-in. Google/Apple not tested with real credentials                                                                                                              |
| 2   | The ETL's **reservation step** + `profiles` + onboarding + username claim + avatar upload                                          | **Done** — 14 API tests; ETL dry run against real Appwrite data (3479 profiles → 3401 reservation candidates)                                                                                                                                                    |
| 3   | Discovery aggregation + list + free filters                                                                                        | **Done** — 20 tests; `explain('executionStats')` confirms IXSCAN, no COLLSCAN. Distance/city deliberately deferred (see note)                                                                                                                                    |
| 4   | Starting a conversation: `POST /conversations` — no match gate, quota decrement + `pairKey` lock                                   | **Done** — 11 tests: 10 concurrent first-message attempts on free → exactly 5 succeed; 10/10 on Pro; a second conversation for the same pair is refused with `CONVERSATION_EXISTS`                                                                               |
| 5   | Chat: Socket.io over phase 4's conversations + history + read/typing + corrections                                                 | **Done** — 15 tests (5 REST + 10 real Socket.io connections): message delivery between two live WebSockets measured **under 1s**; history survives a disconnect                                                                                                  |
| 6   | Translation service + cache + daily counters                                                                                       | **Done** — 11 tests: second request for the same text is served from cache, free tier hits `QUOTA_EXCEEDED` after 20, cache hits cost no quota                                                                                                                   |
| 7   | RevenueCat + paywall + webhook + entitlement + quota + Pro filters                                                                 | **Server done** (11 tests). A real sandbox purchase cannot be tested until the store prerequisites are complete (see note)                                                                                                                                       |
| 8   | Streak + XP ledger + direct awards + `xpAggregates`                                                                                | **Done** — 13 tests: 10 concurrent replays of the same message leave one ledger row; streaks advance and reset on the local day; a milestone pays once                                                                                                           |
| 9   | Daily pool + 4 leaderboards + sinks                                                                                                | **Done** — 18 tests plus live verification: the pool ran twice (once with the lock, once with the lock deleted) and total XP stayed at 1054                                                                                                                      |
| 10  | `profileViews` + incognito, push, block/report, **account deletion + export**                                                      | **Server done** — 18 tests: a blocked user disappears from discovery, the chat list, the leaderboard and their profile (404, not 403) at once; a deleted account is invisible immediately, still recoverable on day 29, and gone from every collection on day 31 |
| —   | **Client screens** — onboarding, discovery, chat, leaderboard, profile, paywall, settings                                          | **Done** — the plan did not list this as a phase, but MVP items 2/3/4/5/12 all depend on it and only phase 1's auth screens existed                                                                                                                              |
| 11  | The ETL's profile + avatar + **gallery** step                                                                                      | **Code done, media step waiting on credentials** — 13 mapping tests; live dry run: 3479 documents → 3150 stageable                                                                                                                                               |
| 12  | EAS build, store identity, web deploy, Sentry, `docs/self-host.md`                                                                 | **What can be done from code is done** — keystore inheritance, EAS credentials and real submission need console access                                                                                                                                           |
| 13  | Promise update + privacy forms + staged rollout                                                                                    | **Copy written, not published** — publishing needs langx.io and console access                                                                                                                                                                                   |

## Phase 1 — the age gate moved to phase 2

The original criterion was "a 17-year-old's sign-up is refused server-side" in
phase 1. That turned out to be architecturally the wrong place: sign-up via
Google or Apple has **no `birthYear` field at all**, so a check inside Better
Auth's own `signUp` step would only ever cover the email/password path. The
right place is where the plan's own "Auth and age gate" section already said —
before `profiles` is written, in phase 2's onboarding, which is the single
choke point for all three sign-up paths.

## Phase 1 — an upstream bug

`@better-auth/mongo-adapter@1.7.1`'s transaction wrapper calls
`abortTransaction()` even when `commitTransaction()` itself failed, and that
second call throws "Cannot call abortTransaction after calling
commitTransaction". It surfaces on the **first write** to a fresh database's
`user`/`account` collections, racing Better Auth's own lazy
`ensureModelIndexes()` — MongoDB's known transient "catalog changes, please
retry", which the adapter does not retry.

Impact: the genuine first sign-up in production could have returned a 500.
`apps/api/src/auth/warmUp.ts` absorbs it at boot with a single throwaway
account, verified against a completely fresh database. Reporting it upstream is
separate work.

## Phase 1 — the `useSession()` + `Stack.Protected` trap

The root layout replaced the whole `<Stack>` with a spinner while `isPending`.
But Better Auth's `useSession()` triggers a background refetch after **every**
auth operation, not just the first load, and that flips `isPending` back to
true. The result: a screen reached by `router.replace()` (`check-email` after
sign-up) vanished during the refetch's unmount/remount and the navigator fell
back to its default route.

Caught in a live browser test. The fix is to show the spinner only before the
**first** resolution and never unmount `<Stack>` on later `isPending` flickers.

## Phase 3 — distance/city filter deliberately deferred

The plan says `$geoNear` must be the pipeline's first stage (a MongoDB
constraint). But discovery's core `$match` filters mutual language fit by
reading two separate array indexes, and both cannot be first — one invalidates
the other. Solving it properly means either combining two pipelines
(`$unionWith`, or two queries and an intersection) or demoting the language
filter when distance is on. That is a real design decision, outside phase 3's
scope, and untestable before Pro entitlement was real. The other Pro filters
are simple `$match` additions and shipped immediately.

## Phase 4 — quota decrement is one atomic `findOneAndUpdate`

Count-then-write overruns the quota under concurrency; the plan predicted that.
The actual solution: the `findOneAndUpdate`'s **filter** uses `$expr` to
recompute the in-window count from the document's current state, and the
**update** prunes and conditionally appends in the same pipeline. Because the
two are one atomic operation, MongoDB's document-level write ordering resolves
the race by itself — no lock, no transaction. Verified with 10 concurrent
requests: exactly `limit` of them come back `consumed: true`.

## Phase 4 — `CONVERSATION_EXISTS` has two layers

`POST /conversations` first does a cheap `pairKey` pre-check, so a client
retrying against an existing conversation is refused without spending quota,
then relies on the real unique index for the genuine race (both sides sending a
first message at the same instant). The loser of that rare race does not get
their quota slot refunded — not worth an extra round-trip on every request.

## Phase 5 — one room per user, not per conversation

Each participant joins only their own `user:<id>` room; there is no "join this
conversation" handshake. A 1-1 chat has exactly two participants, both known
from the conversation document, so a `conversation:<id>` room bought nothing
and added a step the client could forget.

## Phase 5 — socket handshake auth, the same solution as `apiFetch`

A browser attaches the session cookie to the WebSocket handshake
automatically; React Native has no cookie jar, so the client passes the value
through `socket.handshake.auth.cookie` — the `auth` payload, part of the CONNECT
packet, because native cannot set custom headers on this transport. The server
accepts both.

## Phase 5 — `assertConversationAccess` is the single source of truth

Both the REST endpoints and every socket event call the same function:
participant check plus a **live** block check on every call, not just when the
conversation was created. The plan asked for this as "socket events pass
through the same guards".

## Phase 6 — quota logic generalised from phase 4, not rewritten

`consumeInitiationQuota` was written for one bucket. When translation needed
the same atomic `$expr` + pipeline pattern, the function moved to
`lib/quota.ts` as `consumeQuota(db, userId, tier, kind)`. `corrections` is
deliberately not part of that type: it is `null` on both tiers, so there is
nothing to track.

## Phase 6 — a cache hit costs no quota, a miss does

`translateText` checks the cache first and only charges quota on a **miss**. If
two concurrent requests miss on the same new text, both spend a slot and both
call the provider; the second cache write is a silent no-op via `$setOnInsert`.
Same category as phase 4's accepted double-spend race — no lock was added.

## Phase 7 — a real sandbox purchase is not yet possible, deliberately

Phase 7's own prerequisites (paid apps agreement, bank and tax details,
subscription group setup, RevenueCat account) are a business process taking
days, and none of it can be done from code. So the **entire** server side was
written and tested with real code — webhook handling, idempotency, entitlement
updates, `POST /billing/refresh` reconciliation — but the end-to-end "buy in
sandbox → Pro turns on" flow was verified with fake RevenueCat events and a
fake client.

The mobile paywall's SDK integration was deliberately not written either:
without real API keys it would be a skeleton that cannot work, which is worse
than a screen that states the offer honestly and says purchasing is not yet
enabled.

## Phase 7 — `effectiveTier()` closed a real gap in phases 3/4/6

The plan said "if `expiresAt` has passed, the guard refuses", but phases 3, 4
and 6 read `profile.entitlement.tier` directly. A subscription that had expired
without its `EXPIRATION` webhook being processed — webhook delivery is not
guaranteed — would have kept granting Pro indefinitely.
`effectiveTier(profile)` returns `'free'` when `tier === 'pro'` but `expiresAt`
has passed, and all five call sites were redirected to it.

## Phase 7 — webhook idempotency, the same pattern as phases 4 and 6

RevenueCat retries an event until it gets a 2xx. `subscriptions.eventId`'s
unique index is the single source of truth: insert first, and treat a duplicate
key as "already processed". The same "insert first, read the duplicate key as a
meaningful signal" family as phase 4's `pairKey` and phase 2's `handle_unique`.

## Phase 8 — XP caps run on the UTC day; only the streak is local

`XpRules.caps` originally said "local day". That is exploitable. A cap is a
ceiling on ledger rows, and ledger rows sit in UTC day/week/month buckets — if
the cap reset on the local day, moving the clock east would open a second cap
window **inside the same UTC day** and both awards would land in the same
leaderboard bucket. That is precisely the "farm a period twice by flying east"
exploit `periods.ts` warns about.

So: caps and `dailyActivity` are UTC, **only** the streak is local. As a second
line of defence, `updateProfile` rate-limits timezone changes to once every 7
days; writing the same zone is never blocked.

## Phase 8 — ledger first, aggregates second; the order cannot be reversed

`awardXp` does two writes: the `xpLedger` insert, where the unique
`{userId, kind, refId}` index decides atomically and cluster-wide whether this
award has already been paid (a duplicate key is not an error, it is the answer
"yes"), and then the `$inc` on four period aggregates.

A crash between the two leaves an aggregate **under**-counted, recoverable from
the append-only ledger. Crashing in the reverse order would **pay twice** on
retry, which is not recoverable. `amount <= 0` writes nothing at all — a
message that hit its cap should leave no trace, not a row worth zero.

## Phase 8 — the award path is deliberately not swallowed

`awardForSend` runs after the message is written and does not suppress errors.
The only expected failure is a duplicate award, which `awardXp` already answers
with a no-op; everything else means the database is unreachable, in which case
the message insert in front of it would have failed too. Catching silently
would trade a loud, recoverable error for a quiet drift in everyone's balance.

## Phase 8 — the reciprocity bonus pays both sides

There is no separate "mutual" kind in `XP_KINDS`, and adding one would change
the ledger's schema. Instead the `refId` carries a `mutual:` prefix — it cannot
collide with a message id, and the unique index means it is paid once per
person per conversation. The trigger is the **transition** of `bothSpoke`, not
its state, because `bothSpoke` stays true forever once set.

## Phase 8 — `stats.lastActiveAt` was a real gap

Phase 3's discovery reads `stats.lastActiveAt` for its "online" filter and its
`active` sort, but **nothing wrote to it** after onboarding — the filter could
never match anyone. Since sending a message is already the action that
advances the streak, `awardForSend` updates it in the same pass. Not scope
creep: a precondition for the query phase 3 had already written.

## Phase 9 — a self-healing catch-up loop instead of a cron

A cron expression fires at one instant. If the process happens to be down,
restarting or mid-deploy at that instant, the day is never paid and nothing
notices. Instead the scheduler asks a question every 15 minutes: "is there a
closed day with no `jobRuns` row?" A missed window heals on the next tick, a
redeploy costs nothing, running several API instances is safe (the unique
`{job, periodKey}` decides ownership), and a process that was down all weekend
pays those days on its return.

The schedulers start in `index.ts`, not `buildApp`, so tests never have timers
running behind them.

## Phase 9 — two independent double-payment defences, both proven live

1. The `jobRuns` lock: whoever inserts the day owns it; a duplicate key means
   someone else has it.
2. Every award carries `kind: 'dailyPool'` + `refId: <day>`, so even with the
   lock bypassed entirely the ledger's unique index refuses the second payment.

Verified live: first a restart with the lock in place (no work done), then the
lock was **deleted** and the process restarted — the job ran, saw `active: 2`,
wrote `paid: 0`, and total XP stayed at 1054. The lock avoids the work; the
ledger guarantees the outcome.

## Phase 9 — spending does not touch `xpAggregates`

With a single counter, buying a 500 XP frame would drop the buyer down every
leaderboard — engaging with the gamification would penalise you in it. So:
**earned** XP (`xpAggregates`, never decremented, what the table ranks) and
**balance** (`earned − profiles.xpSpent`, what a purchase draws on). Spends are
recorded in the ledger with a negative amount for audit but never touch the
aggregates.

Race safety copies `consumeQuota`: one atomic `findOneAndUpdate` whose filter
re-checks affordability against the document about to be written. `earned` is
read first and passed as a literal, which is safe in exactly one direction and
that is the direction needed — it can only grow while we work, so a stale read
under-states the balance and at worst refuses a purchase the user can retry. It
can never let one through they could not afford.

## Phase 9 — the streak freeze is a real mechanic

A purchased freeze is banked on `profiles.streakFreezes`;
`recordQualifyingAction` spends one to bridge **exactly one** missed day rather
than resetting. Wider gaps are not for sale — a stockpile papering over a week
away would empty the streak of the meaning that brings people back. Banking is
capped at 2. If the streak write loses its race, the spent freeze is refunded:
it bridged nothing.

## Phase 9 — competition ranking, and not by preference

Equal XP shares a rank and the next distinct score skips (1, 2, 2, 4).
Positional ranking (index + 1) would be simpler, but a user outside the page
learns their rank from `countDocuments({xp: {$gt: mine}}) + 1`, and the two
would disagree: two people on the same score would be told different positions
depending on whether they made the page.

## Phase 9 — a deleted account vacates its rank rather than passing it on

A soft-deleted profile keeps its aggregate row (the ledger is append-only) but
does not appear in the table. It still occupies its rank position, so nobody is
promoted by someone else deleting their account.

`getLeaderboard` also reads profile fields defensively: a single document
missing `streak` — an ETL-imported row, a partially written record — could take
a global endpoint to a 500 for every user. A test caught it.

## Phase 9 — the pool under-distributes in a small population, correctly

`maxShareOfPool` is 5%, so distributing the whole pool needs at least 20 active
users; in a live test two users took 500 each from a 10,000 pool. That is what
the first days after launch will look like. The alternative — redistributing
the remainder when the cap binds — would hand a single active user the entire
pool, which is exactly what the cap exists to prevent.

## Phase 10 — blocking goes through one helper

`blockedUserIds(db, viewerId)` returns everyone the viewer must not see (both
directions) in one query, and discovery, the chat list, the leaderboard,
profile viewing and "who viewed me" all go through it. Discovery previously did
this with its own two `distinct` queries. Rewriting the two-sided `$or` at each
call site is how one of them eventually gets it half right and a blocked user
reappears somewhere.

## Phase 10 — a blocked user's profile is 404, not 403

A 403 **confirms the account exists**, which is exactly what blocking must not
do. For the same reason `POST /reports` does not echo `xpFrozen` back: whether
someone else's earning is suspended is not the reporter's business, and telling
them turns the threshold into a game to probe.

## Phase 10 — freezing XP takes three distinct reporters, not three reports

If one person could freeze anyone by reporting them three times, everyone who
politely declined a conversation would be a target.
`distinct('reporterId')` closes that.

Freezing stops the **payout** only: the message still sends and
`dailyActivity` counters still move, so a human clearing the report can
reconcile what was withheld from a history that was never interrupted. (The
first implementation used an early `return` and stopped the counters too — the
comment and the code disagreed, and a test caught it.)

## Phase 10 — two id worlds, a silent trap (`lib/authId.ts`)

Better Auth's collections store ids as **ObjectId**; our domain collections
store the **string** form, because `profiles._id` _is_ the user id and
`xpAggregates`'s `<userId>:<period>` and `dailyActivity`'s `<userId>:<day>` keys
only work with a string `_id`.

The consequence: `deleteMany({ userId: '6a8f...' })` against `session` matches
nothing and **reports success** — a deleted account kept its live session. The
deletion test caught it exactly that way. `authId(userId)` is used at every
boundary.

## Phase 10 — deletion waits 30 days but is immediate as a product

`deletedAt` is written (every listing already filters on it) and sessions and
device tokens are destroyed at once: the account stops being usable
immediately. The data survives 30 days because an irreversible instant wipe
turns one angry tap into permanent loss — the stores require deletion to be
_possible_, not instant.

When the period expires, `purgeExpiredAccounts` removes the user from every
collection — **except messages they sent, which stay in place with their body
cleared.** Deleting them would silently rewrite a conversation the other person
is also a party to. The same reasoning applies to the export: it contains only
the user's **own** messages, because including the other party's would hand one
person a transcript of someone else's words under the banner of data rights.

## Phase 10 — three schedulers, the same shape, none a cron

The pool (15 min), account purge (1 hour) and streak reminder (30 min) all ask
"is there unfinished work?" The purge needs no lock: it is driven by
`deletedAt <= cutoff`, and a purged account no longer matches.

The reminder fires at 20:00 in the user's **local** time (20:00 UTC is 5am in
Tokyo — not a nudge, an alarm clock) and is de-duplicated by an `_id` of
`<userId>:<localDay>` in `streakReminders`. The insert failing on a duplicate
key _is_ the check; there is no read-then-write race.

## Phase 10 — a message push only goes out if the recipient is not connected

If `io.in(userRoom).fetchSockets()` is empty, the notification is sent.
Somebody with the thread open on screen does not need their phone to buzz about
the message they are watching arrive. Best-effort: a failed push never fails
the send, since the message is already durably written and already delivered
over the socket.

## Phase 10 — `GET /profiles/:handleOrId` was missing

MVP item 3 asked for profile viewing and there was no endpoint for it. Since it
is the natural place, the `profileViews` record is written there too.

`toPublicProfile` builds its result by **naming** fields rather than deleting
them: a field added to `Profile` later — a new quota bucket, an internal flag —
is then private by default instead of leaking the first time someone forgets to
add it to a blocklist. `birthYear` becomes an age, because that is what the UI
shows and the exact year is more identifying than the product needs.

## Phase 11 — the mapping was derived from live data, not from v1's source

`scripts/inspect-v1.ts` reads the real documents, because a legacy collection
keeps fields the code stopped writing and loses fields the code still writes.
What it found: `languages[]` is the only real source of language codes (the
other three arrays are denormalized name lists), `level: -1` marks a mother
tongue and learning levels run 0–3, `gender` is mostly lowercase but not always
(one "Male" per 500 documents), and `profilePic`/`otherPics` are Appwrite
**file ids**, not URLs, with 3177 files in the `user` bucket. 100% of profiles
have an avatar, 11% have a gallery.

## Phase 11 — the level mapping is deliberately conservative

v1's top level becomes B2, not C2. An inflated level produces confident
**wrong** matches. A user who really is C1 fixes it in one tap; one wrongly
labelled C2 has to notice first.

## Phase 11 — data is staged in `legacyProfiles`, not written to `profiles`

Appwrite's password hashes cannot be migrated, so every returning user signs up
again and gets a **brand new user id** — until that happens there is nothing to
key a real profile document on. The ETL writes to a staging collection keyed by
the Appwrite document id, and onboarding restores from it when the user claims
their handle, proven by the **same email hash** `handleReservations` uses.

`restoredBy` guarantees it happens once (a conditional update, so two
concurrent onboarding attempts cannot both take it), and a re-run of the ETL
skips records that have been restored — overwriting a profile someone is using
would silently revert every edit they have made since.

## Phase 11 — the streak's length migrates, its currency does not

`legacyStreak` is written to `longest`, but `lastQualifiedDay` stays null and
`current` starts at zero. Carrying the day across would hand back a live streak
nobody earned in v2.

## Phase 11 — media needs `putObject`, and fails loudly without configuration

`StorageProvider` only offered presigned URLs, which is the right shape for
user uploads (they should never pass through our server). The migration is the
opposite case: the bytes are already in this process, from Appwrite's API. With
`STORAGE_*` unset the script **errors** unless `--skip-media` is passed —
migrating 3150 profiles with no pictures and calling it a success would be the
worst outcome. A re-run skips media already copied, so a partial failure costs
only the remainder's bandwidth.

## Phases 12–13 — location must be declared "not collected"

`profiles.location` exists as a GeoJSON field with a 2dsphere index, but
nothing writes it and no query reads it — the distance filter was deferred in
phase 3. Play Data Safety and Apple's Privacy Labels should therefore say
location is **not collected**, and that line must be revisited the day the
filter is written. This is the value of deriving the form from the code: a
template would have said "profile has a location field? yes".

## Phases 12–13 — two store listing claims are now wrong, not merely stale

Voice messages and badges exist in v1 and are not in v2's first release. Left
in the listing they become a feature claim the app does not meet.

The release notes must also say "sign up with your old email and claim your
username": every v1 user has to register again, and without that line the first
thing a returning user meets is a login that rejects them.

## Phases 12–13 — Sentry has PII off and does not report 4xx

`sendDefaultPii: false`, and `beforeSend` strips the request body, cookies and
the authorization header — in an app whose entire content is private
conversations, that default is the most dangerous setting available. Only 5xx
is reported: a refused quota, a blocked user or a taken handle are the system
**working**, and alerting on them trains everyone to ignore the alerts.
`initSentry` runs before `buildApp` so startup failures are reported too.

## Client — StyleSheet instead of NativeWind

The plan named NativeWind v4, but phase 1's screens were written with
StyleSheet and its `Button`/`FormField` are in that idiom. Switching now would
mean rewriting working screens plus a babel/metro change, to buy consistency
with a decision the codebase had already departed from. `src/lib/theme.ts`
provides the shared vocabulary that was the actual point.

## Client — one socket, opened in the tab layout

The server already puts every client in a single per-user room, so a socket per
screen would multiply connections without changing delivery. Incoming messages
are written into the query cache rather than component state, so every screen
reading that data updates — including the ones not currently mounted.

## Client — `app/index.tsx` is a three-way gate

Signed out, signed in **without** a profile, and ready. The middle state is real
and common: Better Auth creates the account, but `profiles` is ours and
onboarding writes it. A 404 from `/profiles/me` is that state, not an error.

## Client — the onboarding draft lives outside React

expo-router remounts a screen when it is navigated back to, so component state
would be lost on "back", and serialising a growing draft through route params
turns the URL into a form encoding. A small store outside React matches the
real lifetime: the draft outlives any one screen and is thrown away on submit.

## Client — `expo-notifications` must be imported lazily

Expo Go dropped remote push on Android in SDK 53, and `expo-notifications`
throws the moment it is imported in that environment. With the import at module
level, the throw took `(app)/_layout.tsx` down with it — expo-router reports
that as "Route ./(app)/_layout.tsx is missing the required default export", so
every signed-in user hit a blank error screen on Android.

The `!Device.isDevice` guard inside the hook never got a chance to run, because
the module died while loading. The import now sits inside the `useEffect`'s
try/catch, after the guards.

## Updates — OTA plus a server-side gate, chosen together

The two were designed as one thing because they answer the same question from
opposite ends: EAS Update gets new code to people quickly, and `minVersion`
handles everyone it has not reached yet. Either alone leaves a gap — OTA with
no gate means old clients silently break against a changed API, and a gate with
no OTA means the only remedy is a store round-trip.

Rejected: a self-hosted update server (correct for the project's open-source
posture, but signing, manifests and rollback are a phase of work on their own,
and EAS Update is already wired to the channels in `eas.json`), and
store-updates-only (an urgent fix would take days and could never reach people
who stop updating).

## Maintenance — two switches on purpose

The database-backed flag is the everyday one: a single write, no redeploy. The
env variable exists for the case the database is what broke, where a
config-read-based gate cannot help. Two mechanisms is a cost, but one of them
covers precisely where the other fails.

`/health` stays open while maintenance is on. Returning 503 there would make
the deploy platform's health check fail and restart the container in a loop —
turning a planned maintenance window into an outage of a different kind.

## The version gate must fail permissive, and a test caught it failing closed

The first implementation parsed an unparseable version as `0.0.0`, which
compares below every minimum — so a malformed or truncated header would have
shown a forced-update screen to someone whose app was fine, with no way out.
`isUpdateRequired` now validates the shape first and returns false for anything
it cannot read. Being wrong in the permissive direction is the only safe way to
be wrong here.

## Client — the three MVP gaps the server had already covered

An audit against the MVP list found three items whose server side was written
and tested but had no screen: profile editing with avatar and gallery upload
(item 3), translation in chat (item 6), and managing who you have blocked
(item 10). Blocking in particular was effectively irreversible — one tap to
block, and no way back, because the profile you would unblock from is exactly
the one you can no longer reach.

The gallery had no API either. `Profile.photos` existed and the ETL populated
it, but nothing could add or remove one. `POST /me/photos` enforces
`PLAN_LIMITS.maxPhotos` inside the update's own filter rather than by reading
the array first — two uploads finishing at once would otherwise both see room
and both append. The cap is the same on both tiers on purpose: a gallery is how
someone shows they are a real person, and gating it would make free profiles
look like the throwaway accounts the product is trying to keep out.

## Client — a form that was always blank, and why

`useState(profile?.displayName ?? '')` runs on the component's _first_ render,
and hooks cannot sit behind an early return — so with the query still pending,
every field initialised to empty and stayed empty once the data arrived. The
edit screen looked correct and silently discarded the user's existing profile
on save.

Caught by looking at a screenshot rather than by a test: the screen rendered,
typechecked and had no runtime error. The fix splits loading from the form so
the form's initialisers only ever run with real data.

## Client — a chip that rendered its own colour on itself

`Chip` styled its read-only branch as a bare `Text` with a separate style
array, which quietly dropped `selected` from the text colour: a filled chip
drew muted blue text on a blue background. Only visible on a screen that
happened to use a selected chip without an `onPress`, which is why it survived
until the profile editor.

Both branches now render the same View + Text structure. Styling a `Text` as
though it were the container is what let them drift apart.

## Reversed — v1 token balances migrate after all

The original decision retired the token _and_ dropped the balances. On
2026-08-27 the owner reversed the second half: balances come across as XP.

Part of the original reasoning turned out to rest on a wrong belief.
`CHECKOUT_COLLECTION` looks like a purchase log and is not one — its fields are
`distribution`, `baseAmount`, `text`, `image`, `audio`, `streak`, `badges`,
`onlineMin`, which is a daily payout broken down by activity. v1's version of
the daily XP pool. There is no Stripe integration and no purchase flow; the
client only lists checkouts. So migrating balances cannot smuggle money-bought
currency into a system whose rule is that XP is never purchasable. That rule
survives the reversal intact.

## Measuring before converting, and what it found

Whether balances _should_ migrate was the owner's call. At what ratio is an
engineering question, and it was worth measuring rather than assuming.

`scripts/inspect-v1-economy.ts` reads the live wallet and streak collections.
1403 wallets hold 6,079,895 tokens: median 20, p90 9,136, p99 37,821, max
2,277,521, with 266 at zero. A very active day in v2 is about 700 XP.

Credited 1:1 to _earned_ XP, that puts the p99 user level with roughly 54
consecutive days of maximum activity, the top account at about nine years, and
injects 608 days of the entire daily pool at once. The all-time and yearly
tables become a permanent v1 ranking.

The recommendation is to credit the spendable **balance** instead of earned XP.
Faz 9 already separated the two on purpose — `xpAggregates` is what the
leaderboard ranks, the balance is what purchases draw on — so the v1 economy
can be honoured exactly (9,136 tokens buy 9,136 XP of spending) and spent on
what the migration wants it spent on (restoring a frozen streak, cosmetics),
without a ranking position nobody can contest. `balance = earned + granted −
spent`, one new component.

Left open in the plan rather than resolved silently: the owner asked for 1:1,
and this is a recommendation against part of it, not a decision already taken.

## Known risks

- **Play signing key.** Narrowed but not closed: if Play App Signing is
  enabled, a lost upload key is recoverable via a reset, but the request must
  come from the Account Owner and the new key takes days to activate.
- **16 KB page size.** Already in force. Third-party native libraries are the
  risk; each needs checking before the rollout widens.
- **The paywall cannot be tested end to end** until the store prerequisites are
  done.
- **The promise change** reaches the community as a broken promise unless it is
  explained deliberately.
