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
| 7   | RevenueCat + paywall + webhook + entitlement + quota + Pro filters                                                                 | **Done, three tiers** (17 tests). Client SDK, purchase and restore are wired against RevenueCat's Test Store; real-store receipts, proration and review still wait on the store prerequisites (see note)                                                         |
| 8   | Streak + token ledger + direct awards + `tokenAggregates`                                                                          | **Done** — 13 tests: 10 concurrent replays of the same message leave one ledger row; streaks advance and reset on the local day; a milestone pays once                                                                                                           |
| 9   | Daily pool + 4 leaderboards + sinks                                                                                                | **Done** — 18 tests plus live verification: the pool ran twice (once with the lock, once with the lock deleted) and total token stayed at 1054                                                                                                                   |
| 10  | `profileViews` + incognito, push, block/report, **account deletion + export**                                                      | **Server done** — 18 tests: a blocked user disappears from discovery, the chat list, the leaderboard and their profile (404, not 403) at once; a deleted account is invisible immediately, still recoverable on day 29, and gone from every collection on day 31 |
| —   | **Client screens** — onboarding, discovery, chat, leaderboard, profile, paywall, settings                                          | **Done** — the plan did not list this as a phase, but MVP items 2/3/4/5/12 all depend on it and only phase 1's auth screens existed                                                                                                                              |
| 11  | The ETL's profile + avatar + **gallery** step                                                                                      | **Code done, media step waiting on credentials** — 13 mapping tests; live dry run: 3479 documents → 3150 stageable                                                                                                                                               |
| 12  | EAS build, store identity, **API deploy**, web deploy, Sentry, `docs/self-host.md`                                                 | **What can be done from code is done** — keystore inheritance, EAS credentials and real submission need console access. The API deploy is a committed `Dockerfile` + `fly.toml`, verified by running the image; `fly launch` itself needs an account             |
| 13  | Promise update + privacy forms + staged rollout                                                                                    | **Copy written, not published** — publishing needs langx.io and console access                                                                                                                                                                                   |

## Phase 1 — the age gate moved to phase 2

The original criterion was "a 17-year-old's sign-up is refused server-side" in
phase 1. That turned out to be architecturally the wrong place: sign-up via
Google or Apple has **no `birthDate` field at all**, so a check inside Better
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

**Resolved — see the next entry.** It shipped as a Pro+ _sort_, not a Pro
filter, and the way out of the first-stage constraint was simpler than either
option above.

## Nearby — `$geoNear` takes the match as an argument

Two stages could not both be first, so only one is: `$geoNear` accepts the
whole mutual-fit `$match` as its own `query` field and applies it internally.
Nothing is dropped and nothing is unioned.

What is really traded is **which index drives the query**. The 2dsphere index
selects the candidates and the language arrays are filtered over that
already-narrowed set, rather than the language indexes narrowing first. That is
the "demote the language filter" option, and `maxDistance` used to be what kept
the demoted set small — see the next entry for why it no longer runs on every
request, and what that costs.

Three consequences worth knowing before changing any of it:

- **Opt-in enforces itself.** A 2dsphere index holds entries only for documents
  that carry the field, so a profile with no `location` is not a candidate.
  There is no "is sharing" filter anywhere, and clearing a location is
  `$unset`, never a flag — anything less would leave someone findable after
  they asked not to be.
- **Pagination is offset, and here that is correctness rather than a
  tradeoff.** Coordinates are rounded onto a ~1 km grid before storage, so
  everyone in a cell is at _exactly_ the same distance. A keyset cursor over
  distance (`$geoNear` even offers `minDistance` for it) either repeats a whole
  cell, skips one, or never terminates. Ties are the normal case here, not the
  rare one.
- **Precision is given away twice, deliberately.** Coordinates are coarsened on
  write, and the distance is bucketed on read. The first is not enough on its
  own: a distance is a circle, and an attacker who can move reads three circles
  and intersects them into something far tighter than the grid cell. Bucketing
  makes every position in a band report the same number, which is what breaks
  that.

Sharing a location is free on every tier while sorting by it is Pro+. A
paid-only pool would have contained nobody on the day it shipped, and the
people worth finding nearby are mostly not the people paying to look.

### The radius belongs to the searcher, not to the sort

Nearby shipped with a 500 km cap on every request and three chips above the
results to move it. Both are gone: the sort is an **ordering** — nearest first,
outwards, until the page is full — and `radiusKm` is an optional filter next to
age and country, "any" by default.

The cap was defended on two grounds and neither survives contact with a real
account. That a result 3,000 km away "is not nearby, it is just the nearest" is
an argument about the word: someone who opens a list sorted by distance wants
the nearest people there are, and the honest thing to do with a small pool is
to show it in order, not to stop at a line they cannot see. And a wall drawn
for them reads as an empty app — the same blank screen a user in a quiet city
got, with no way to tell "nobody near you" from "nobody at all". A border is
not a cut-off either: the next town over can be another country.

The other ground was real and is now a known cost. Unbounded, `$geoNear` walks
the index outward until the page is full, so a rare language pair can pull most
of the 2dsphere index to find twenty people — which is precisely the search
that used to come back empty. Common pairs stop within a few rings. If
discovery ever becomes the bottleneck, this is the first thing to measure, and
a wide internal ceiling (well past any radius a person would choose) is the
cheapest lever.

Two things follow for the client. `bucketDistanceKm`'s fallback past the last
edge is now the normal case rather than dead code, and `formatDistance` words
it `500+ km away` — a floor, not a measured value. And the empty state splits
in two: with a radius, "nobody within {radius} km" and a wider one to try;
without, the one thing that still narrows this list and no other — it can only
show people who turned location sharing on.

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

## Phase 8 — token caps run on the UTC day; only the streak is local

`TokenRules.caps` originally said "local day". That is exploitable. A cap is a
ceiling on ledger rows, and ledger rows sit in UTC day/week/month buckets — if
the cap reset on the local day, moving the clock east would open a second cap
window **inside the same UTC day** and both awards would land in the same
leaderboard bucket. That is precisely the "farm a period twice by flying east"
exploit `periods.ts` warns about.

So: caps and `dailyActivity` are UTC, **only** the streak is local. As a second
line of defence, `updateProfile` rate-limits timezone changes to once every 7
days; writing the same zone is never blocked.

## Phase 8 — ledger first, aggregates second; the order cannot be reversed

`awardTokens` does two writes: the `tokenLedger` insert, where the unique
`{userId, kind, refId}` index decides atomically and cluster-wide whether this
award has already been paid (a duplicate key is not an error, it is the answer
"yes"), and then the `$inc` on four period aggregates.

A crash between the two leaves an aggregate **under**-counted, recoverable from
the append-only ledger. Crashing in the reverse order would **pay twice** on
retry, which is not recoverable. `amount <= 0` writes nothing at all — a
message that hit its cap should leave no trace, not a row worth zero.

## Phase 8 — the award path is deliberately not swallowed

`awardForSend` runs after the message is written and does not suppress errors.
The only expected failure is a duplicate award, which `awardTokens` already answers
with a no-op; everything else means the database is unreachable, in which case
the message insert in front of it would have failed too. Catching silently
would trade a loud, recoverable error for a quiet drift in everyone's balance.

## Phase 8 — the reciprocity bonus pays both sides

There is no separate "mutual" kind in `TOKEN_KINDS`, and adding one would change
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
wrote `paid: 0`, and total token stayed at 1054. The lock avoids the work; the
ledger guarantees the outcome.

## Phase 9 — spending does not touch `tokenAggregates`

With a single counter, buying a 500 tokens frame would drop the buyer down every
leaderboard — engaging with the gamification would penalise you in it. So:
**earned** token (`tokenAggregates`, never decremented, what the table ranks) and
**balance** (`earned − profiles.tokenSpent`, what a purchase draws on). Spends are
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

Equal token shares a rank and the next distinct score skips (1, 2, 2, 4).
Positional ranking (index + 1) would be simpler, but a user outside the page
learns their rank from `countDocuments({tokens: {$gt: mine}}) + 1`, and the two
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

## The pool pays at 04:00 UTC, and the app stops predicting it

Two changes to the same thing, made together because either one alone is worse
than both.

**The payout moved off midnight.** A day closed at 00:00 UTC and the next
scheduler tick paid it, which meant the deposit landed at whatever minute the
process happened to be at — and computed a number about everyone at exactly the
moment the day's last messages, the cap counters and any redeploy were still
settling. `TOKEN_RULES.pool.payoutHourUtc` is 4, and `newestPayableDay` holds a
closed day back until then. The 15-minute tick stays: a cron that fires once at
04:00 and finds the process restarting never pays that day at all, which is the
failure the self-healing loop was built against in the first place.

**The projected share is gone.** The token screen drew `+84 your share so far`
from the viewer's activity score over everyone's, live, recomputed on every
read. It was the single most compelling thing on the screen and it was a
promise the payout does not make. The denominator moves all day, so the number
falls while you do nothing; worse, it ignores the eligibility `runDailyPool`
applies at day close, so an account inside `accountAgeRampUpHours` — the first
24 hours, which is exactly when someone is most likely to be watching — would
see a share climb all evening and be credited zero. `tokenSummarySchema.pool`
now carries `activeToday` (a fact about today) and `lastPayout` (a number that
already happened), and `pool.totalScore` was removed rather than left unread,
since a field nothing consumes is the drift the shared package exists to
prevent.

What replaced it is `GET /me/tokens/history`: the ledger, a day at a time, with
a per-kind breakdown, so "how much of Saturday was the pool" is answerable
after the fact instead of guessed at beforehand. That question is the one the
projection was really trying to answer.

**The trap it exposed.** `awardTokens` stamps a row's `day` from the award
instant, and the pool's instant is `dayCloseAt(D)` — midnight _after_ D. So a
pool row for Saturday has always carried `day: Sunday`, with `refId: Saturday`.
Nothing read it per-day before, so nothing noticed. Both new readers date a
share by `refId` through the shared `earnedDayOf`; grouping on the raw `day`
would have filed every share one day late, against a date the user may have
been asleep for.

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

## Phase 10 — freezing token takes three distinct reporters, not three reports

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
`tokenAggregates`'s `<userId>:<period>` and `dailyActivity`'s `<userId>:<day>` keys
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
add it to a blocklist. `birthDate` becomes an age, because that is what the UI
shows and the exact day is both more identifying than the product needs and
the thing a birthday feature would leak first.

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
with a decision the codebase had already departed from. `src/lib/theme/`
provides the shared vocabulary that was the actual point.

## Client — a stylesheet is a function of the theme, not a constant

Adding dark mode did not reopen the question above: NativeWind would still cost
a babel/metro change, and it was never what made dark mode hard. What made it
hard was the _shape_ of the idiom. Every screen ended in

```ts
const styles = StyleSheet.create({ title: { color: colors.text } })
```

which reads the palette at **import time**. Whatever scheme was current when the
module first evaluated is baked into that sheet for the life of the process, so
`colors` could gain a dark twin and no screen would ever show it.

`makeStyles()` takes the same object literal as a function of the theme and
returns a hook. The only change at each call site is `const styles = useStyles()`
inside the component. It caches per scheme rather than per component instance:
there are exactly two schemes, so each sheet is built at most twice and
switching costs no more than the constant lookup did. `chat/[id]` re-renders on
every socket frame and could not have afforded a per-render `StyleSheet.create`.

Two kinds of token stay direct imports, because they are scheme-independent and
because a hook cannot run early enough for them: `layout.avatar` and `radius.sm`
are used as **default parameter values** in `Avatar` and `Skeleton`.

The conversion also surfaced a naming bug that had been invisible while the app
was monochrome. `primaryText` meant "the text on `primary`" and `primary` was
near-black, so it was white — and three places had borrowed it to mean "white on
some other saturated fill". When `primary` became yellow, those three would have
rendered black on blue. They now use the palette's `text-inverse`, which flips
with the scheme because the accents do: light mode's are saturated and want
white on them, dark mode's are pastel and want black.

## Client — the palette is the website's, and yellow does not move

The app's colours are `website/src/lib/scss/_themes.scss`, not a second set
invented for mobile. A plan limit rendered in the app and the same limit
rendered on langx.io are the same claim, and they should not be two different
yellows.

One token deliberately does not participate in the theme: `primary`, and the
text on it, are identical in light and dark. Everything else moves to its dark
counterpart. `primary` is the committing action — Continue, Send correction,
your own chat bubble — and a user who has learned "the yellow one sends it"
should not have to relearn that after dark. The read tick lost its lifted blue
for the same reason it existed: it had been tuned to clear a near-black bubble,
and the bubble is yellow now, so contrast comes from weight instead of hue.

Scrims are the other deliberate constant. A scrim's job is to put distance
between a sheet and what is behind it, and tinting one with the ground would
make it do least of that in exactly the scheme where sheet and ground are
already closest.

## Client — one socket, opened in the tab layout

The server already puts every client in a single per-user room, so a socket per
screen would multiply connections without changing delivery. Incoming messages
are written into the query cache rather than component state, so every screen
reading that data updates — including the ones not currently mounted.

## Client — `app/index.tsx` is a three-way gate

Signed out, signed in **without** a profile, and ready. The middle state is real
and common: Better Auth creates the account, but `profiles` is ours and
onboarding writes it. A 404 from `/profiles/me` is that state, not an error.

**10 September 2026 — the mailed verification link now arrives here signed
in.** The link used to point at Better Auth's own `/verify-email`, which spends
the token and, with `autoSignInAfterVerification`, sets the session cookie on
whatever made that request — from an inbox, the mail client's browser. The app
never saw it, so a brand-new account was sent back to type its password a
second time. The mail now carries `app/verify-email.tsx`, which spends the
token itself and replaces to `/`; this gate then routes it to the first
onboarding step like any other session. Same shape as `magic-link.tsx`, and
the same reasoning.

## Client — the first screen is the welcome screen, not an intro

**10 September 2026.** A signed-out launch used to open on `(auth)/intro`:
three slides of copy, played once per device, in front of a welcome screen
whose first line said what the first slide said. Two screens describing an
exchange before one was offered — on the launch that decides whether there is
a second one.

The carousel is not deleted, it is moved: Settings → "Show intro again" plays
it on demand, `(app)/intro`, exactly as before. What the other two slides said
is now two lines under the language pairs on the welcome screen, next to the
thing they describe rather than three taps in front of it. `authLandingHref`
therefore takes no argument and always answers `/(auth)/welcome`.

`FLAG_KEYS.introSeen` stays in place, written by nothing and read by nothing.
An OTA update can be rolled back, and a build that reads that flag has to find
whatever it left there rather than a flag this version cleaned up.

Measured before/after rather than as an experiment: at this volume two arms
would report a coin toss. See `docs/plans/onboarding-first-minute.md`.

## Client — the onboarding draft lives outside React

expo-router remounts a screen when it is navigated back to, so component state
would be lost on "back", and serialising a growing draft through route params
turns the URL into a form encoding. A small store outside React matches the
real lifetime: the draft outlives any one screen and is thrown away on submit.

**7 September 2026 — the username moved ahead of the photo.** The v3 design
claims the handle right after the about-you step, and the picture and bio come
last. That changes what the draft carries: the profile exists by the time the
photo screen opens, so the avatar goes through the same upload-and-confirm the
profile editor uses and the bio is a plain `PATCH /profiles/me`. Neither rides
in the draft any more, and `furthestOnboardingStep` can now land on `handle`
(the step that submits) but never on `photo` — a profile is exactly what keeps
the gate from sending anyone back into the wizard.

## Client — `expo-notifications` must be imported lazily

Expo Go dropped remote push on Android in SDK 53, and `expo-notifications`
throws the moment it is imported in that environment. With the import at module
level, the throw took `(app)/_layout.tsx` down with it — expo-router reports
that as "Route ./(app)/_layout.tsx is missing the required default export", so
every signed-in user hit a blank error screen on Android.

The `!Device.isDevice` guard inside the hook never got a chance to run, because
the module died while loading. The import now sits inside the `useEffect`'s
try/catch, after the guards.

## Updates — two files whose bytes decide who gets an update

**10 September 2026, learned the expensive way.** `apps/mobile/app.config.ts`
imports `@langx/shared/appIdentity` and `@langx/shared/appScheme` by path, so
`@expo/fingerprint` counts both files as config sources and hashes their
**contents**. That hash is the runtime version, and EAS delivers an update only
to a binary whose runtime version matches it.

So editing either file — even adding a function the config never calls — makes
every update published afterwards invisible to every build already on a phone.
That is exactly what PR #1279 did by adding `verifyEmailUrl` to
`appIdentity.ts`: three merges' worth of updates published to a runtime version
no shipped binary had, with green CI and a successful publish each time. The
symptom is silence, which is why it is written down here rather than left to be
noticed.

The rule: **treat `appIdentity.ts` and `appScheme.ts` as frozen between native
builds.** Anything new that wants to live near them goes in a sibling file —
`emailLinks.ts` is the first — which may import them freely. Importing them
costs nothing; changing their bytes costs the release.

Two things that follow. A deliberate change to either is a change that needs a
new build, so it belongs in the release round rather than in an OTA-only PR.
And when an update seems not to arrive, compare
`eas update:list`'s `runtimeVersion` against the shipped build's
`Fingerprint` in `eas build:view` before looking anywhere else.

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

## Updates — two notices, because there are two ways to get one

An over-the-air update is already downloaded and one restart away; a store
release is a trip out of the app. Wording those as one message would have to
lie about one of them, so they are two: a toast that offers the restart, and a
dismissible banner that offers the store.

They also cannot be derived from each other. An installed binary reports the
version it was installed at whatever OTA bundle it is running, so `latestVersion`
cannot see that someone has taken an OTA fix, and the OTA check cannot see that
a new binary exists. Each notice is raised by the only mechanism that knows.

The banner exists at all because of what the gate feels like without it. A
forced-update screen is correct and it is also the worst possible first
mention of the subject; `latestVersion` moves the first mention weeks earlier,
to a point where the app still works and the answer can be "not now".

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
2026-08-27 the owner reversed the second half: balances come across as token.

Part of the original reasoning turned out to rest on a wrong belief.
`CHECKOUT_COLLECTION` looks like a purchase log and is not one — its fields are
`distribution`, `baseAmount`, `text`, `image`, `audio`, `streak`, `badges`,
`onlineMin`, which is a daily payout broken down by activity. v1's version of
the daily token pool. There is no Stripe integration and no purchase flow; the
client only lists checkouts. So migrating balances cannot smuggle money-bought
currency into a system whose rule is that tokens are never purchasable. That rule
survives the reversal intact.

## Measuring before converting, and what it found

Whether balances _should_ migrate was the owner's call. At what ratio is an
engineering question, and it was worth measuring rather than assuming.

`scripts/inspect-v1-economy.ts` reads the live wallet and streak collections.
1403 wallets hold 6,079,895 tokens: median 20, p90 9,136, p99 37,821, max
2,277,521, with 266 at zero. A very active day in v2 is about 700 tokens.

Credited 1:1 to _earned_ token, that puts the p99 user level with roughly 54
consecutive days of maximum activity, the top account at about nine years, and
injects 608 days of the entire daily pool at once. The all-time and yearly
tables become a permanent v1 ranking.

Two ways out were put to the owner: credit the spendable **balance** instead of
earned tokens (Faz 9 already separates the two — aggregates rank, balance is
spent), or credit earned tokens but divide it down.

**Decided: earned tokens, divided by 100.** The top account starts about 32 days
ahead of a maximally active newcomer rather than nine years, which is a real
head start that can still be closed. Balance-crediting would have protected the
table completely, but it also would have meant a v1 veteran's history never
showed up in the ranking at all — and the owner wanted the economy visible, not
merely spendable.

The accepted cost is that everyone under 100 tokens converts to nothing, which
at a median of 20 is more than half of them. That is what the **welcome-back
bonus** is for: it is the thing that rewards a median user for coming back,
while the conversion recognises the people who genuinely accumulated. Since
`awardTokens` writes no row for a zero amount, those users are left with no
meaningless ledger entry either.

In code: `TOKEN_RULES.legacyTokenDivisor`, `TOKEN_RULES.welcomeBackBonus`,
`convertLegacyTokens()`, and two new ledger kinds. The divisor being config rather
than a literal matters — the right number is a judgement about two economies,
and the ledger is append-only, so a recompute stays possible.

## Three gaps an audit against the plan found

Re-reading the plan against the code surfaced three places where the
implementation and the written intent had drifted. All three were real; none
would have been found by a passing test suite, because the tests asserted what
the code did rather than what the plan said.

**A deleted account's photos stayed in the bucket.** `purgeExpiredAccounts`
removed the user from every collection and never touched storage, while
`store/privacy-data-safety.md` told the user their data was permanently
removed. Their avatar and gallery stayed publicly fetchable by URL forever.
`StorageProvider` grew `deleteObject` and `keyFromPublicUrl`; the purge now
deletes what it owns and, deliberately, only what it owns — a URL outside our
bucket is skipped rather than guessed at, and a storage failure leaves an
orphaned file rather than an account that can never be purged.

**Socket events had no rate limit.** REST is covered by `@fastify/rate-limit`,
but once the handshake is done a `message:send` is just a frame and nothing
counted them — so the one guard REST had and sockets did not was exactly the
one the plan's "socket events pass through the same guards" rule was about.
Now a per-connection token bucket, per event: sending is 20 burst at 1/second,
typing is far more generous because it fires on almost every keystroke. A
bucket rather than a fixed window, because a fixed window lets someone spend
the whole allowance at the boundary and the same again a millisecond later.
Over-limit events are refused **through the ack** — a client that gets no
answer retries, which is the opposite of what a limit is for.

**The token ledger was deleted, not anonymised.** The plan asked for it to
survive as an audit trail with the identity removed. It now does: the rows are
re-keyed to `deleted:<uuid>` generated at purge time and stored nowhere else,
so the economy still reconciles and the rows identify no one. The _aggregates_
are still deleted, which is what actually removes the account from every
leaderboard.

## Three verification criteria that had no test

The plan's verification list named them; the suite did not cover them.

- **The 24h window rolls, it does not reset.** Full at 23 hours, open again at
  25, and slots free individually rather than all at once — a calendar-day
  reset would open the whole allowance at midnight.
- **Replying spends no quota.** Twenty inbound messages and twenty replies
  leave the counter untouched. This is the product's core promise — five new
  conversations a day, unlimited talking — and it was the one thing not
  asserted anywhere.
- **Corrections are unlimited on the free tier.** Fifty in a row, and nothing
  moves, because corrections are not a tracked bucket at all.

## A v1 conversation needs both people back before it comes back

The import waits for the second participant, however long that takes, and
imports nothing when only one has returned.

It would have been far simpler to import a thread the moment one side restored.
That is also the version that republishes someone's words into an account they
never opened, on the strength of a decision made by the other person. A
conversation is jointly authored; one author cannot consent for both. So
`legacyRooms` records sit staged until both sides have a v2 account, and a
thread whose second person never comes back is simply never imported.

This makes the whole thing a per-pair event rather than a cutover ETL, which is
why there are two halves: `scripts/migrate-messages.ts` only stages, and
`importLegacyConversations` runs at each restore. Whoever returns second finds
the first already marked, so the ordering needs no bookkeeping of its own.

## The attachments are copied years before anything reads them

The ETL stages a thread's photos and voice notes into our bucket immediately,
even though most of those threads will not be eligible to import for months and
some never will be. Copying lazily at import time would be strictly cheaper.

It would also be wrong. v1's Appwrite is being switched off, and the ETL run is
the last moment those 4,874 files can be read. A lazy fetch works perfectly
until the day the source is gone, and then it fails silently for every thread
still waiting — the ones belonging to the users slowest to return, which is to
say the ones this whole exercise is for. The bytes are cheap; the second chance
does not exist.

Rooms where _neither_ participant was staged are skipped, which is where the
cost actually gets controlled: those can never satisfy the both-sides rule.

## Imported messages pay out nothing

No token, no quota, no streak. The messages were already paid for in v1, and
that payment is coming back as the converted balance the restore credits —
awarding again would mint the same work twice. It would also mean a returning
user with a 400-message thread arrives at the top of the leaderboard for
something they did in 2023.

Read state is the opposite call: v1's `seen` flag is mirrored rather than
flattened to "all read". Flattening keeps the unread badge tidy at the cost of
permanently hiding a message someone genuinely never opened.

## The analytics dashboard is private, and that decides the tool

v1 published its analytics. `insight.langx.io` was a self-hosted Plausible CE
instance with the dashboard shared publicly, and there is a blog post on the
website inviting people to go and look at it. That was a coherent thing to do
for a product with nothing to sell: the numbers were traffic, and showing them
cost nothing while backing up the open-source promise.

v2 sells a Pro tier, so the same dashboard now reads out conversion rate,
churn, and which channel the paying users come from. Publishing that hands
pricing and channel strategy to anyone who asks, and it does it permanently —
a share link can be switched off, but what has already been read cannot be
unread. There is a second cost that has nothing to do with competitors: a
pre-release product's absolute numbers are small, and small numbers published
next to a paywall read as a dead app to exactly the people being asked to pay.

So v2's analytics dashboard is internal. The transparency that `insight` was
carrying moves, if it moves anywhere, to a curated public stats page built from
our own data — users, languages, messages, corrections, streaks — with no
revenue, conversion or funnel on it. That is a different artefact with a
different audience, not the same dashboard with a lock removed. It moved: that
page is `insight.langx.io`, and the line between what may be on it and what
may not is [`insight.md`](insight.md).

**The consequence is the tool choice.** Open source stopped being a
requirement the moment the dashboard stopped being public: self-hosting was
what made "go and audit our numbers yourself" true, and without that claim it
buys nothing but a ClickHouse instance to keep alive. What replaces it as the
constraint is mobile. v1's Plausible was web-shaped — Ionic meant a script tag
covered everything — while v2's revenue is mobile-first and sells through the
App Store, Play and the web at the same time. The tool has to answer one
question across all three: where in install → onboarding → first conversation →
paywall people stop, per channel, joined to RevenueCat's purchase events. A
pageview counter cannot answer it in any of its self-hosted forms.

**The tool is PostHog Cloud (EU).** It is the one option that is mobile-first
and answers the channel question without a second integration: an official
React Native SDK, funnels and retention rather than pageviews, and a
server-side RevenueCat connector that puts purchase events in the same
timeline as the behaviour that led to them, so a Play subscriber and a
Stripe-on-web subscriber land in one funnel. Its free tier is 1M events a
month, which is far above anything v2 will produce before it matters.
Self-hosting PostHog was rejected outright: Kafka, ClickHouse and Redis is
the opposite of this project's one-container API, and it would be paying the
full operational cost of self-hosting for a dashboard nobody outside the
team will ever open. EU Cloud rather than US, because the users are.

**This invalidated a store claim.** `docs/store/privacy-data-safety.md` said
the app carries no third-party analytics SDK. That was true while analytics
meant our own Plausible endpoint and stops being true the day the PostHog SDK
ships in the Expo build, so the document has been rewritten ahead of the
integration: PostHog appears in both tables, and the three properties the
store answers actually depend on — no message bodies, our own user id rather
than a device id, coarse IP geolocation off — are recorded there as
declarations rather than left as configuration someone can quietly change.
Apple's privacy questionnaire and Play's Data Safety form have to be updated
_before_ that build goes out, not after, and the promise-update copy in phase
13 is where users hear about it.

**`insight.langx.io` is gone from every repository**: the script tags on the
website, the token site and the Ionic app, the `INSIGHT` environment entry
and the "Insights" row in that app's about page, the `usePlausible` hook in
the abandoned React Native attempt, and the README links. The Better Stack
status page section was removed by hand, since it lives in their dashboard
and not in any repo.

The blog post announcing the public dashboard was deleted outright rather
than rewritten. Rewriting it would have meant a public article explaining
that the numbers became commercially sensitive the moment there was
something to sell — true, and a worse thing to say out loud than saying
nothing. The transparency claim it made is not being replaced by a smaller
claim; it is being replaced by the stats page, or by nothing.

**Shipped on 3 September 2026**, with three choices the paragraphs above did
not make. The opt-out is a device flag rather than a profile field, because
the first screens are captured before there is an account, and a refusal that
only takes effect after sign-in is not one. It is stored as the refusal, not
the consent, so that the failure every device flag is designed around — an
unreadable store — lands on the default rather than on a phantom "yes". And
session replay is off: a recording of a messaging app, however masked, is a
new answer on both store forms and a cost the funnel question does not need
paid. `docs/analytics.md` has the event list; the store consequences are in
`docs/store/privacy-data-safety.md`.

**Session replay was turned on on 11 September 2026**, and the sentence above
is the one being reversed. It was right about the funnel and wrong about what
comes after it. The funnel says how many people left a screen and nothing here
could say why: `onboarding_step_completed` counts the step being finished,
`$screen` counts it being seen, and the gap between the two is the entire
question. A masked recording is the only instrument that answers it without
asking anybody anything, and the events that were added after the original
funnel — a send that failed, a push nobody taps — were the same admission a
step at a time.

"However masked" is now load-bearing, so it is written down rather than
assumed. All text is masked, not only the fields somebody types into, and so
is every image, which leaves a chat recording as a column of grey blocks:
layout, timing and where the taps went. Console logs and network telemetry are
the two ways text would get past that — a log line is whatever was logged, a
URL carries the ids the events deliberately leave on the phone — and they are
the only two options in `analytics.ts` that are the SDK's defaults inverted
rather than repeated. The masks themselves are defaults too, and they are
written out anyway: a dependency bump that changed one would change what
leaves the phone without changing a line of ours.

Two prices, both paid where this repo can see them. It is a native module, so
it moves the `runtimeVersion` fingerprint and cannot arrive over the air — the
first build carrying replay is a store build, and older installs simply see no
update. And it is iOS and Android only: the SDK skips the plugin on web, so
`app.langx.io` records nothing and `enableSessionReplay` says
`Platform.OS !== 'web'` rather than `true` so that the web build does not
warn about a module it will never have. How many sessions are recorded is a
dial in PostHog rather than a constant here, for the same reason every other
threshold is config — set locally it would win over the project's, and
recording less would mean a release.

## Discovery filters live in the URL, not a store

The filter screen is pushed on top of Discover and has to hand its result back,
which route params do without introducing a global. The reason to prefer them
outright is the web build: a filtered search survives a reload and can be
pasted to someone, for free.

The cost is that a Pro filter can reach a free account — a pasted link, or a
subscription that lapsed while the link sat in a tab. The server answers those
with 403 by design (`DISCOVERY_PRO_FILTER_KEYS`, never a silent ignore), so the
client strips them before asking. An error page is a worse answer to "here is a
link to some people" than an unfiltered list.

## "Only my gender" is resolved on the server

It would have been half the code to translate the toggle into `gender=<mine>`
in the client. But only the server is certain what the viewer's own gender is,
and a client that had not finished loading its own profile would send an
unfiltered query that looked, on screen, exactly like a filtered one.

It is inert when the viewer's own gender is `undisclosed`: "people like me"
cannot mean "people who also declined to say", and narrowing to that group
would be a worse answer than not narrowing.

**It is free.** It was paid until now, and the reasoning that kept it paid was
that it is the one filter people use for safety rather than preference — so
gating it read differently from gating a convenience. That argument is
retired rather than amended, because keeping the safety framing while making
the filter free would leave the repo saying, in writing, that safety used to
be behind the paywall.

The real objection is smaller and harder to answer. This is the only filter
that can _never_ widen a result set — it takes no value and points at nobody,
it only narrows what you already see. So the account most likely to reach for
it is one that is being shown people it did not want to be shown, and the
account most likely to hit the paywall is the one already looking at too few
people. What it learns there is that the app is empty. Selling a filter that
makes a small pool smaller is selling scarcity back to the person suffering
from it.

That leaves the paywall with a rule that is easier to explain than the one it
replaces, not harder: **a paid filter names somebody else's attribute; a free
one names only your own.** `gender` and `city` take a value and aim it at
other people. `onlyMyGender` is resolved from the caller's own profile and is
inert for anybody who has not disclosed one — there is no third party in it.

## Gender changes twice a year, not never

This reverses an earlier decision, which said gender was set once and gave a
good reason: `gender` is an input to somebody _else's_ discovery filter, and a
filter whose subjects can move between its buckets on a whim is not a filter,
it is a suggestion. That much still holds, and it is why `gender` is still
absent from `updateProfileSchema`.

What the first decision did not price is who paid for it. Somebody whose gender
actually changed after they signed up — which is a thing that happens to real
people, unlike a birth date changing — had exactly one way to correct their
profile, and it was to delete the account and start again, losing their
conversations, their streak and their handle. That is a heavy toll to collect
from a small group in order to close a hole nobody was climbing through. Nobody
was cycling genders to game discovery. There was no evidence of the abuse, and
the defence against it was absolute.

A cooldown answers the filter argument as well as a lock does. At
`GENDER_CHANGE_COOLDOWN_DAYS` — 180 — there is nothing worth doing with this
field that a bad actor could do: half a year per move makes bucket-hopping
useless while leaving a real correction easy. The rule that stayed is the one
that mattered; only its severity changed.

`birthDate` stays out of every write path, and the distinction is now the
honest one rather than an accident of symmetry: a birth date cannot change, so
there is no legitimate case to serve. A gender can.

Three details make it hold:

- **The condition is in the update's filter**, not in a read before it, for the
  reason every other guard here is: two taps that race would both pass a
  check-then-write and the second would win, which would make the cooldown
  advisory — beatable by anyone willing to tap twice quickly.
- **The first change is free**, because onboarding never writes
  `genderChangedAt`. That preserves the old "answer the question you skipped"
  path exactly, and it is also why there was no migration to write: a profile
  from before the field reads as one that has never been changed, which is what
  it is.
- **`undisclosed` is now an accepted value.** The route used to refuse it
  because it was a one-way door with nothing behind it. Now that the door opens
  both ways, refusing it would only strand people who came out and changed
  their mind. It costs a move like any other, which is what stops
  `female → undisclosed → male` from buying two changes for the price of one —
  and why there is no `gender: 'undisclosed'` branch in the update's `$or`.

The client learns about the cooldown from `genderChangedAt` on its own profile
rather than from a refusal, so the field is drawn as locked before anybody taps
it. `GENDER_CHANGE_TOO_SOON` carries a `retryAt` the way the timezone cooldown
does, and exists for the stale client and the racing tap.

## Pronouns are free text, and gender is not

`pronouns` sits in `updateProfileSchema` beside `bio`, editable as often as
anybody likes, while `gender` two paragraphs up is rate-limited. The line
between them is the same one that decides which discovery filters are free:
**nothing searches on pronouns.** They are how a person is addressed, not a
bucket they are sorted into, so none of the filter-integrity argument applies
and there is nothing to protect.

Free text rather than a set of options, which is the choice that looks lazy and
is not. Pronouns are a fact about a language before they are a fact about a
person: Turkish has one third-person pronoun for everybody, Russian and Arabic
inflect the verb instead, and English's three-option list is an English answer
to an English problem. An enum would have to be either English everywhere or
eight incompatible enums, and the field would still be wrong for the ninth
language somebody speaks. Twenty-four characters and let people write it
themselves.

It is on `sharedProfileSchema` even though `gender` is not, which looks
inconsistent from the outside. It is the same rule again: that schema is a
deliberately narrow subset for a page handed to strangers, and the one thing
you least want a stranger's page to get wrong is how to address you.

## The shop is two ladders, and its order is the rule

The catalogue was priced as a progression from the day it grew — 1,000 to
50,000 for frames, 1,500 to 100,000 for titles — and then sold as a shelf.
Anyone with 100,000 token could buy `title.legend` and ignore the nine rungs
under it, which made the price a number rather than a distance.

Each item now needs the one below it in the same kind. Frames and titles are
two ladders, not one queue: buying a frame has never had anything to do with
owning a title.

**The total sink does not change.** All twenty items still cost about 395,000
either way. What changes is that the prestige rows cannot be reached first —
Legend is 231,500 cumulative rather than 100,000 — so the top of the shop is
evidence of a long time spent here, which is the only thing a cosmetic in this
app is for.

The gate is _own the one below_, not _own everything below_. Read against a
catalogue nobody has skipped rungs in, the two are the same rule by induction.
They differ only for the accounts that were **given** rungs, and those are the
ones the weaker rule protects: `grantWelcomePack` writes with `$addToSet` and
never comes through `purchase`, so a subscriber holding gold without silver has
to keep moving. Asking them to go back and buy the rungs under a gift would
turn a gift into a bill.

New packs start at the bottom for the same reason. They used to hand out the
2nd, 4th and 7th frames and the 2nd title, which was fine for a shelf and
incoherent for a ladder. Starting at the bottom is what collapses the two
readings of the gate into one sentence: **you buy them in order.**

Two things this made load-bearing that were not before. `COSMETICS`'s array
order is now the rule, so `cosmetics.test.ts` asserts each kind is strictly
ascending in price — otherwise the shop could ask somebody to buy the expensive
thing first while showing them a bargain they are not allowed to have. And
`previousCosmetic` is derived from the order rather than from the price, so a
repricing cannot silently reorder what has to be earned first.

The condition is checked twice, like every other guard in `purchase`: once as a
read that produces a useful message, and once inside the atomic filter, which
is the one that counts. Both cosmetic conditions live under a single
`cosmetics` key there — a second key of the same name in that object literal
would have replaced the first rather than added to it, and the one that lost
would have been the guard against paying twice for the same item.

## A voice note plays at half speed, rather than being recorded twice

The feature people ask for is "say it again, slowly", and the obvious build is
a second recording: the speaker records the same sentence twice and the
listener picks. That costs a field on `Media` — which is a single flat object
on messages, posts and corrections alike — a second presigned upload, a second
`assertMediaAllowed` call for the bucket check, and a ruling on whether two
files spend one unit of the media quota or two. All so somebody has to say the
same thing twice before their voice note is any use to a learner.

`expo-audio` already does it: `setPlaybackRate` is in the version we ship, and
the whole feature is a toggle in `AudioBubble`. Nothing on the server, nothing
in the schema, no new upload, and it ships over the air.

The two are not the same thing, and the cheap one is better for the common
case. A second take is a person re-articulating; half speed is the same
recording stretched. But the sentence somebody needs slowed is almost always
one they nearly caught, and for that, stretching is the right tool — and it
works on every voice note ever sent, including the 1,270 imported from v1,
rather than only on the ones somebody thought to record twice.

**Pitch correction is what makes it work at all**, and the argument that turns
it on behaves differently on each platform. iOS corrects pitch by default and
reads `'high'` as the algorithm; Android ignores the argument and preserves
pitch anyway; **web starts with it off and only enables it when `'high'` is
passed** — `AudioPlayer.web.ts` sets `preservesPitch = (quality === 'high')`.
Dropping that argument would leave two platforms fine and turn the web build,
which is the one on app2, into a growl. Nobody learns pronunciation from a
growl.

The toggle is local state, not a preference. This is per sentence, not per
person: the note you need slowed is the one you did not follow, and the next
one is usually fine.

## No photo until they have written to you five times. From anybody.

The failure this exists to prevent has one shape: the first thing a stranger
sends is a photograph, and the person receiving it did not agree to look at it.
Moderation cannot fix that one. A report arrives after the picture has been
seen, and being right afterwards is not the same as it not happening.

So the rule is structural rather than punitive: you can send no attachment to
somebody until they have sent you `MEDIA_UNLOCKS_AFTER_RECEIVED_MESSAGES`
messages. Nothing has to be detected, nobody has to be judged, and there is no
model deciding what a photograph contains.

**Received, not exchanged.** The first version counted both people's messages
together, and that had a hole the size of the rule: send five messages to a
stranger yourself and the sixth could be a photograph. A shared total never
required the other person to take part, which is the one thing that can stand
in for their consent. Counting what _they_ sent makes the gate theirs to open,
and asymmetric on purpose — one side of a thread can be unlocked while the
other is not.

**There is no exception, and that is the feature.** Not for Pro, not for
Polyglot, not for somebody with a long history who has opened a new thread. A
paid tier attached to this rule would say the behaviour is acceptable from
customers, and it is not acceptable from anybody. It is also the only version
that survives being said in one sentence: _photos unlock once they have written
to you five times, for everyone._ Every carve-out costs a clause, and a rule
people cannot repeat is a rule that does not deter.

Five, because it is more than a greeting and fewer than a conversation. Two is
cleared by "hi" / "hi". Twenty breaks the ordinary case of sending a picture of
the menu you are asking about.

**The gate is on `POST /messages/upload-url`, not on the send.** The client
uploads straight to the bucket through a presigned URL and only then emits
`message:media`, so a check at send time refuses a message pointing at a
photograph we have already stored and can already serve. Refusing to _sign_ is
what stops the bytes. `sendMediaMessage` checks too, for a URL signed a moment
before the fifth message was deleted and for any future transport that forgets
the first check — that one is the belt, not the braces.

`messageCountBy` — the count split by sender — rides the `findOneAndUpdate`
that `recordMessage` was already issuing for `lastMessage` and `unread`, so the
counter is free. Its **absence** means something specific: the conversation
predates it. Those are the threads with the most history, so
`messagesReceivedFrom` counts them through the `conversation_sender` index
rather than reading a missing field as zero and locking a two-year-old
conversation out of sending a photo — a cost that decays to nothing as old
threads get their next message.

The client is told how many more are needed rather than just that it cannot,
and the camera is disabled rather than hidden. A control that vanishes teaches
nothing, and a rule nobody knows about deters nobody.

## Referrals — the handle is the code, and the award waits for a real message

_Amended 5 September 2026: the invitee is now paid too — see the end of this
entry._

**There is no generated code.** The handle already is one: a public address at
`/<handle>`, already unique, already memorable enough to say out loud, already
the thing people share. A second identifier would be a second thing to keep
unique, a second thing to reserve, and a second thing to explain. The invite
link is the profile link plus `?invite=1`, so every link ever shared still
resolves and the failure mode when the marker is stripped is today's behaviour
rather than a 404.

**Nothing is paid for signing up.** This is the whole design. `signupBonus.ts`
used to say, correctly, that there was no farming incentive to guard against —
token cannot be bought, sold, traded, transferred or withdrawn, so a second
account earned its owner nothing. A referral award breaks exactly that: it is
the first mechanism where a throwaway account is worth something to the account
that made it. So the award does not fire on the sign-up. It fires when the
invitee has verified an email, finished onboarding, and _earned_ — a message, a
correction or a pronunciation answer. Farming it costs a real conversation with
a real person per fake account, which is the price this whole economy is built
to charge. The comment in `signupBonus.ts` has been rewritten to say so rather
than left to become quietly false.

**Two kinds, not one.** `refId` is unique per `{userId, kind, refId}`, so one
kind keyed on the invitee can pay exactly once. The alternative was a prefixed
second refId, the `mutualRefId` trick — which is right when the _same_ award is
earned for different things, and this is not that. `tokenHistory.ts` labels a
row by its kind, and one kind would show two rows both reading "Invite bonus",
one worth a thousand and one worth four, on the same day. Telling somebody
where their tokens came from is the only job that screen has.

**Both are grant kinds.** All-time only, never the week or month. The existing
argument for that list was launch week — a converted v1 balance topping the
weekly table with tokens earned in 2023 — and referrals are worse in kind
because they are _repeatable_: twenty activations in a week is twenty thousand
tokens for somebody who did not send a message, every week, indefinitely. The
week and month tables rank practising, and inviting is not practising.

**The subscription top-up does not break "tokens cannot be bought."** The claim
is that nobody can buy their own, and that survives exactly: the subscriber
receives zero, and the only account that moves is one that spent nothing.
`welcomePack.ts` stands word for word — money buys items and never token, _for
the person who paid_. What does change is that an all-time rank can now move
because somebody else paid. That is a real cost and it is accepted knowingly,
with `legacyTokenConversion` as the yardstick.

It is also gated behind the activation, which is the guard on the one path
where real money touches this economy. Without it, a stolen card on a throwaway
account is worth four thousand tokens for no human effort.

**`INITIAL_PURCHASE` and nothing else**, plus a free → paid transition edge in
`refreshEntitlement` for the webhook that never arrives.
`ENTITLEMENT_GRANT_EVENTS` also holds RENEWAL, PRODUCT_CHANGE, UNCANCELLATION
and four more; every one is a grant and none is somebody starting to pay for
the first time. Three independent things stop a renewal paying: the explicit
event check, the pre-image edge, and `refId` being the invitee. The third is
sufficient on its own — and relying on it alone would mean the _first_ renewal
after launch pays, which is harmless today only because `referrals` starts
empty. That is luck, not a property.

**`referrals._id` is the invitee**, not a field with a unique index on it.
"A person has exactly one referrer, ever" is the primary key rather than an
optimisation somebody could drop: it needs no declaration in `indexes.ts`, and
a second attach is an E11000 rather than a race two readers both win.

**Every attach failure is silent.** An unknown handle, a deleted referrer, a
self-referral, a second attempt: all write nothing and throw nothing. The
caller is `createProfile`, the account is real and the profile is written
either way, and failing a sign-up over a mistyped username punishes the wrong
person for the wrong mistake. `referredByHandle` carries `.catch(undefined)` so
even a malformed code is a 201 rather than a 400.

**The award is settled from the earning path, not a sweep.** A nightly job
would need a partial index over rows that never expire and would land the
reward hours after anything the referrer did — for a referral programme, that
is most of the value gone. `awardForSend` already holds the sender's profile as
a pre-image, so `referredBy` is a property access on a document in memory:
somebody nobody invited, which is nearly everyone, pays nothing for the check.

**Award first, latch second.** A crash between them under-records the audit row
and self-heals on the next call, because `awardTokens` answers `duplicate` and
the latch is rewritten. The reverse marks a referral paid that never was, which
nothing can recover.

**Returning v1 users cannot be attributed, and that is accepted.**
`restoreLegacyProfile` writes the profile directly and fires from
`afterEmailVerification`, where there is no request body to carry a code. The
alternative — a post-onboarding endpoint — would destroy the property
everything else rests on: attribution is written exactly once, at account
creation, and nothing can change it afterwards. No copy promises otherwise.

**Amendment, 5 September 2026 — the invitee gets a welcome.** Behic asked
whether the person who _took_ an invite gets anything, and the answer was no.
Now it is `TOKEN_RULES.referral.inviteeActivation` (750 — with the 250
sign-up bonus, an invited newcomer starts on `inviteeTotal`, 1000, which is
the figure the invite page quotes), paid once, at the same activation moment
as the referrer's award and from the same `settleReferral` call, as a
`referralWelcome` ledger row with the invitee's own id as `refId`. The gate is
unchanged, so "nothing is paid for signing up" is still literally true; what
changed is that the moment already worth 1000 to one side is now worth 750 to
the other. The invited landing page (`app/[username].tsx`, the `?invite=1`
branch) says all three numbers out loud, from `TOKEN_RULES`, so a newcomer
knows what taking the link is worth before they sign up. It is a grant kind,
so it stays off the weekly and monthly tables. A frozen referrer does not
withhold it (the activation was the invitee's own doing); a deleted referrer
ends the referral for both sides, as before.

## Countries are a compile-time table, like languages

`profiles.country` was a free-text two-letter field, which meant the edit form
asked people to type "GB" and nothing stopped them typing "gb" — while the
filter searched for one exact spelling. Both sides now go through
`countryCodeSchema`, which normalises case and rejects anything that is not a
real code.

The table is generated from Node's own ICU data rather than hand-written, then
filtered twice: deprecated codes are dropped by keeping only codes that are
their own canonical form, and aggregates are excluded by name. `ZZ` — ICU's
"Unknown Region" — survived the first pass and would have validated as a
country; a test now asserts it does not.

Search folds diacritics, which is not cosmetic here: the English name of the
country most of v1's users live in is spelled "Türkiye", so without folding the
single most likely search on the filter screen returns Turkmenistan and the
Turks & Caicos Islands and nothing else.

## A new account starts with tokens, and grants do not rank you

A brand-new account had a balance of zero, which made the token store inert on
day one: every row priced out, nothing to try, and no way to find out the
economy is real. New accounts now start with `TOKEN_RULES.signupBonus`.

The amount is the price of a streak freeze plus change, and deliberately below
the cheapest cosmetic. The freeze is the one thing worth owning before you have
earned anything — it protects the first day you miss — and buying it is how
someone discovers the store works. A grant that bought a frame outright would
make the cheapest frame mean nothing.

There is no farming incentive to defend against: tokens cannot be bought, sold,
traded, transferred or withdrawn, so a second account earns its owner nothing
they can use on the first.

**Adding it exposed a bug that was already shipped.** `awardTokens` increments
all four period aggregates, so a one-off grant lands in this week's, this
month's and this year's buckets — the ones the leaderboard ranks. A signup
bonus would have put every new account above people who had actually talked to
someone, and the same was already true of `welcomeBack` and
`legacyTokenConversion`: on launch week, returning v1 users would have topped
the weekly table with tokens earned in 2023. That is not what the divisor
decision was weighing, which was only the all-time table.

So `TOKEN_GRANT_KINDS` credit **all-time only**. All-time is where a spendable
balance is read from, so grants stay spendable; the ranked periods stay a
record of what someone did in them. `adjustment` is deliberately not a grant —
it exists to correct a real award, so it has to land where that award did. The
ledger row still carries every period key, so a recompute can always see where
an award actually fell.

## Language levels are v1's four, not CEFR's six

`A1…C2` was replaced by Absolute beginner / Beginner / Intermediate / Fluent.

The reason is the migration rather than taste. v1 stored a number, 0–3, and
`LEVEL_TO_CEFR` squeezed it onto six bands — sending v1's top to `B2` on
purpose, with a comment admitting the compromise: an inflated level produces
confident bad matches. `C1` and `C2` were bands no migrated user could ever
occupy. Four tiers make the mapping exact, and that compromise is retired.

It is also a scale people can answer honestly. CEFR is a formal qualification
most speakers have never been assessed against, so on a self-declared field it
invites guessing; "beginner" and "fluent" do not.

The cost is a one-off conversion of stored data, `scripts/migrate-levels.ts`,
and it must run **after** the profile ETL or the ETL writes fresh CEFR values
behind it. The conversion under-claims deliberately: six bands collapse to
four, `C1` and `C2` both land on `fluent` because there is nothing above it,
and nobody is promoted by a migration they did not ask for.

`cefr.ts` became `level.ts` rather than keeping a name that would have lied
about its contents.

## A third tier, and the four things two tiers were hiding

> **Superseded in part — see _The plans are Fluent and Polyglot_ below.** The
> tier identifiers are unchanged and everything about the shape of the table
> still holds. What is no longer true is the sentence after this one: the two
> tiers no longer share quotas or capability flags.

`PLAN_TIERS` is `free | pro | pro_plus`. Pro+ is a **strict superset** of Pro:
same quotas, same three capability flags, plus `nearby` and `copilot`.

Adding it was cheap for the reason the table was built that way — `PLAN_LIMITS`
is a `Record<PlanTier, PlanLimits>`, so TypeScript demanded exactly one new row
and not one `hasFeature`/`quotaLimit` caller changed. Nothing compares tiers;
there is still no `tier > 'free'` anywhere, and `isPaidTier` is a not-free
test, not an ordering. Keep it that way.

**Neither Pro+ feature exists.** `nearby` needs the `sort=nearby` branch that
`$geoNear` forces into its own pipeline, and `copilot` has no code at all. The
tier is sold anyway — that was a product call — so the paywall marks both rows
`COMING SOON` from a required `shipped` field in the copy table. A boolean
someone has to come back and flip is the only version of that promise the
compiler can hold us to.

Widening the table surfaced four bugs that two tiers had kept invisible:

- **`effectivePlanTier` never expired Pro+.** The guard read `tier !== 'pro'`
  and returned early. With two tiers that was the same test as `tier === 'free'`;
  with three it meant an expired Pro+ subscription kept its tier forever — the
  one failure the function exists to prevent, reappearing on the new tier.
- **The webhook could not tell the tiers apart.** `revenueCatEventSchema` never
  declared `entitlement_ids`, so all eight grant events wrote `tier: 'pro'`
  blindly. `PRODUCT_CHANGE` is a grant event, which made the upgrade/downgrade
  event silently downgrade every Pro+ subscriber who touched it.
- **`EXPIRATION` wrote `free` unconditionally.** An expiry says something ended,
  never what is left; a lapsed Pro+ over a still-running Pro has to land on
  `pro`. No field on the event can say that, so the handler now reconciles
  against RevenueCat and only falls back to `free` when it cannot be asked.
  The fallback swallows the error deliberately: a non-2xx would put RevenueCat
  into a retry loop over something already handled correctly.
- **`toPublicProfile` read the raw stored tier.** A subscription whose
  `EXPIRATION` was late or lost kept showing everyone else a PRO badge the
  server already refused to honour. It now goes through `effectivePlanTier`,
  the same rule every guard uses.

The client half of the entitlement flow, which had never been built, now
exists: `react-native-purchases`, offerings read for real prices, purchase and
restore, and `POST /billing/refresh` called immediately after a purchase rather
than waiting on a webhook that may be seconds late or lost.

**`Purchases.logIn(userId)` runs from the root layout, not the paywall.** The
identity has to be right before a purchase is possible, not at the moment one
is attempted: the server keys everything off `app_user_id`, so a purchase made
under an anonymous RevenueCat id is real on the store and invisible here, and
no later `logIn` moves it.

## Pro+ products grant the `pro` entitlement too

Two entitlements, `pro` and `pro_plus`, and every Pro+ product is attached to
both. It falls out of the packaging — a Pro+ subscriber _is_ a Pro subscriber —
but it buys two concrete things.

A subscriber therefore almost always holds both ids at once, so something has
to pick: `ENTITLEMENT_PRECEDENCE` resolves Pro+ over Pro. That is a resolution
rule for concurrent entitlements, not the tier ordering ruled out above.

It also degrades in the right direction. Any guard that still asks only about
`pro` — and, before the client was written, the entire server did — reads a
Pro+ subscriber as Pro rather than as free. The failure mode of forgetting the
new tier somewhere is "gets less than they paid for", never "gets nothing".

The dashboard side has one wart worth knowing: **entitlement identifiers cannot
be renamed after creation.** The project was set up with `langx_pro` while the
code had always hardcoded `pro`, so `getProEntitlement` looked up a key that
never existed and nobody could have been granted Pro by a successful purchase.
Fixing it meant creating `pro` and deleting `langx_pro`, which was free only
because there were no customers yet.

Package identifiers have the mirror-image constraint: a reserved one
(`$rc_monthly`, `$rc_annual`, `$rc_lifetime`) can be used once per offering, so
Pro's three kept them and Pro+ had to take custom ones. A custom identifier
reports `packageType: 'CUSTOM'`, so the SDK can describe Pro's billing cadence
and not Pro+'s — which is why `PACKAGES` carries `period` itself instead of the
paywall reading it off the SDK for one column and guessing for the other.

## The v1 loyalty gift goes through RevenueCat, not the database

Two rungs, cut at v1's measured percentiles and handed out automatically the
moment a returning user's email is verified:

| v1 balance     | gift          | roughly |
| -------------- | ------------- | ------- |
| ≥ 37,821 (p99) | lifetime Pro+ | 14      |
| ≥ 9,136 (p90)  | lifetime Pro  | 140     |

The numbers are `LOYALTY_LIFETIME_GRANTS` in `packages/shared`, from
`inspect-v1-economy.ts`'s measurement of 1403 wallets (median 20, max 2.28M).
The median wallet holds twenty tokens, so either cut separates cleanly — nobody
lands on a rung by accident, and the thresholds can move without touching code.

**The obvious implementation is wrong.** Writing `tier: 'pro'` straight into
`profiles.entitlement` looks like the whole feature and survives about as long
as the user's next visit to the paywall: `refreshEntitlement` replaces the
stored tier with whatever RevenueCat reports, so a database-only gift is erased
by the first `/billing/refresh` — which the paywall calls after a purchase and
on "Restore purchases", and which the restore itself now calls the moment the
grant is in, so the tier is right before the welcome-back screen is even read.
Anything that grants entitlement has to go through RevenueCat, which
is what `grantLifetimeEntitlement` does (`POST .../entitlements/{id}/promotional`,
`duration: 'lifetime'` — there is no `end_time_ms` that means "never expires").
Granted there it also survives a reinstall, shows up in the dashboard, and can
be revoked.

The Pro+ rung grants **both** `pro_plus` and `pro`, mirroring how the Pro+
products are configured. Precedence resolves `pro_plus` alone correctly today,
so this is insurance: a gifted Pro+ subscriber should be indistinguishable from
a paying one, including to whatever code someone writes next that asks only
about `pro`. The leading entitlement decides the tier and is awaited alone — if
it fails there is no gift to report; the rest are best-effort.

**A failed gift must never cost someone their account.** The grant runs last,
after the profile, handle, tokens and conversations are all written, and its
failure is swallowed exactly like the conversation import's — logged, reported
as no gift, restore unaffected. That is the house rule (optional services
degrade, they do not crash) and it is the only sane direction here: a missing
gift can be granted from the dashboard in a minute, whereas a restore that
throws is somebody who cannot get their account back. `legacyLifetimeGrant.test.ts`
asserts that direction, not just the thresholds.

**It is delivered at restore time rather than by a batch script**, because the
grant needs an `app_user_id` and that is the Better Auth user id — which only
exists once someone has actually come back. A script could only ever have
reached the people who had already returned; hooking the restore covers
everyone, whenever they arrive.

The recipient is told on the welcome-back screen, which is the only place they
would ever learn of it. A gift nobody is told about is indistinguishable from
no gift.

## The API runs on Fly.io, and never scales to zero

The deploy target had been left open long enough that it blocked the
RevenueCat webhook, which needs a public URL before it can be configured at
all. Fly was chosen for the ordinary reasons — a container, a custom domain
with an automatic certificate, secrets in the platform rather than the repo.

The part that is not ordinary is `auto_stop_machines = 'off'`. Scale-to-zero
is the headline feature of every platform in this class, and it is wrong here.
Four schedulers live inside the API process and every one of them is an
interval tick, not platform cron: the token pool, the account purge, the
streak reminder, the legacy import. A suspended machine runs none of them, and
nothing wakes it, because the work is not triggered by a request — nobody
calls the API to make 20:00 arrive in a user's timezone. The failure is silent
and looks like a bug in the schedulers.

Two smaller constraints, both of which cost an afternoon to find:

`packages/shared` is inlined into the bundle by an esbuild `--alias` rather
than left external like every npm package. It ships as TypeScript source, so
externally Node resolves it to a `.ts` file and then cannot follow that file's
own extensionless imports. `node dist/index.js` had never been run before —
the documented deploy command did not work.

`pnpm deploy` runs with `--config.node-linker=hoisted`, because the default
symlink layout keeps a `.pnpm` store containing the entire workspace. The API
image shipped Expo, React Native and the Hermes compiler until it did not:
1.15 GB down to 608 MB.

Going past one machine needs a Socket.io adapter first — the rooms live in
process memory, so two instances cannot see each other's sockets. That was
written here, and the second machine went in without it anyway; _Two machines,
one socket bus_ below is what it cost and what fixed it. Everything else about
the app was already safe to run multiply — the `jobRuns` unique index means
only one instance can own a given day's pool.

## The app speaks eight languages, and English is the one that defines them

A language-exchange app whose own interface is only in English asks every user
to be fluent in the language they came here to learn. So the app reads the
device's language and words itself in it: English, Turkish, Spanish, Russian,
Arabic, French, German and Brazilian Portuguese.

Four decisions inside that are worth knowing, because each one closes a door
that the obvious alternative leaves open.

**A missing translation is a compile error, not a fallback.** Every catalogue
in `apps/mobile/src/i18n/messages` is annotated `Localized<EnMessages>`, which
derives its shape from English — so a key added to `en.ts` and to nowhere else
does not build. The usual arrangement is a per-key runtime fallback to English,
and it is the wrong one for this app in particular: a reader who is still
learning cannot tell an untranslated string from a phrase they simply do not
know yet. A partly translated locale is worse than an absent one.

**Counts are plural objects, never a number glued to a noun.** Russian splits
at 1, 2–4 and 5+ — and again at 21, 22–24, 25+; Arabic uses all six CLDR
categories. `count === 1 ? x : y` is wrong in four of the six Arabic cases, and
it is wrong silently. The engine in `packages/shared/src/i18n.ts` selects with
`Intl.PluralRules`, and lives in `shared` rather than in the app because the
API words push notifications and emails too — one implementation, or the two
disagree the first time someone has eleven of something.

**Languages, countries and dates come from the platform, not from us.** Those
two lists are ~450 entries; translating them by hand into eight locales would
be both enormous and worse than what every device already has in CLDR.
`Intl.DisplayNames` answers instead, with the English name from `@langx/shared`
as the fallback. Only the _display_ changes — the stored value is the ISO code
either way, so two people running different locales still match on the same
language. The country and language pickers search the localized names as well
as the English ones, because a picker you cannot search in your own language is
a broken feature rather than an untranslated one.

**Arabic is why the layout uses `start`/`end`.** RTL is handled by
`I18nManager.forceRTL` on native and `dir` on web — one switch, rather than a
conditional on every `flexDirection: 'row'` in the app. That only works if the
styles are written in logical properties, so `left`/`right` were replaced with
`start`/`end` throughout, and `messageMenuLayout` takes an explicit `rtl` input
rather than inferring the edge from `mine` (in RTL your own bubbles are on the
left, so the two flips cancel — a rule with a test rather than an assumption
baked into an expression).

Two things are deliberately **not** localized. The API's error bodies stay
English: they are a developer-facing log line, and every caller branches on
`code` and words its own message — a screen that shows `error.message` to a
user is a screen with a bug. And `DebugQuotaPanel` stays English because it is
a developer tool that only renders behind a debug flag.

The reader's language is a **device** preference, stored beside the theme in
`localFlags`, defaulting to the device and overridable in Settings. Not an
account setting: the phone is what has a language, and a shared tablet should
not change language when someone else signs in. The client sends it as
`Accept-Language` (so a signed-out password-reset email is written in the right
language) and registers it with each push device (so a streak reminder is, too).

## The feed's cursor split on the wrong dot

The `needsCorrection` tab sorts `(correctionCount, createdAt, _id)`, so its
cursor has to carry the count; the `following` tab sorts by recency and does
not. One encoding, told apart by a `<count>.` prefix — and the decoder looked
for the first `.` to find it.

An ISO timestamp has a dot of its own, before the `Z`. `indexOf('.')` found the
milliseconds every time, the countless branch was unreachable, and **every
`following` page-two request was a 400** from the day the tab shipped.
`needsCorrection` only ever worked because a leading `"3."` happens to put a dot
at index 1, ahead of the timestamp's.

Recognised by shape now (`^\d+\.`), which cannot match a timestamp whose fifth
character is `-`, so cursors already in a client's hand still decode. The two
functions moved to `lib/feedCursor.ts` on the way: they touch no `Db`, and a
cursor bug is cheapest to prove fixed where there is no database to stand up.
Nothing had tested a second page.

## The corrected post used to vanish, and the sort was not the bug

Answering a post made its card disappear. `needsCorrection` sorts
`correctionCount` **ascending**, and the mutation invalidated the whole feed —
so the refetch re-sorted the post behind every unanswered post in the
collection, in the same frame as the tap. The one visible consequence of
teaching was the evidence of it leaving the screen.

The sort stays. Putting the uncorrected ones first is what makes the queue
drain; inverting it to fix a UI glitch would trade away the product. The fix is
a cache patch (`lib/feedCache.ts`), applied to the `['feed']` prefix so both
cached tabs move together. The next natural refetch — pull-to-refresh, tab
switch, remount — still sorts it away, which is right. It just should not
happen while the user is looking at it.

## Correction counts count corrections, not awards

The lifetime figure behind the profile tile and the correction badges counted
`correction` rows in the token ledger. `awardTokens` writes no row at all when
the amount is zero, and a user under review is awarded zero — so a frozen
user's corrections sat at 0 no matter how much teaching they did.

The old comment defended counting awards: "a correction past the daily cap is
still a correction but was never paid for". There is no such cap.
`PLAN_LIMITS.correctionsPer24h` is `null` on every tier, deliberately, because
teaching is the behaviour the economy exists to reward. With the cap gone, the
freeze was the _only_ thing separating awards from acts.

So it counts the acts — `postCorrections` plus `correction` messages, on two new
indexes. For everyone whose tokens are not frozen the number is identical by
construction. A frozen user now earns correction badges again, which is the
documented intent rather than a side effect: freezing "stops the payout only",
and a badge is not a payout. Writing zero-amount ledger rows would have been the
smaller diff and the wrong one — "an award worth nothing leaves no trace" is an
invariant, and breaking it would have started counting capped-out message awards
too.

## A day that began with teaching returned a 500

`recordActivity` normalizes its post-image, so a caller always gets `partners`
as an array. `readActivity` did a plain `findOne` and did not — and `partners`
is the one counter not in the `$inc`. It only appears under `$addToSet`, which
only runs when there is a partner, and a correction has none.

A user whose first activity of the day was a correction therefore had a
document with no `partners` field at all, `countersOf` read `.length` off
`undefined`, and the entire token summary — streak, chart, tile, balance —
failed with a 500. Not a wrong number: no screen. Found by the test written for
the frozen-user count above, which is the argument for writing the test rather
than the assertion.

Both ends are fixed: `countersOf` guards the field, and `readActivity`
normalizes the way `recordActivity` already did, so a reader cannot tell which
of the two produced the document it holds.

## The feed's one visible correction needed somewhere to lead

A feed card carries exactly one correction — the oldest — because a page of
cards cannot afford to transfer a popular post's whole answer list to render
two booleans. That is right, and it left "See all 4" as a label on nothing: the
control was a `View`, and no screen had ever called
`GET /posts/:id/corrections`.

Building the screen turned up what an uncalled route had been hiding. The
handler took no viewer, so it applied **no block filter at all** — the one
place in the app where a block was one-way. It read every correction with
`.toArray()`. And it returned corrections without the post, so the screen would
have needed a second request for the sentence they are corrections _of_.

All three are fixed together, because shipping the screen is what would have
made each of them a bug in production rather than a bug on disk. The keyset
runs **ascending** — corrections are replies and replies read forwards, which is
also what makes "the top correction is the oldest" true — on a new
`post_created_id`, since `post_created` has no `_id` to make the page boundary
exact.

## A `likes` collection exists, and it is not a match gate

`collections.ts` said "no `likes`/`matches` — there's no match gate", and the
architecture's Decisions table said the same. Half of that is still true and
the other half is now literally false, so both are corrected rather than left
to be read as a promise nobody kept.

There is a `likes` collection. It is a signal on feed **content** — a post or a
correction, told apart by `targetType` — and never on a person. It opens no
channel: access is still governed purely by quota, and a like grants nothing.
`targetId` is an `ObjectId`, which quietly rules out ever liking a profile,
since profiles are keyed by string. That is the no-match-mechanic rule
expressed as a type, and it was free.

One collection with a discriminator rather than one per likeable thing, so a
third kind needs a value in an enum and no migration.

## A like pays nothing, for the same reason a reaction does not

No ledger row, no daily counter, no streak advance. A like costs one tap, and
anything that pays out for one tap is a farm — worse than a chat reaction,
because two accounts liking each other is a _reciprocal_ farm, which is the
exact shape the reciprocity bonus was designed against. The streak's condition
is a documented product rule ("send a message or write a correction"), so a
third qualifying action would rewrite `architecture.md`, not just a module.
A test pins it, next to the one that pins the same thing for reactions.

That third action has since been added — a recorded pronunciation answer — and
`architecture.md` was rewritten for it, deliberately and in the same change.
The bar this paragraph sets is unchanged: it is not "never a third action", it
is that one costs a product rule, and a like still does not clear it.

## Likes are counted, not denormalized — and must never become a sort key

`posts.correctionCount` is denormalized, and its comment says why: it is the
sort key for the `needsCorrection` tab, and an index cannot sort on a count it
would have to join to find. That justification does not transfer. **Nothing
sorts by likes, and nothing may start** — the moment the feed ranks by them it
stops being a correction queue and becomes a popularity contest, which is the
thing the ascending `correctionCount` sort exists to prevent.

So they are counted, by a `$group` shaped exactly like `readCorrectionSummary`:
one row per liked target rather than one per like, so a post with four hundred
likes costs a page the same as one with two. A denormalized counter would also
have meant every like doing two writes that can diverge on a crash.

## `PUT` and `DELETE`, not a toggle: an HTTP retry must not undo a like

`reactToMessage` toggles — re-tapping the same emoji clears it — and copying
that idiom here would have been a bug. It reaches the server over a socket,
where `emitWithAck` gives the client a definite answer or a definite failure.
Over HTTP, a request whose _response_ is lost is retried, and a retried toggle
silently undoes what the first attempt applied. That is the same class of
failure the ledger's `user_kind_ref_unique` index exists to make impossible, so
it gets the same answer: an idempotent set and an idempotent clear, both
guarded by a unique index rather than by a prior read.

Both return the whole new state, so the client writes rather than increments —
which is what makes a double tap on a slow network land on the same number.

## Follower counts will be block-filtered; like counts are not

Opposite answers to the same question, on purpose.

The likers _list_ is block-filtered, because a name in a list of names is
exactly what a block has to hide. The _count_ on the card is not: filtering a
page-wide aggregate would make it viewer-dependent to conceal a number nobody
can attribute — with four hundred likers, no one can tell which name is
missing. So a card can read "12 likes" over a list of 11, and the likers screen
therefore counts its own rows rather than echoing the card.

Followers get the other answer for the same reason inverted: a follower list is
short, so an unfiltered count beside a filtered list visibly disagrees, and the
disagreement itself tells the viewer that someone they blocked is in there.

## Following is a real relationship now, and the old stand-in stays

The feed's "Following" tab shipped without a follow graph, standing in the
people you had talked to — which was honest, because that was the only
relationship this app had. Its own empty-state copy said so.

There is a `follows` collection now: one-directional, unconfirmed, granting no
access and opening no channel. It is not a match gate. All a follow decides is
what a feed tab contains.

The stand-in stays, and the tab reads the union. Removing it would empty the
tab for every existing user on the day the button shipped, and a conversation
partner is somebody you are following in every sense except the button. The
name is slightly generous as a result; an empty tab that used to have content
would have been worse.

Counts are computed, not stored, by the repo's own test: is it a sort key?
`posts.correctionCount` is denormalized because it _is_ one and an index cannot
sort on a count it would have to join to find; `tokenAggregates` is the
counter-example, with no duplicate counter in `profiles` "which would only
drift". Nothing sorts by follower count.

## Follower counts are block-filtered, and like counts are not

The same question, answered two ways on purpose.

A follower list is short. An unfiltered count beside a filtered list would read
"12 followers" over 11 rows, and that discrepancy is itself the leak: it tells
the viewer that somebody they blocked follows this person. A blocked account is
_absent_ — the same rule that makes their profile a 404 rather than a 403 — so
both the count and the list filter, and they agree.

Likers are many. Nobody can attribute a missing name among four hundred, and
filtering there would make a page-wide aggregate viewer-dependent for no gain.
So the list filters, the count does not, and the likers screen counts its own
rows rather than echoing a card that may be one higher.

## `toPublicProfile` stays pure, and the new parameter is required

It is a synchronous allow-list: "built by naming fields rather than deleting
them", so a field added to `Profile` later is private by default. Making it
async to fetch two counts would have put a database round trip inside that
allow-list.

Follow counts arrive the way `emailVerified` already does — computed by the
route, passed in. Required rather than defaulted, so no call site can quietly
ship `{ followers: 0 }` for a profile with a thousand. Exactly one existing
caller had to change, which is the point of finding out at compile time.

## The Following tab is a union, bounded at 500

It reads the follow graph _and_ the people you have talked to. Dropping the
older half would have emptied the tab for every existing user on the day the
Follow button shipped, and a conversation partner is somebody you are following
in every sense except the button.

Both halves are capped and sorted by recency before they are unioned, because
the result is an `$in` on the feed's author filter, and an `$in` is a list the
query planner has to carry. Uncapped it grew with how social somebody is —
which the conversation half already did, silently, before the follow graph
made it worse. Above the cap the tab is a _sample_ of the graph rather than all
of it: a deliberate trade against a fan-out table this does not need yet.
Follows are unioned first, so a deliberate choice outranks an incidental one
when the cap bites.

The conversation query is sorted now, which it was not. Truncating an unsorted
find would have kept whichever rows Mongo happened to return.

## Feed attachments share chat's media quota, and its ceilings

A post and a correction can carry a photo or a voice note. They are the same
shape as a chat attachment — one `mediaSchema`, one set of size limits — and
they spend the same `mediaPer24h` bucket.

The same bucket, not a second one, because it is the same abuse surface: bytes
stored and served forever. `PLAN_LIMITS.mediaPer24h` is documented as a ceiling
on abuse rather than a paywall, and a second bucket would mean a second limit
key, a second quota kind, and a free tier that is really a hundred a day
through two doors. The consequence is user-visible and belongs in the release
note: **a heavy day in chat leaves fewer attachments for the feed.**

The quota is spent only when there is an attachment, so a plain sentence still
costs nothing.

## The attachment uploads on submit, not on pick

Both composers hold the local file and upload when the message or the post is
actually sent. Uploading on pick spends a day's media quota and leaves bytes in
the bucket for something the writer then abandons.

Chat used to be the exception, on the argument that in a thread picking _is_
sending. That was wrong in a way the feed had already got right. Picking is
choosing, and the two questions somebody asks immediately afterwards — which
photo did I pick, and how do I take it back — had no answer at all: the file
went up and the message appeared, and an accident was a message to delete. A
thumbnail with a cross answers both, and it is also what makes a caption
possible, since the draft is still there to be typed into when the send
happens.

## A post still needs words

`body` stays required, so there is no photo-only or voice-only ask. This is the
one place where "attachments everywhere" and "the feed corrects sentences" pull
against each other, and the sentence wins: with no text there is nothing for
`corrected` to be an edit of, and the correction composer seeds itself with the
post's own words.

Loosening this later is backwards-compatible. Tightening it would not be, which
is the argument for starting here rather than the other way round.

## The signing route is keyed by user, and guarded like posting

`POST /posts/upload-url` needs a verified email, matching `POST /posts` rather
than the plain `requireAuth` on the message equivalent. A signed URL is a
capability; handing one to an account that cannot post would let it write into
our bucket for nothing, and the feed's version of "can you post here" is the
guard on posting itself.

The key is `posts/{userId}/…` rather than keyed by post, because the post does
not exist when the URL is signed — unlike a conversation. That also keeps the
deletion purge able to find a person's uploads by prefix.

## The plans are Fluent and Polyglot, and three things moved

`pro` and `pro_plus` are what the code calls them and what RevenueCat calls
them; **Fluent** and **Polyglot** are what a person sees. The two are separate
on purpose — a RevenueCat entitlement identifier cannot be renamed after it is
created, so a display name that lives in the same string as an identifier is a
rename waiting to be impossible. `TIER_NAMES` and `TIER_BADGES` in `limits.ts`
are the only place the words appear; six screens read them, and `TierBadge`
still gets its colour from a theme token rather than a name.

Free keeps no badge. A chip reading "FREE" beside somebody's name is an insult,
which is why `TIER_BADGES.free` is `null` rather than a string.

**What moved, and why each one moved:**

- **`profileViewerIdentities` and `incognito` are Polyglot.** Polyglot was
  sold on two features that do not exist — `nearby` needs `$geoNear` in its own
  pipeline and `copilot` has no code at all — so the tier above was, in
  practice, a promise. These two exist and work, so the tier now has something
  to be. The client needed no logic change for who-viewed-you: `profileViews`
  already returns a `locked` flag the screen renders, so only the copy naming
  the tier changed.
- **Translation has a number on every tier: 20 / 300 / 1000.** "Unlimited
  translation" was the one claim in the table with a real per-request cost to a
  third party behind it, and no local engine to fall back on. A quota that is
  generous and honest beats a promise that has to be quietly rate-limited the
  first time somebody scripts it. `PRO_BENEFITS` therefore stops carrying
  `unlimitedTranslation` and carries `translationQuota`, which the paywall
  interpolates per tier — so the Fluent row says 300 and the Polyglot row says
  1000 from the same copy entry.
- **`hideOnlineStatus` left `PlanLimits` altogether.** It is `true` on every
  tier now, and a boolean that is true everywhere is not a plan limit — it is a
  privacy setting, like `activityMapVisible` beside it. Leaving it in the table
  would have kept `hasFeature` and `tierUnlocking` answering a question with no
  paid answer. It became free because the profile and the chat header started
  publishing "last seen": charging someone to hide data the app has only just
  started showing about them is not defensible, and it is the same argument
  that gave country, age and level back to the free tier.

**Both language lists are capped, on one ladder: 1 / 2 / 5.** Learning and
native use the same numbers deliberately, so it is one rule over two arrays
rather than two rules. zod cannot express a tier-dependent maximum — route
schemas are registered at boot, before any request exists — so zod holds the
ceiling (`pro_plus`'s row, so it cannot drift from the table) and the tier
check lives in `updateProfile`, the one place that has both the tier and the
stored profile.

**The cap is checked at write time only, and the clause that makes that real
is `&& > current.length`.** The refusal is "this write would leave you with
more than your plan allows _and_ more than you already had". Without the second
half every migrated v1 user holding five languages could never edit a level,
reorder priorities, or even remove one — the profile would be frozen by a limit
introduced after it was written. Applied per array, so being over on natives
does not block a learning-language edit.

Capping _native_ languages is not the same trade as capping learning ones, and
it is worth naming: discovery's mutual-fit `$match` reads the viewer's
`nativeLanguages`, so a free user held to one native language is not merely
limited, they are **findable by fewer people**. For someone raised bilingual a
second native language is an identity fact rather than a feature. The ladder is
what was asked for and it is what shipped; the cost is recorded here so it is
not rediscovered as a mystery.

None of this introduced a `tier > 'free'` comparison. `hasFeature`,
`tierUnlocking` and `effectivePlanTier` read the real table and were not
touched — which is the property that let two capabilities change tier without a
single call site moving with them.

## Known risks

- **Play signing key.** Narrowed but not closed: if Play App Signing is
  enabled, a lost upload key is recoverable via a reset, but the request must
  come from the Account Owner and the new key takes days to activate.
- **16 KB page size.** Already in force. Third-party native libraries are the
  risk; each needs checking before the rollout widens.
- **The paywall can be tested against RevenueCat's Test Store, not a real
  store.** The catalog, both entitlements and the client SDK are wired, so
  purchase and restore can be exercised in a dev build. What that cannot cover
  is anything only a real store produces: StoreKit/Play receipts, upgrade
  proration between Fluent and Polyglot in one subscription group, and review. Those
  still wait on the App Store Connect and Play Console prerequisites.
- **The webhook has no configured endpoint yet.** Entitlement therefore only
  moves when the client calls `POST /billing/refresh`; a purchase made outside
  the app reaches the server on the next refresh, not immediately. Configuring
  it needs a publicly reachable API URL, which localhost is not.
- **`langx.io/terms-conditions` still has no subscription clauses.** The
  paywall links to it, as a store requires, and the document it links to does
  not yet cover renewal or cancellation.
- **The promise change** reaches the community as a broken promise unless it is
  explained deliberately.

## A pronunciation answer is recorded twice; a voice note still is not

The decision above — _"A voice note plays at half speed, rather than being
recorded twice"_ — stands, and this bounds it rather than reversing it. That
one is about a note somebody already sent: you nearly caught the sentence, and
stretching the recording you have is the right tool, works on all 1,270 notes
imported from v1, and costs nothing on the server.

A pronunciation request is the other case. The asker has never heard the word,
so there is no recording to stretch, and the thing they need is a person
re-articulating — choosing different sounds, not the same sounds slower. The
old decision conceded exactly this ("the two are not the same thing") while
correctly ruling that the common case did not justify the machinery.

So the second take exists only here, and it is **optional**. The fast one is
the answer; the slow one is a bonus. Requiring both would leave requests
unanswered while somebody re-records, which is a worse failure than a request
answered once.

It answers the question that decision named and left open: **two files spend
one unit of the media quota, not two.** The quota is documented as a ceiling on
abuse rather than a paywall, and charging per file would make the optional take
feel expensive and be skipped — the one behaviour it exists to encourage. The
byte ceiling is still per file, and that is the control that actually bounds
storage. Every file is validated before any of them is charged for, so a
rejected slow take does not burn a unit for an answer that was never written.

`assertAttachable` takes a list for this, and the list is what makes the
ordering explicit rather than incidental.

## Comments pay nothing, and cannot be liked

A like pays nothing because one tap is not worth paying for. A comment is one
sentence, which is barely more, and unlike a correction there is nothing in its
shape that makes it teaching. Two accounts can trade sentences all day.

It is also not a likeable target. A like says "this helped", and it means
something on a post, a correction or a recording because each of those is
capped at one per person and each took real work. An unlimited, unpaid,
uncapped row is the cheapest thing in the app to reciprocate on.

Which is also why `postComments` has **no unique index**, alone among the
child-of-post collections. Many comments per person per post is the point, and
the absence is written down in `indexes.ts` so it does not read as an oversight
and get "fixed" by symmetry.

The count is computed at read time. `correctionCount` and `answerCount` earn
their drift risk by being sort keys; nothing sorts by comments, and nothing may
start to — the moment the feed ranks by chatter it stops being a correction
queue.

## The feed's kind is absent on every post that already exists

`posts.kind` arrived with the pronunciation section, and every row already on
disk is a correction post with no such field. There is no migration
infrastructure in this repo and none was added for one boolean's worth of
meaning.

The correction section matches `{ kind: { $in: ['correction', null] } }`, which
catches the missing field and stays index-bounded on
`kind_needs_correction`. `{ $ne: 'pronunciation' }` reads identically, returns
the same rows, and **cannot be bounded** — MongoDB has no bounds for a negation,
so the main feed would quietly become a collection scan with nothing failing to
say so. That is the whole reason the `$in` is written the way it is, and the
reason a comment sits beside it.

`answerCount`'s absence on legacy rows is harmless only while the sections stay
separate: a legacy post never appears on the tab that sorts by it. If they are
ever unified, that stops being true.

The two new indexes are new _names_ rather than widened keys, because changing
a live index's key is an `IndexOptionsConflict` rather than a rebuild — the
failure this file has already recorded twice.

## Pronunciation pays its own token kind, keyed on the request

A recorded answer is the same act as a correction in a different medium, so it
pays the same ten. It is a **separate `TokenKind`** all the same, because
`countCorrectionsWritten` feeds the correction badges and the cosmetic gates,
and folding a different act into that number moves a threshold that names the
other one. It also earns its own line in the token history, which is the honest
answer to "where did these come from".

It advances the streak — the third qualifying action, which rewrites the
product rule in `architecture.md` on purpose rather than by accident. It
deliberately does **not** touch `dailyActivity` or the daily pool's weights:
those are a published formula mirrored on the website and in two GitBook pages,
and a fourth term is a pool rebalance, not a feature. The consequence is worth
stating out loud: an answer pays its ten and advances the streak, and
contributes nothing to that day's pool share.

The `refId` is `pron:<postId>` — the request's id, not the answer's. See below.

## Deleting a post takes its corrections with it

Not a tombstone. `deleteMessage` leaves one because a withdrawn message still
has a place in a thread; here the post _is_ the sentence its corrections are
corrections of, and an empty one leaves a list of rewrites of nothing. Somebody
removing a sentence they regret posting means it to be gone, and half-gone is
the answer nobody asked for.

So the post, its corrections, its recordings, its comments, its likes and every
object behind them go together. **Earned token does not.** The ledger is
append-only and the people who answered did the work; deleting the sentence
does not undo their afternoon.

There is no time limit, unlike the two-day window on withdrawing a message.
That window bounds reaching into somebody else's device; a feed post was never
on one, and "you may no longer delete your own words" is not a rule this app
wants to explain.

Ownership lives in the delete filter rather than in an `if` above it, and
`deletedCount` is what tells the second of two racing devices that it lost —
the same design `deleteMessage` uses. 404, never 403: a 403 confirms the row
exists.

One accepted residue: a `correctPost` racing between the post's deletion and
its children's can leave one orphan row. It is invisible — every reader reaches
a correction through its post, and that lookup now 404s — but its attachment
stays in the bucket. Closing it would need a `deletingAt` flag and a two-phase
delete, which is more machinery than one stranded object is worth.

The account purge is a different question and keeps its own answer: posts and
corrections survive it as "Deleted account", because that is somebody else's
learning. **Recorded answers do not** — an answer is its bytes and nothing else,
so stripping the media that the purge must delete would leave an empty row
pretending to be an answer. They are deleted outright and `answerCount` comes
down with them.

## The correction award is keyed to the post, not to the row

`awardForPostCorrection` used to file its ledger row under the correction's
`_id`. That was safe exactly as long as a correction could not be deleted.

It can now, and a deleted-then-rewritten correction mints a fresh `_id`, a
fresh `refId`, and a second payment — an unbounded payout from one post. Keyed
on the post (`postcorr:<postId>`, and `pron:<postId>` for recordings), the
ledger's existing `{userId, kind, refId}` unique index _is_ the rule "paid once
per post per person". No extra read, no "have I paid this before" flag,
permanent.

Prefixed for the reason `mutualRefId` is: a bare ObjectId hex says nothing
about which collection it came from.

Every row written before this carries the old key, so until
`scripts/backfill-correction-refids.ts` has run, one user deleting one
pre-existing correction and rewriting it is paid a second time. Bounded,
one-time, and silent — nothing fails, the ledger just gains a row it should not
have. **It must run before this deploys.**

## Opening the app holds the streak, but does not pay for holding it

The streak used to require a meaningful action every single day, and the rule
was written down in four places as a point of principle: _"a streak should mean
you practised, not that you visited"_.

The principle is right about what a streak should _mean_ and wrong about what
losing one does. The people it motivated were never the problem; the ones who
had a day with nothing to say and lost two hundred of them were. A streak that
punishes a quiet day does not teach people to practise, it teaches them to stop
looking — and someone who opened the app on a bad day and left is exactly the
person a streak is supposed to bring back tomorrow.

So `POST /me/check-in` credits the day. The client calls it once per local day
on foreground, never as a side effect of a query: a write that fires from a
background refetch or a prefetch is a write nobody can predict, and "your streak
advanced because something polled" is not a rule anyone could plan around.

**It pays no milestone, ever.** That is the half that keeps the first half
honest. The milestone is what makes a long streak worth token — 5,000 at a year
— and the all-time leaderboard ranks token earned. Paying it for app launches
would put somebody at the top of a table that other people climb by correcting
strangers' sentences, without ever having corrected one. The number on screen
goes up for showing up; the token behind it is still earned.

A milestone crossed by a check-in is not lost, only deferred: the first real
action of the same day pays it. That needed a **second** field —
`streak.lastActionDay` beside `lastQualifiedDay` — because the two facts came
apart the moment check-ins existed. The streak can be credited for today while
no work has happened yet, and one boolean could not carry both. Each gets its
own conditional write and its own race guard; the ledger's `refId: <day>` is
still the thing that makes a double payment impossible.

`lastActionDay` is absent on every profile written before this. `$ne` matches a
missing field, so the first action of the day claims it, which is the right
answer — and a milestone already paid today under the old rule is caught by the
ledger anyway.

**A check-in spends a banked freeze.** This looks like a silent purchase and is
the opposite. A freeze exists to stop a gap ending a streak; the gap is
yesterday's, not today's. Refusing to spend it here would mean a check-in
quietly resetting a streak the user had already paid 200 token to protect — and
no later action could undo it, because the day is claimed by then.

The activity map tells the two kinds of day apart, and had to. `actions` is a
count of work, so a check-in must not increment it or every quiet day would look
as busy as a day of teaching. The square is filled at its own faint shade —
`checkedIn` on the cell, not another step on the intensity scale, because
intensity counts work and this day has none. The history screen names it
outright. A day that opened as a check-in and later saw a real message keeps
`source: 'checkIn'` — the field says how the day _began_ — so both readers go by
`actions`, not by the source alone.

Never on somebody else's map. The public activity endpoint sends an intensity
and no source, the same line that already hides which squares were bought.

## The feed has one queue, and the people you follow come first

The correction section had two tabs, "Needs a correction" and "Following". The
second one split a small feed into two smaller ones, and made the reader choose
between helping a friend and helping whoever had waited longest — a choice the
app can make for them. It is one list now: the people you follow (and have
talked to, the union from the section above), uncorrected first; then everybody
else, uncorrected first. Following outranks the count, so a friend's answered
sentence still sits above a stranger's open one.

"People you follow" is not a field on the post, so no index can sort by it, and
computing it per document would make every page an in-memory sort of the whole
collection. `listFeed` is two queries stitched end to end instead — the
audience's posts to exhaustion, then everybody else's, both served from
`kind_needs_correction` — and the cursor carries an `f.` prefix while it is
still inside the first half, so page two does not start it again. The second
query runs even when the first filled the page exactly: its `+1` is the only
thing that can say whether there is a page two. The countless cursor form went
with the recency tab; every feed page now sorts on a count.

The pronunciation section is unchanged — one queue, no graph in it yet — and
takes the same code path with an empty audience.

## Achievements share as a picture; everything else is still a sentence

Reversing most of the section below, in September 2026, after using the thing.
A streak shared as a line of text is a line of text in a feed of pictures — it
is the one moment somebody is willing to post about this app and it looked like
nothing. Streaks, badges and ranks now render a card; profiles, posts and
messages still do not, for the second reason below, which did not change.

The first objection was the binding one and server rendering answers it. The
card is drawn by `satori` and rasterised by `@resvg/resvg-js` inside the API —
no `react-native-view-shot`, no native module, no new binary for a picture, and
the whole thing ships over the air. That is the same move `avatar.ts` and
`qr.ts` already made, for the same reason, and this is the third time it has
been the right one.

The third objection stands and is honoured: `shareText.ts` is untouched and
still pure, and it is still what gets shared when there is no card — a failed
render falls back to the sentence rather than reporting an error for something
the user asked to _share_.

Three shapes, because there is no ratio that survives all three destinations: a
9:16 card on a timeline is a stamp and a 16:9 card in a story is a band across
an empty screen. The app asks where it is going before the picture is drawn.

**What the link points at is a page, not the picture.** `app.langx.io/s/<id>`
carries the OpenGraph tags, shows the card and offers the download; a raw
`media.langx.io` URL unfurls as a bare image with no title and gives whoever
taps it nowhere to go. That page is a Cloudflare Pages Function rather than an
Expo route, because the web build is a static export — every route ships the
same empty shell and fills it in on the client, so a crawler fetching one sees
no title and no image. Meta tags have to be in the bytes the crawler is handed.

**What goes into the share sheet is the picture, as a file** — a reversal of
the paragraph above, on 5 September 2026, after trying to post one. Handed the
page URL, Instagram's share extension offers exactly one thing: send it in a
message. Handed an image it asks Story or Post, which is what a 9:16 card was
drawn for. So on iOS and Android the app downloads the PNG into the cache and
hands the file to `expo-sharing`; the page is still what "Just the link" sends,
what the web build shares (a browser cannot hand a file to Instagram), and what
goes out when the download or the file share fails. The cost is the one the
first paragraph of this section was proud of avoiding: `expo-sharing` is a
native module, so this needed a build and a store submission rather than an
update. It is a small one — no permission, no plugin configuration — and the
fingerprint runtime version keeps the update away from binaries that lack it.
A file share carries no sentence and no URL; the card carries the handle and
the profile QR, so the referral rule below still holds.

The card carries the sharer's profile QR. That is what makes it worth posting
rather than just nice to look at: a story is watched on one phone and scanned
with another, and without the code the only route from the picture back to the
person is reading a handle off the screen and typing it. It points at
`inviteUrl`, per the rule below that an achievement carries the referral
marker.

## Sharing is a sentence and a link, not a card

Six more things can leave the app through the share sheet — somebody else's
profile, a post, a streak, a rank, a badge, a message — and every one of them
goes out as words with a URL after them. The obvious alternative was a shareable
image: a streak card, a badge tile, the kind of thing that does well on a
story. It was not built, for three reasons that each stand on their own.

**No image export.** Drawing a card means `react-native-view-shot`, a native
module: a new binary for every store, and no OTA for a picture. The QR code
already went server-side for exactly this reason, and a share card is a bigger
picture with the same cost.

**No new public reads.** `GET /public/profiles/:handle` is the one
unauthenticated endpoint and it hides streak, tokens and tier on purpose. A
"view this post" page for strangers would be a second one, with a post's full
text behind a guessable id. So a post link resolves inside `Stack.Protected`:
sign-in for a stranger, the post for a member — and the sentence carries an
excerpt so the recipient knows what they are being asked to open. Accepted
until universal links land, when the same link opens the app.

**The wording is the product, so it is tested.** `shareText.ts` is pure and
`share.ts` is the only file that touches `Share.share`. Two rules live there:
an achievement carries `inviteUrl`, because "look at my streak" is the moment a
friend tries the app and the referral marker costs nothing; and a token total
never appears — `token-messaging-brief.md` says an achievement, never money,
and a share is the most public sentence the app writes.

One quirk worth knowing: only the web rejects when the sheet is closed
(`AbortError`), and desktop browsers without `navigator.share` reject with
"not supported". `shareLink` treats the first as nothing and the second as
"copy it instead", with a toast — the button never silently does nothing.

## An iPhone's own photos could not be sent, and nothing said why

Every attachment test on iOS failed with "That attachment could not be sent.
Try again." The storage was fine — presign, PUT and the socket send all worked
from a script against the same bucket. The photo was HEIC.

An iPhone camera stores HEIC by default, and expo-image-picker passes HEIC
through untouched even with `quality: 0.8`: its iOS converter re-encodes only
the formats it does not recognise, and HEIC is one it does (`case
UTType.heic: return (rawData, ".heic")`). The server refused `image/heic`, as
designed — browsers cannot show it — and the chat screen folded that 400 into
the same sentence it uses for a dropped connection. Retrying, as invited, hit
the same wall.

Two changes, both small. `pickImageAsset` asks PhotoKit for the
**`Compatible`** representation, so HEIC arrives as JPEG before any of our
code sees it; the avatar pickers do the same, although `allowsEditing` already
had them exporting JPEG. And the media checks now raise
**`UNSUPPORTED_MEDIA_TYPE`** (415) and **`MEDIA_TOO_LARGE`** (413) rather than
`VALIDATION_FAILED`, so the chat and feed screens can say "use a JPEG, PNG or
WebP" or "too large" instead of "try again". The picker also refuses a format
it could not convert — a TIFF, say — with the same sentence, before the round
trip.

The lesson is the one the quota message taught earlier in this file: a catch
that generalises every failure into one string hides the failures that have a
specific fix. The chat screen now logs the code before it generalises.

## Nobody types their city

The profile had a `city` text field, asked for in two forms, matched by the Pro
discovery filter through a fold (`cityKey`) that existed to make "İstanbul",
"Istanbul" and "istanbul" agree — and drawn on **no screen at all**. The store
privacy declaration said "shown on profile", which was simply not true.

Meanwhile the coordinate that answers the same question exactly was already
being stored, coarsened to about a kilometre, for distance.

So the field is gone and the answer is derived: the nearest place in a fixed
list, `$geoNear` against the coordinates already there. That removes the fold,
the free text on both sides of the filter, and the "optional" field that was
blank for almost everyone.

**Three things follow from it, and each is a decision of its own.**

_It is shown, behind a switch._ Showing a derived value is a new disclosure —
worse, one nobody chose. Somebody who turned on location sharing to find people
nearby did not thereby agree to name the town they live in. `privacy.hideCity`
is free, not a Pro feature, and sits with the activity-map preference rather
than with incognito.

_No location, no city._ Cloudflare's free tier gives `CF-IPCountry` and nothing
finer, so the country still comes from the connection and the city cannot. A
user who does not share their location has a country and no city, and does not
appear in city-filtered results. That is stated on the filter screen: a filter
that silently excluded most of the app would read as broken.

_The old values were cleared, not migrated._ A typed string cannot be matched
to a canonical id with any confidence — three Springfields, four spellings, a
country nobody wrote down — and guessing would put people in the wrong place.
`scripts/unset-city.ts` clears them and drops `city_key`, which `ensureIndexes`
would never have removed on its own.

The city list is GeoNames' `cities15000`, CC BY 4.0. The attribution is a
licence condition and lives in three places; `docs/data-sources.md` is the one
that explains why.

## The notification matrix is back, because every cell has a sender now

The channel axis was removed on 30 August with a good argument: nothing in the
app sent mail except verification and password reset, so six of the eight
switches did nothing, and a screen offering a choice which changes nothing is
worse than one that does not offer it.

That argument was about the senders, not about the shape. Building them —
a digest for unread messages, an evening streak mail, a weekly profile-visit
summary, a badge round-up, a campaign script — makes the same reasoning point
the other way. The axis returns, and the rule that keeps a dead switch off the
screen is written down rather than implied: **the email half of a row is
disabled until the address is verified.**

Three stored shapes are live at once and `notificationsAllowed(prefs, kind,
channel)` is the only thing allowed to read them.

- A bare `boolean` for everything is a v1 account. `false` is silence;
  `true` is the defaults, which keeps promotions off.
- A bare boolean per kind is what the app wrote in between. **Push reads it
  literally** — push was the only channel with a sender, so the switch was in
  practice a push switch and a `true` on promotions is a real decision to be
  pushed at. **Email cannot.** Nobody was shown an email option while that
  shape was being written, so nothing in it consented to mail; email falls to
  the default, which is off for promotions.
- A `{push, email}` object is both the retired matrix and what this version
  writes, byte-identical, and both halves are read literally. While no sender
  existed, reading `email` would have been reading a preference filed against
  nothing; now it is somebody's decision. The matrix lived for hours on a build
  that reached no store, so the accounts whose `email` predates a sender were
  counted by hand before this shipped rather than reasoned about in code —
  `scripts/inspect-notification-prefs.ts`.

The write stops at the kind, not the channel.
`settings.notifications.streak.email` is a path _into_ a sub-document, and over
the bare boolean older profiles still hold there is none to enter: Mongo
refuses it outright rather than replacing the boolean. So each touched kind is
resolved and written whole, which is also what migrates it — one kind at a
time, on the first switch its owner touches.

## A message in the foreground is an in-app banner, not an OS one

Phase 10 decided that a push only goes out if the recipient has no live socket:
somebody with the thread open does not need their phone to buzz. What it left
was a gap — somebody with the app open and a message arriving in a _different_
thread was told nothing at all, and on the web, where there is no push, that
was the whole notification story.

The banner fills it, and three things about it were decided rather than
defaulted.

_It replaces rather than queues_, unlike `toast.ts` beside it. A toast reports
the outcome of something the user did and has to be seen, or the app has
silently swallowed an answer. A banner points at the chat list, which already
shows every one of these messages with an unread count. Three quick messages
must not hold the top of the screen for fifteen seconds.

_It obeys the messages/push switch._ It is that channel's foreground face, and
one switch labelled "Messages — Push" has to silence every unsolicited
"somebody wrote to you", wherever it happens to be drawn. The chat list and its
counts still update, because that is data arriving rather than a notification
being sent — and on the web this is the only thing that switch does.

_An OS notification for a message while the app is in front is suppressed and
handed to the same banner._ A heads-up sliding over the app somebody is already
using is the most irritating thing this system can do, and it says nothing the
banner does not. The badge still ticks. Streak, badge and profile-visit
notifications keep the OS presentation: once a day, no in-app equivalent, and
worth swiping away and finding again in the shade.

The read receipt moved from mount to **focus** at the same time, which fixed a
bug that was already there: `chat/[id]` is a hidden tab route and never
unmounts, so returning to an open thread posted nothing and the app went on
believing it was being read. `appActive` is checked separately, because Android
keeps the JS thread alive in the background — the chat screen can be the
focused route with nobody looking at it, and marking a message read there
clears a badge for something never seen.

## One unread number, three places, and the resync that only covered two

The phone showed a dot on the icon, a `1` on the Chats tab and a `5` on the
one conversation in the list, all at the same time and all from the same
field: `conversations.unread[userId]`, which `countUnread` sums for
`/me/unread` and for a push's `badge`. Nothing was counted twice — the three
readers were simply refreshed on different paths, and one of them had a hole.

The chat rows live under `['conversations']`, which `invalidateMissedEvents`
refetches when the app comes back from the background. The tab badge and the
icon read `['unread']`, which sits outside that prefix on purpose: the socket
patches `['conversations']` with `setQueriesData` and the patcher walks
`data.pages`, so a bare number under that prefix would be handed to it and
throw. The consequence went unnoticed. The only things that invalidated
`['unread']` were socket events, and a message that arrives while the phone is
in the background is precisely _not_ one — it is a push. So the row came back
correct, the badge kept the number it had when the app was last awake, and the
icon kept whatever the push had written.

The test that looked like it covered this listed `['conversations', 'unread']`
among the keys it expected to go stale — a key nothing writes, since the
filters are `all`/`unreplied`/`archived`. It passed for the same reason it was
meaningless.

So `invalidateMissedEvents` invalidates `['unread']` too, and the icon effect
is keyed on `dataUpdatedAt` as well as the value: the icon has a second writer
in the push payload, and a refetch that confirms the number it already held
must still overwrite what that push left behind. A gap is a gap for all three.

**And a read on one device is news on your other ones.** `conversation:read`
went only to the other participant, where it means "they have seen it". The
reader's own second device is holding a badge for messages that no longer
count, and it has no way to know: it hears nothing, and the total is the
server's to give. Both emitters now also publish to the reader's own room, and
the client invalidates the badge when it arrives.

## The same number again: eighteen on the icon, three in the app

The icon had two writers and the resyncs covered one gap each — a reconnect
and a return from the background — so a screenshot arrived with `18` on the
home screen and `3` on the Chats tab, taken in the same minute. Two separate
faults, one symptom.

**A push that lands on an app that is already open.** The server skips push for
anyone holding a socket, so this one only happens when the socket is down while
the app is in front — and then the push is the only notice of that message
there is. The OS applies its `badge` (the server's count); the app draws the
in-app banner and, until now, refetched nothing. The chat list, the open thread
and `['unread']` kept what they held before the message existed, and nothing
was left to correct them: the socket never dropped, so no reconnect fired, and
the app never went to the background, so no resume fired. The received-listener
now runs `invalidateMissedEvents`, which is what the rest of the app already
does with a gap the socket left.

**A deleted thread kept its unread count.** `countUnread` excluded the archive
and blocked counterparts, and not `deletedBy` — which `listConversations` and
the unread digest have always excluded. Deleting a thread with two unread
messages left those two in the badge with nowhere to clear them: reading is
what zeroes `unread`, and there is no thread left to open. The count is dropped
at deletion now (every message in it is hidden for that user, so it counts
nothing) and `countUnread` skips deleted threads besides, for the rows already
written. Both halves are needed: `recordMessage` revives a deleted thread when
the other person writes again, and without the first it would come back showing
its old count over the one message the user can see.

## The root overlays carry a paint order, not just a place in the tree

The first iOS device test sent a message while the app sat on another tab and
no banner appeared, though the socket handler ran, the decision was `banner`
and the host mounted. A banner drawn later in the same session, after moving
around the app, was fine.

`AppSplash` had the answer written on it already: its layer carries
`zIndex`/`elevation` with the comment _"over `react-native-screens`, which a
plain later-sibling is not enough for"_. `ToastHost` and `MessageBannerHost`
are the same kind of absolutely-positioned sibling of `<Stack>` and carried
neither, so on native they painted behind the navigator's screen containers in
an order nothing guarantees — which is exactly a banner that is missing, then
present once the stack has changed under it. The dialogs escaped it by being
`Modal`s, which are their own native window. On the web, DOM order alone puts
them on top, so nothing about this was ever visible there.

The three numbers now live together in `src/lib/overlayLayers.ts`: splash over
banner over toast, the order `app/_layout.tsx` renders them in. `elevation` as
well as `zIndex`, because Android orders by the first and iOS by the second.

The banner was hardened at the same time, and that part is belt-and-braces
rather than a diagnosis: it is drawn at full opacity and only its position
animates, so it no longer depends on the first native-driver animation of a
launch having connected. `ToastHost` still fades, which is fine — a fade that
never runs on a layer that paints where it should is a toast that appears
without sliding, not a toast nobody sees.

## Scheduled notifications claim before they send

Every pass writes a row into `notificationLedger` — `_id` is
`<job>:<userId>:<periodKey>` — and the insert failing on a duplicate key _is_
the check. A read followed by a write has a gap, and two half-hourly ticks
landing in that gap is somebody told the same thing twice, which is how a
notification permission gets revoked.

The claim happens **before** the send, deliberately. A send that then fails is
one notification nobody got. A claim that fails to record is one they get again
every thirty minutes until the hour passes.

The period key is not always a day. The unread digest keys on
`stats.lastActiveAt`, which does not move while somebody is away — so a
fortnight of absence is one email rather than fourteen, and coming back and
leaving again is a new key, which is exactly when a second digest is worth
sending. A daily key would have made it the thing an unread-message email is
usually guilty of.

Badges are the exception, and they are on the profile instead:
`stats.notifiedBadgeIds`. The ledger expires its rows after thirty days, which
is right for "already nudged them today" and catastrophic for "they have had
this badge since March" — an expiring row would re-announce every badge every
month. That field is a log of what was sent rather than a second copy of the
badges: it grants nothing and cannot disagree with them. An account it has
never seen is **seeded, not congratulated**, so nobody was notified about a
year of past achievements the day it shipped.

## Profile visits are batched, and the count is the free half

The viewer _list_ is Polyglot's; the count is free. So a push on every view
would hand a free user the paywall's argument several times an afternoon, and
any name in it would give away the thing being sold.

One push a day, carrying a number and naming nobody, landing on `/viewers` —
which draws the free/Pro line itself. One email a week, which may name people,
for the tier allowed to see them. `viewSummarySince` decides that, not either
sender, so the line is drawn in one module; there is a test that Fluent, which
buys other things, still does not get the names in writing.

The daily push has no email fallback, unlike the streak nudge. Somebody with no
phone gets the weekly summary _instead of_ a daily notification, not as well as.

Noon local, eight hours from the streak nudge at 20:00 and two from the badge
round-up at 18:00. The fastest way to make somebody turn all three off is to
let them arrive together.

## Unsubscribe is a signed, non-expiring token on a POST

The link in the footer of a notification email carries its own authority. No
session, no login: somebody who left the app, forgot the password and still
gets mail must be able to stop it, and RFC 8058's one-click is a mail server
following a link with no way to sign in at all.

**It never expires.** A footer sits in an inbox for years and has to keep
working; CAN-SPAM's thirty days is a floor, not a design. The safety is the
HMAC — 256 bits keyed by a 32-character secret, and the worst a replay achieves
is switching off mail its holder already receives.

**Its secret is its own**, not `BETTER_AUTH_SECRET`. The auth secret is what
you rotate the morning a session store leaks, and doing that must not silently
break the legal way out of every email ever sent. `EMAIL_UNSUBSCRIBE_SECRET` is
generated once and never rotated; unset, it falls back and inherits the problem.

**The GET only asks.** Scanners, link previewers and click-protection proxies
all fetch a URL before a human sees the message, so a GET that acted would
unsubscribe people who never opened the mail. The change is on the POST, which
also parses a form body — one-click clients send an empty one, and Fastify
answers 415 for a content-type nothing can read.

**Unsubscribing touches email only.** Somebody stopping mail said nothing about
their phone, and silencing that too would be answering a question they were not
asked.

Everything a notification sender does goes through `sendNotificationEmail`,
which checks deleted, then the preference, then the address, in that order — a
consent check that lives in five places is one that four of them will
eventually get wrong.

## Push stays on Expo's relay, after a day on Firebase directly

For most of 3 September 2026 push went straight to Firebase Cloud Messaging:
a JWT-signed sender on the API, the Firebase SDK on the phone, the APNs key
in Firebase. It worked, and it was reverted the same evening.

The argument for it was "upload nothing to Expo" — builds were going to be
made locally and Expo was going to hold only the over-the-air updates. That
premise changed once Behic used the EAS dashboard: the keystore is in EAS,
builds run in the cloud, and he wants shipping — builds, submissions, updates,
push — managed in one place. With credentials in Expo anyway, the relay costs
nothing and removes the Firebase SDK from the app, the static frameworks from
iOS, and one more credential from the server.

So the revert is deliberate, not a rollback of something broken. What the day
left behind is worth keeping: the runbook's check that a service account can
reach FCM (`400 INVALID_ARGUMENT` on a fake token), which still proves the
key Expo is handed is a working one before any build exists; and the lesson
that `expo-notifications` and the Firebase SDK both hook the same iOS delegate
and should not share a build.

## A resume refetches what the socket missed

The socket is the only realtime channel and nothing replays it. A phone in the
background has no JS running and no connection; a message sent then reaches
the server, becomes a push, and never becomes a `message:new`. On the first
iOS device test, tapping that push opened the right thread with the message
missing — `chat/[id]` was already mounted as the hidden tab and kept its
cached pages, and nothing anywhere invalidated them. `useNotificationRouting`
only navigates, `markConversationRead` only touches the list, and TanStack's
`focusManager` is not wired to `AppState` on native, so `refetchOnWindowFocus`
had never once fired.

Two signals say a gap happened, and `useSocket` listens for both: the app
coming back from the background, and the socket's Manager reporting a
reconnection after a drop while the app was open. Both invalidate the
`['conversations']` and `['messages']` prefixes and nothing else. Only active
queries refetch — the mounted chat list and the one thread the hidden tab
holds — so the "every loaded page" cost the `message:new` handler refuses to
pay per message is paid once per gap.

Three other places were considered and passed over. The routing hook covers
the tap and nothing else; the chat screen's focus effect would refetch every
loaded page on every navigation; a `focusManager` wiring would refetch every
mounted screen on every foreground. Only `background → active` counts as a
resume: `inactive → active` is the notification shade or Face ID going away a
second later, the socket never dropped, and on iOS that happens far more
often.

Left as it was: the ~45 s after a resume during which the server may still
see the old socket in the user's room, so a message sent in that window gets
neither a push nor a delivery stamp until the ping timeout. That is fan-out
semantics, not this bug.

## Shipping lives on expo.dev, and only tests live on GitHub

Behic's call on 3 September 2026, after a day of weighing the alternative:
builds, store submissions and over-the-air updates are EAS workflows in
`apps/mobile/.eas/workflows/`, started from Expo's dashboard or by a push to
`main`. GitHub Actions keeps `ci.yml`, and since 5 September 2026 the one
workflow that turns a version tag into a Release page — see _The version is two
numbers_ below. The API and the web
build are unaffected — Fly and Cloudflare Pages are still deployed by hand,
see the runbook.

Two things decided the shape of the workflows.

_Updates are automatic, builds are not._ A merge to `main` publishes an OTA
update for nothing; a cloud build is the metered thing. So the only workflow
on a push trigger is the update, and `release.yml` is `workflow_dispatch` with
a platform input. Somebody spends a build on purpose, not because a README
changed.

_Production updates were manual too, at first._ An update reaches every store
install at once, so publishing was a deliberate `eas update --channel
production` after the matching build had shipped. That step is gone — see
_One update channel, and merging is releasing_ — and what replaced it is
below, because removing the human without replacing the guard would have been
the worst of both.

## The runtime version is a fingerprint, so merging can release

The manual production publish was a person standing in for a check the tooling
was not making. `runtimeVersion` was `{ policy: 'sdkVersion' }` — one number
for the whole of SDK 57 — so a commit that added a native module left the
runtime at `exposdk:57.0.0` and its JS would still have been offered to a
store binary without the module. The manual step was what stopped that, and it
stopped it by being slow rather than by knowing anything.

`{ policy: 'fingerprint' }` hashes the native layer itself: the native
dependencies, the config plugins, everything `expo prebuild` would produce. A
commit that changes the binary changes the version, and the update is then
offered to nobody — a mismatched phone sees no update and keeps the bundle it
shipped with. The check the human was performing is now a property of the
version, which is the only reason every merge may publish straight to
`production`.

This landed a day after the channel merge rather than with it, and for that
day `main` published automatically with `sdkVersion` still in place — the
guard removed and its replacement not yet written. Nothing shipped through the
gap.

It is paid for once. 2.0.0 (121) was built under the old policy, carries
runtime `exposdk:57.0.0`, and can never match a fingerprint: the first store
release is unreachable over the air. The next build is not. A bad JS-only
update is still undone with `eas update:rollback`.

## Every v1 account has a v2 `user` row before its owner comes back

Behic's call on 3 September 2026, after the question "can an old user get in
through forgot-password?" turned out to have the answer "no, and nothing tells
them so".

The staged v1 data — `legacyProfiles`, `handleReservations` — was keyed on a
hash of the email, and no `user` row existed until the person signed up again.
That was a sound way to avoid carrying plaintext addresses, and it made the
one route people actually try a dead end: Better Auth's reset endpoint looks
the address up in `user`, finds nobody, and by design answers "check your
email" either way. The password bridge in `routes/login.ts` would have caught
the same person had it been on, but it needs Appwrite credentials the server
does not have, and it was only ever a stopgap. The real way in was to sign up
again with the old address and click the verification link, which nobody
guesses from a sign-in screen.

So `scripts/precreate-v1-users.ts` opens a `user` row for **every** v1 Auth
account, and the row is **verified** from the start with **no credential**
behind it. Three consequences, all intended:

- "Forgot password" now works: the reset finds the row, mails the link, and
  the new password is the first credential the account ever has.
- Google and Apple link onto the row. This is why it has to be verified —
  Better Auth refuses to link a social sign-in onto an unverified local user,
  and rightly so, since that rule is the defence against a password account
  squatting on someone else's address. There is no password here to squat
  with, so the defence is not needed and the address is proven by the very
  act that first uses the row.
- Signing up fresh with the address is refused as "already exists", which is
  what we want — the old profile belongs to this row and a second account
  would strand it. The sign-up and sign-in errors now say what to do instead.

**Amended 8 September 2026: the sign-up that gets refused now finishes the
journey anyway.** Behic's point, and it is the obvious one once said aloud:
`langx.io/welcome-back` opens with "You have to sign up again", the app's
sign-up screen is where somebody who has been away a year starts, and both led
to a mail whose advice was "go to a different screen and reset a password you
never had". Three screens to get back into an account that was waiting.

So `onExistingUserSignUp` asks what the account _is_ before it writes: a row
the script opened that still has no password gets `existingAccountLinkEmail`,
carrying a magic link, and the sign-up ends where it was trying to go. Every
other account keeps the reset mail.

The predicate is both halves — pre-created **and** still passwordless — and the
second half is the one that matters. An unrequested sign-in link mailed to an
account whose owner chose a password is a way around that password, at a
stranger's keystroke; the reset screen is the answer there. For a row with no
credential there is nothing to go around, and the link is the same bargain
`requestPasswordReset` already makes with anyone who types an address into the
forgot-password form: single-use, a quarter of an hour, delivered only to the
inbox entitled to it.

What was **not** done, and why: letting the sign-up actually attach a password
to the row. It is the literal reading of "let them in through sign-up", and it
hands the account to whoever knows the address. The row is `emailVerified` from
the start — it has to be, for Google and Apple — so a credential written onto
it would be usable before the verification mail was opened. Keeping the row
unverified until then trades one takeover for another: anyone could then
un-verify any v1 row on demand and break its owner's Google sign-in. The link
proves the address without minting anything.

The mail is chosen from the account, never from the sign-up body, so whoever
types an address does not get to pick which letter its owner receives.

Whether v1 had verified the address is reported, not filtered on: an
unverified v1 address still cannot do anything with the row until a reset
link arrives at it.

The row is written by a script, so the `user.create.after` hook that stamps
the terms and restores a profile never fires for it, and neither a reset nor a
social link creates a user. The first _session_ is the event those routes
share, so `session.create.after` does both for rows carrying
`precreatedFromV1` — idempotently, since sessions are made on every sign-in —
and is a single indexed read for everyone else. The consent is stamped then,
not by the script: a consent dated to a moment nobody was present for is not
one, and continuing past the sign-in screen is the same act the social
providers already count.

Accounts their owners deleted in v1 — Appwrite `status: false`, which is what
v1's "delete account" set, since it never hard-deleted — get no row: a deleted
account must not come back as a live one. Behic wants those 837 addresses
kept for **one** announcement, so the script writes them to
`v1DeletedContacts`, the only place a v1 email is stored in the clear. That
mail is to people who ended their relationship with the product, so it is
one mail, with an unsubscribe, and the collection is dropped afterwards —
keeping it would turn a courtesy into a list. That send is
`scripts/send-v1-deleted-announcement.ts`: it claims each row before the
batch goes out, so a re-run cannot mail anybody twice; its unsubscribe link
carries the `v1contact` scope, which has no preference to switch off and
simply forgets the address; and `--drop` removes the collection only once
nobody is left unsent.

Appwrite is still running and is the only place the plaintext v1 emails live;
the script needs it.

With every v1 account holding a row, the password bridge — `POST /auth/login`
asking v1 to check an old password, then creating the v2 account with it —
lost its reason to exist and was removed the same day. It had never been on
in production anyway: it needed `APPWRITE_*` on the server, which was never
set, and it was the one path that forwarded a password to another system.
The sign-in screen now calls Better Auth alone. If it goes away before the script has run, the rows
cannot be opened and this whole path is lost — see the runbook.

## An account without a photo gets a drawn face, not its initials

Two initials on one of three fills is what a photoless account used to look
like. In a discovery list that is a column of coloured squares with letters on
them, and most accounts in a fresh install have no photo — so the wall of
squares was the ordinary case, not the edge one. A face is recognisable, and
being generated from the account id it is the _same_ face on every screen and
every device until a photo replaces it.

**DiceBear's Notionists, rendered by our own API.** The style is one import: it
draws line-art faces that read at the sizes this app uses, and swapping it
later is a one-line change, not a migration, because nothing is stored.

Not Gravatar, and not DiceBear's hosted API. Both put a third party between the
device and a picture of our users — Gravatar additionally on a hash of their
email address — and `docs/store/privacy-data-safety.md` promises exactly one
third-party SDK. The library is MIT and runs on our own server.

Not a client-side SVG renderer either. That means `react-native-svg`, a native
module, so a new binary for a picture and nothing that can ship over the air.
The QR route already settled this question the same way, and this follows it
exactly: SVG from the API, drawn with `expo-image`.

**Mild gender steering, resolved on the server.** `male` raises the beard
probability, `female` removes it, and the two private answers — `other` and
`undisclosed` — get DiceBear's untouched defaults, so an account that declined
to say is drawn from the same pool as one that was never asked. Notionists'
hair variants are unnamed (`variant01`…`variant63`), so the beard is the only
lever the style names outright, and taking more would mean hard-coding
somebody's idea of which numbered hairstyle is which gender.

The gender is read from the account by the route, never sent by the caller.
Most of the DTOs that feed an avatar — a feed author, a chat partner, a
leaderboard row — carry no gender at all, so a `?g=` parameter would give the
same person a beard on one screen and none on the next.

Two consequences follow, both deliberate. An id nobody holds gets a face and a
200 rather than a 404, because with a lookup behind it a 404 would answer
"does this account exist" one id at a time. And the cache is a week rather
than `immutable`, because the picture is no longer a pure function of its URL —
gender is writable, at most once every `GENDER_CHANGE_COOLDOWN_DAYS`, and a
cache-busting parameter would have to carry the very field this keeps off the
wire. A week is well inside the cooldown, so a changed gender is reflected long
before it can change again.

The onboarding photo step shows that face too, where it used to draw a single
letter on a flat circle — the one screen whose whole question is "a photo, or
the face we made you" was the one screen answering it with something nobody
would ever see again. Skipping is now a visible choice of avatar rather than an
empty slot left behind.

## Sign in with an emailed link: the link opens the app, and the app spends the token

Added 5 September 2026. Every v1 account exists here as a verified `user` row
with no password (the entry above), so a returning person had two doors: a
password reset, or Google/Apple. An emailed one-tap link is the lighter one,
and for those rows it is exactly the right shape — a verified address and
nothing else is what a magic link authenticates.

Better Auth's `magicLink` plugin is used, with three decisions layered on it.

**The mail carries a page, not the endpoint.** The plugin's own `url` is a
GET on this API that spends the token and sets a session cookie on whatever
made the request. Two things make that GET before a human does: mail
scanners and previewers (`routes/email.ts` records the same lesson for the
deletion link), and the mail client's browser — which would be the thing
signed in, not the app; `verify-email-success.tsx` documents that failure for
the verification link. So `sendMagicLink` ignores the plugin's URL and mails
`magicLinkUrl(token)`: `https://app.langx.io/magic-link?token=…`. On a phone
with LangX that host is a universal link, so the tap opens the app and the
app calls `/magic-link/verify` itself, the way `reset-password` already
spends its token — and the session lands in SecureStore. Without the app,
the web build serves the same route; there the page shows a button, because
link previewers do run JavaScript, and a tap between them and the token is
what keeps the link alive. A scheme link (`langx://magic-link?token=…`) is
offered from that page for the phones where the https link opened a browser
anyway: an Android build whose app link is not verified, a link pasted into
Safari.

**`disableSignUp: true` is the load-bearing line.** At its default the
endpoint creates an account for any address it is handed, around the terms
tick-box and the age gate that sign-up has. With it on, an unknown address
gets no mail and the same `{ status: true }` as everyone else — Better Auth's
own `requestPasswordReset` shape — so the endpoint answers "is this address
registered" to nobody. The handle rewrite that lets people sign in with
`@handle` covers this endpoint too.

**Failures are a redirect, so the API gives them somewhere to land.** The
plugin never answers a failed verify in JSON; every one is a redirect to
`errorCallbackURL?error=…`, whose default is the API root, i.e. the 404
handler. The app passes `/auth/magic-link/failed`, a route that answers 400
`INVALID_TOKEN` — one code for expired, used and unknown alike, on purpose —
and `errors.ts` already maps that to "no longer valid". One more thing the
client does by hand: the base client's session listener does not include
`/magic-link/verify`, so after a successful verify on the web the screen
notifies the store itself; native's Expo client already did.

Tokens are stored hashed (`storeToken: 'hashed'`) and live fifteen minutes,
single-use. `magicLink.test.ts` pins the URL shape, the unknown-address
silence, single use, the failure route, expiry, and the pre-created v1 row
getting in and being settled on that first session.

## Device sign-in: claim first, a scheme link in the QR, and a cookie the plugin does not set

Fixed on 3 September 2026, after "that code is no longer valid" turned out to
be the answer to every approval ever attempted from the phone. Three separate
faults sat on the path between the browser showing a code and the phone
approving it, and none of them was the expiry the message described.

**The claim.** Better Auth's device plugin will not approve a code until a
signed-in `GET /device?user_code=` has attached it to an account. The screen
called `approve` straight away, so every attempt came back
`DEVICE_CODE_NOT_CLAIMED`. The claim runs first now, and its response — which
names the client asking — is only returned to the account that claimed, so the
confirmation can say what is being approved. The single failure message stays
deliberately vague across expired, used and unknown codes, so guessing a code
learns nothing.

**The session.** `/device/token` is an OAuth endpoint: it answers with a bearer
token and nothing else. Nothing in this app sends an `Authorization` header —
every client is cookie-based — so even a correct approval left the browser with
a 200 and no session. A `hooks.after` middleware in `auth.ts` writes the
session cookie for the session the plugin has already created. It is scoped to
that one path; everything else that creates a session sets its own.

**The QR.** It encoded an `https://` link to the web app. The picture is scanned
with the phone's own camera, and the phone is where the session already is —
so the link opened a browser on that same phone, signed in as nobody, which is
the one place the approval cannot be given. It encodes `langx://link-device`
now (`deviceLinkTarget` in `packages/shared`), which the installed app resolves
to the approval screen. No native code, ships over the air. Not a universal
link on the web host: that needs `.well-known` served from a host that still
answers with v1, which is an infrastructure move rather than a QR change. Some
Android cameras ignore custom schemes, so the typed code stays the primary
path. It was eight characters — the plugin's default, not a choice; three
comments and a placeholder even claimed six — and on 5 September 2026 it
became **five**: 32⁵ ≈ 33.5 million codes, two minutes of life, five tries
per window on `/device`, and a code that only ever grants what the approving
phone already has. Five is what a person reads off one screen and types on
another without a second look. The same day the app gained its own scanner:
a scan icon beside the gear on the Me tab opens `(app)/scan.tsx`
(`expo-camera`, a native module — the build that ships it is the one that
ships share-as-file), reads the `langx://link-device` QR and lands on the
approve screen with the code filled in, or a profile/invite QR and lands on
that profile. Approve or deny stays a human decision on the approve screen.

**`freshAge: 0`.** The same screen lists where the account is signed in, which
is also the only feedback that an approval landed, since the device it signed
in is somewhere else. Better Auth puts `/list-sessions` behind a 24-hour
freshness check by default, so a phone that signed in last week could not open
the list at all. Zero turns the check off. Revocation uses the
authoritative-session check, not the freshness one, and is unaffected; the only
other fresh-gated endpoint is `/unlink-account`, which the app never calls.

All of it is covered end to end in `routes/deviceFlow.test.ts`, including the
case as it was lived — approve without claim — and a test that fails without
the `freshAge` line.

## The age gate went from 18 to 16

LangX launched v2 as 18+. The number came from v1's published Terms and from
the reasoning in `age.ts`: at 18 neither COPPA nor GDPR's Article 8 can apply,
so nothing about parental consent ever had to be built. The store docs went a
step further and predicted that unrestricted chat plus user photos would rate
17+/18+ on both stores, "which matches the age gate".

The questionnaires came back 13+ on Apple and Teen on Google. That is a rating
of the content and says nothing about who may hold an account, but it made the
question unavoidable: 18 was a choice, not a constraint. Behic lowered it to 16
on 3 September 2026.

Why 16 and not the 13 the stores suggest: Article 8 lets each EU state set its
digital-consent age between 13 and 16, and several chose 16. At 16 no country
in the EU or UK needs a parental-consent flow; COPPA covers under-13s and stays
irrelevant. 13 would have needed consent flows in half of Europe and the extra
duties that come with minors on a stranger-to-stranger chat. 16 needed a
constant, a handful of sentences and a Play Console declaration.

Two things did not change. The arithmetic is still whole years from the birth
year, so somebody who turns 16 in December is admitted in January; the strict
version was possible and is still not adopted. And nobody already inside was
affected — lowering a floor only admits people. The one visible side effect is
in `legacyRestore.ts`, which treats an under-age v1 birth date as a missing
field: v1 holders aged 16 and 17, bounced back to onboarding until now, can
finish the restore.

The lesson is about the docs, not the number: a prediction about what a form
will say should not be written as if the form had been filled in.

## One update channel, and merging is releasing

Mobile shipping arrived with two channels. `preview` took an over-the-air
update on every merge to `main` and fed internal APK installs; `production`
was reserved for store builds and nothing ever published to it, on the
argument that an update there reaches everyone at once.

Behic removed the split on 4 September 2026: one channel, `production`, and
every merge to `main` publishes to it automatically. The staging tier was
buying very little. Nothing had shipped to a store, so `production` had never
carried a single update, and the only installs on `preview` were a handful of
test devices. The cost of the split was a release step that had to be
remembered by hand and a second set of profiles and workflows to keep honest.

What it costs instead: what merges is what ships, for JS changes, with no
stage in between. `release.yml` still needs a decision because a native build
does, but a JS regression now reaches users on their next launch. That is the
trade, and it is only defensible while the tests are the gate.

Removing the split also uncovered why it had never worked. `EXPO_PUBLIC_*`
values are inlined into the bundle when it is built, an update job builds on
EAS from a fresh checkout with no `.env`, and `eas.json`'s `env` blocks belong
to build profiles that an update job never reads. So every update published
before this change was bundled with `EXPO_PUBLIC_API_URL` unset, and
`resolveApiUrl` only rewrites loopback in development. Each one shipped
`http://localhost:4000` to whoever installed it. Nobody caught it because the
device tests ran against the binary, which had the URL compiled in from the
build profile, and an OTA overwrote it only on a later launch.

The fix is `environment: production` on the update job plus the variable in
the EAS `production` environment. A local export proved both halves: without
the variable the Android bundle contains `http://localhost:4000` and no
`api.langx.io` at all.

One more trap on the way, worth writing down because it wastes an hour
silently. Metro caches transforms, and the inlined value is part of one. An
export re-run with the variable corrected returned a byte-identical bundle,
still holding the old address. `--clear` is required whenever an
`EXPO_PUBLIC_*` value changes.

## The version is two numbers, in one file, and a tag makes the release

Behic's call on 5 September 2026, after the settings footer on the web read
`LangX 0.0.0`. The number came from `expo-application`, which reads it off the
installed binary and returns null where there is none, and the fallback for
null was the placeholder. Fixing the footer raised the wider question of where
the version lived, and the answer was five places by hand: `app.config.ts`,
four `package.json` files, and nothing that would have noticed them drifting.

Now it lives in the root `package.json` and nowhere else is written; the
release script keeps the workspace packages in step, and `app.config.ts`
imports the root copy, so the store binaries, the web build and the request
headers all ship it.

**It is `major.minor`, not semver.** `2.0`, then `2.1`. Every merge to `main`
already reaches installed apps over the air without a number changing, so a
patch level would be a number that never means anything — the third digit of
`2.0.4` would say "some merges happened", which the update id in the footer
already says exactly. A version now changes when someone decides a release is
worth naming, and both stores accept two digits as a version name.

pnpm does not, quite. `pnpm install` takes `2.0` on a private package, but
`pnpm deploy` — the step that turns `apps/api` into the Fly image — matches
`@langx/shared@workspace:*` by semver, and `2.0` matched nothing: the first
deploy after the two digits reached the workspace manifests failed with
`ERR_PNPM_NO_MATCHING_VERSION_INSIDE_WORKSPACE`. So the three workspace
`package.json` files carry `2.0.0`, the same number with a `.0` that nothing
reads, and `pnpm release` writes it there. The root copy is what the version
is; the trailing zero is what pnpm needs.

**`pnpm release minor` is the whole ceremony.** It bumps the number, commits
`Release 2.1` and tags it `v2.1`; pushing the tag makes the GitHub Release
(`.github/workflows/github-release.yml`), with notes generated from the pull
requests since the last tag. The script does not push, because `main` is
protected and the release commit goes through a pull request like everything
else. The workflow refuses a tag that does not match `package.json`, so a tag
typed by hand cannot name a version nothing ships as.

This bends _Shipping lives on expo.dev, and only tests live on GitHub_ by one
workflow, and deliberately not further: the tag makes a Release page and
nothing else. A store build is metered and stays a decision made on expo.dev.
A tag could start `release.yml` there, and the day that is wanted it is one
trigger away; until then a new number on `main` reaches the stores when
someone builds, and the web when someone deploys.

What was considered and passed over: reading the version off a git tag in
`app.config.ts` (EAS builds from an archive without tag history, so the number
would be wrong exactly where it matters), and release-please (a full bump
automation that needs every commit message in the conventional format, which
this repo's are not).

## Six attachments, a field beside the old one, and one unit of quota

A message and a post carry a list now. Three decisions hold it up.

**`attachments` sits next to `media` rather than replacing it.** Every binary
in the wild writes and reads a single `media`, and cannot be updated in step
with the server; so do the 3,604 messages the v1 import brought over. The send
schemas rewrite a `{ kind, media }` body into the new shape, every new write
fills `media` with the first file, and everything reads through
`attachmentsOf`. An installed app therefore keeps working and shows the first
photo of a gallery — the honest degradation, and visibly better than an empty
bubble. Migrating the collection and dropping the field is a change of its own,
with no deadline attached: the duplicated field costs a few bytes a row and
nothing else.

**Six, matching `PLAN_LIMITS.maxPhotos` on a profile.** One number to remember
rather than two that differ for no reason. It is not a cost control — the
per-file ceilings are — it is what keeps a gallery a gallery instead of an
album, and it bounds how many video players one row can allocate.

**One message is one unit of `mediaPer24h`, however many files it holds.** The
two-take pronunciation answer already established this, and for the same
reason: charging per file makes the second take feel expensive and it stops
being recorded. Bytes are billed by the byte, so the per-file ceiling is the
control that actually bounds storage. A voice note still cannot ride along with
pictures — two recordings can, because that is the answer's two takes — since
mixing kinds would make a message's type, and so its preview line and its
notification, a coin toss between "photo" and "voice message".

## The one thing this server converts: a browser's voice note

A note recorded on the site did not play on an iPhone. The bubble showed `⋯`
and never resolved — not the "this will not play" the app already had a string
for, which made it look like a network problem rather than a file the phone
could not open.

Two faults, and they had been covering for each other.

**The file really was unplayable.** `webRecordingType` prefers `audio/mp4`
where a browser can produce it, and that preference had never once been
reached: it labels what came _out_ of `MediaRecorder`, while what goes _in_ is
`RecordingPresets.HIGH_QUALITY`, which names `audio/webm` for the web and which
expo-audio passes straight through. So every browser note was Opus, honestly
labelled and undecodable on iOS. `useVoiceRecorder` now asks for
`audio/mp4;codecs=mp4a.40.2` where `isTypeSupported` says yes — Chrome from 126
and every Safari — which is free and shortens the path.

**And the bubble read a dead player as a loading one.** When AVFoundation fails
an item it reports `isLoaded: false` _and_ `isBuffering: true`: its "am I
buffering" test asks whether the item is neither likely to keep up nor holding
a buffer, and a failed item is both. `audioProgress` read that as `'loading'`.
It reads `playbackState === 'failed'` first now. The `'unsupported'` branch
beside it was dead in a more embarrassing way — it asked the _server's_
allowlist whether the platform could decode the type, and `audio/webm` is on
that list precisely because a browser has no other output, so the one case the
check existed for was the one case it answered wrong. `canDecodeAudio` takes
the platform.

**And the label was not even true.** The note that started this was stored as
`audio/m4a`, under a `.m4a` key, with WebM/Opus inside — 2,243 bytes for three
seconds, which is not a bitrate AAC has. An older web build labelled every
recording `audio/m4a` whatever `MediaRecorder` had produced, so the one
attribute anything downstream could check was the one that had been guessed. A
conversion keyed on `contentType` would have walked straight past it, and the
first run of the backfill found nothing at all. So the server fetches every
voice note and decides on its first four bytes — EBML or `OggS` — which also
means it never has to recognise the formats that are fine. The converted file
then lands on the key it came from, and the delete-the-original step is skipped
when that is the same key, because otherwise it would delete what was just
written.

**Firefox still records WebM, so the server converts.** `docs/architecture.md`
says media is stored exactly as uploaded and that stays true of everything
else; this is the exception, and it is affordable for the same reason video is
not. A two-minute note is under a megabyte and an Opus→AAC pass is about a
second of CPU, against a video's tens of megabytes and minutes.

Synchronous, inside the send, rather than a job: a queue would need a claim
across two Fly machines, a second socket event for chat, and something the feed
does not have at all — there is no `post:*` event, so a post's note would stay
wrong until its reader happened to refetch. Converting before the insert means
the row is right the first time anything reads it, and the cost is latency
inside the twelve seconds the client already waits for its ack. ffmpeg gets
eight of them.

It never fails a send. No ffmpeg, a timeout, bytes that cannot be read back:
the original is stored, exactly as before any of this existed, and the bubble
says what it now says correctly. That is the same bargain every optional
service in `self-host.md` makes. The old original is deleted only _after_ the
new object exists — a leaked file costs bytes, and the other order costs the
note.

`scripts/transcode-web-notes.ts` does the same to the rows already stored. It
walks four collections in two shapes: `messages`, `posts` and `postCorrections`
keep a list with the first file repeated in `media`, while a pronunciation
answer keeps `media` and `slowMedia` as separate fields — which is also the
page most likely to have been recorded in a browser in the first place.

## The row swipe runs on the UI thread, and Reanimated is the price

Three comments in this repo argued against exactly this change —
`SwipeableRow`, `ui/Skeleton` and `MessageBubble` all said that Reanimated 4
was a dependency nothing imported and that pulling it in would put its worklets
bundle into the shipped web build. The reasoning was sound and the conclusion
has been reversed, so all three are rewritten rather than left to contradict
the code beside them.

**What the JS-thread version actually cost.** `translateX.setValue(...)` ran on
the JS thread for every finger move while the release spring ran with
`useNativeDriver: true`. The drag was bridge-bound and the settle was not, so
the row lagged the thumb and then caught up in one jump — on the same thread
that re-renders the list, which on the chats tab is doing real work. The
capture threshold compounded it: 12px had to be travelled before anything
moved and nothing gave those pixels back, so the row started behind the finger
and stayed there. `MessageBubble`'s swipe-to-reply had a fault the row did not:
its `translateX` was `setValue`-driven, spring-animated on the native driver,
**and** read by a JS-side `interpolate` for the reply arrow — the classic "this
animated node has been moved to the native side" mismatch, which is why the
arrow stopped following after the first swipe.

**Velocity was the missing half.** `settleOffset` was distance-only: past 40%
of the drawer it opened, and with two actions that drawer is 168px, so it asked
for 67px of travel. A natural flick moves the thumb perhaps 60px before it
lifts, and the row sprang shut on a gesture that felt decisive — which reads as
the swipe failing, not as a threshold missed. It now takes the release velocity
too, and that single argument answers most of the complaint. It is plain maths
and stays tested without a renderer, as does all the other geometry.

**What it costs.** The web bundle, measured with `expo export --platform web`
before and after: 3,595,072 → 4,639,644 bytes raw, 915,242 → 1,116,102
gzipped. About 200 KB gzipped, 22% more. That is the price the three comments
were protecting against and it is real; what changed is the other side of the
trade, once the gesture was understood to be janky rather than merely
old-fashioned. `Skeleton` and `Button` keep RN's `Animated`: the bundle is paid
for either way now, and a pulse and a press are not gestures that track a
finger.

**It needs a new binary.** `runtimeVersion` is `{ policy: 'fingerprint' }`, and
`react-native-gesture-handler` is a native module, so installed apps are
offered no update at all until a build carrying it ships — the same constraint
`expo-video` had, and it belongs in the release note.

**And then it crashed the app.** The paragraph above used to end "those
functions are worklet-safe as written, which is why the move cost no logic".
That sentence was wrong, and it shipped: 2.0.0 (125) aborted on the first
swipe, anywhere in the app. The TestFlight report (incident 37EFEA45, iOS
26.6.1) is `EXC_CRASH (SIGABRT)` with a stack that names every step —
`RNGestureHandler handleGesture:` → `REANodesManager dispatchEvent:` →
`UIEventHandlerRegistry::processEvent` → `worklets::runSyncOnRuntime` → Hermes
`throwPendingError` → `abort`.

`react-native-worklets/plugin` auto-workletises `Gesture.Pan().onUpdate` and
`.onEnd` — they are in the plugin's own list of builder methods — so those two
callbacks are compiled to run on the UI runtime. A plain function they call is
captured as a stub that throws when invoked, and a JS exception on the UI
runtime has no handler above it: it leaves Hermes as a C++ exception and
terminates the process. There is no red box even in development, and nothing
in the type system says a word about it.

So the rule, which is the whole lesson: **anything a gesture callback calls is
a worklet and needs the directive** — `rowTranslation`, `settleOffset`,
`swipeTranslation` and `swipeReleased` all carry `'worklet'` now. On Node the
directive is an inert string, so the tests that made this code look proven
still run unchanged — and that is exactly why they proved nothing here. What
was missing was one swipe on a device: the simulator build in the tree and the
last device build both predated the commit.

## A video is one file, and playing it needs a new build

**No thumbnail.** The obvious build is a poster image uploaded beside the
video, and it costs exactly what the second voice-note take would have cost: a
field on `Media`, a second presigned upload, a second `assertMediaAllowed`, and
a ruling on whether the pair spends one unit of quota or two. `expo-video`
holds the first frame already — a paused player _is_ the thumbnail — so the
whole feature is a `VideoView` that has not been told to play.

**Two ceilings, sixty seconds and sixty-four megabytes.** Either alone lets the
other through: seconds alone admit a 4K minute at several hundred megabytes,
bytes alone admit a long heavily-compressed clip nobody scrolls past. A minute
is a sentence being demonstrated, which is what this is for; longer is a video
call, and that is a different feature and out of scope.

A duration over the ceiling is `MEDIA_TOO_LONG`, not `MEDIA_TOO_LARGE`. A
sixty-one-second clip of six megabytes is not large, and the answer is to trim
it rather than to re-encode it — the same argument that split
`UNSUPPORTED_MEDIA_TYPE` out of `VALIDATION_FAILED` one entry above. Duration
is also _required_ for a video, unlike audio: a recording is made by us and
always carries its length, where a video arrives from a picker, and a ceiling
that can be bypassed by omitting a field is not a ceiling.

**mp4 and quicktime, not webm.** iOS has no VP8 or VP9 decoder at any level, so
accepting webm would store files half the recipients cannot open with nothing
anywhere saying why. `audio/webm` is accepted only because a browser's recorder
has no other output — and that turned out to be the same bug wearing the other
hat, which the entry below is about; the video picker hands us whatever the
camera wrote, so it has no such excuse. The same `preferredAssetRepresentationMode: Compatible`
that fixed HEIC does the second half of this on iOS: it makes PhotoKit export
an HEVC `.mov` as H.264, without which an iPhone-to-Android video is a black
frame.

**The feed autoplays, and the thread does not.** This entry used to argue
against autoplay everywhere, on the grounds that "a thread of clips that all
start as they scroll past is somebody's data allowance and somebody else's
quiet carriage". That reasoning was never about video, it was about a
conversation — and it still holds for one. A feed is a different act: it is
scanned rather than read, and a still frame behind native controls in a scanned
list reads as a video that is broken, which is exactly how it was reported.

So `VideoBubble` has two modes. The feed and a post's own attachment get
`'preview'` — muted, looping, no controls, playing only while the post is more
than 60% on screen and the tab still has focus, with a tap opening it full
screen with sound through `PhotoViewer`. A thread keeps `'controls'` and never
autoplays, and so does a list of corrections or answers, where several clips
would start at once. Muted and on-screen-only is what makes the data cost
defensible; unmuted or off-screen would not be.

The same change fixed something older and quieter: `MediaGallery`'s
single-attachment branch returned a `VideoBubble` that had no `onPress` prop at
all, so a one-video post — the ordinary case — could not be opened full screen
anywhere, while a video in a multi-attachment grid could.

**It needs a build, and the runtime version is what makes that safe.**
`expo-video` is the first native module to arrive since _The runtime version is
a fingerprint_ landed, and so the first thing that guard actually stops: under
the old `sdkVersion` policy, merging this would have published a bundle to
store binaries that do not contain the module, and the first video bubble would
have crashed on an import. Now those phones are offered no update at all and
keep what they shipped with, until a build carrying `expo-video` replaces it.
That belongs in the release note either way — nobody sees video until they
install a new binary.

## The browser signs in when the phone says so, and the phone sees it happen

**The session store has to be told.** Better Auth's client refetches
`useSession()` after a fixed list of its own endpoints — sign-in, sign-out,
change-password and so on — and `/device/token` is not on it, nor does the
device-authorization client plugin add a listener of its own. So the QR screen
was doing the one thing that looked right and was wrong: the poll succeeded,
the cookie was set, `router.replace('/')` ran, and `index.tsx` saw a store that
still said signed out and sent the browser to the welcome page. Every approval
from a phone ended on the page that asks you to sign in. The fix is the one
`magic-link.tsx` already carries for the same reason — `notify('$sessionSignal')`
— plus a rule the magic link does not yet follow: **navigate only when the
session is actually in the store**, from an effect that watches it, with a
spinner in the meantime. The old comment claiming the guard "flips as soon as
the session query sees it" was describing the bug.

**Approving does not create the session.** The plugin marks the code approved;
the _browser_ creates its session on its next poll, up to one interval later.
The phone's device list refetched once, the instant the approval returned, and
so always ran before the row existed — the laptop appeared only after leaving
the screen and coming back, or, if the person dismissed the alert slowly
enough, sometimes at once, which is the kind of intermittency that gets filed
as "flaky". The list now keeps asking on the browser's own rhythm until a row it
has not seen before shows up, says so while it waits, and highlights the row
when it lands. The poll interval came down from five seconds to two — it is the
delay between "yes" on the phone and signed-in on the laptop, and the traffic
is one signed-out browser asking one small question for at most two minutes.
The client reads the interval off the `/device/code` response rather than
assuming it, since polling faster than the server allows earns `slow_down`.

## The hourly gift is rolled on the server and never touches a leaderboard

**Why a gift at all.** The store had nothing in it that did not ask for
something. A small free thing once an hour is a reason to open the wallet
that is not "I want to spend", and the numbers are sized so that it stays a
small pleasure rather than an income: about 11 tokens an open on average, nine
in ten at 30 or under, an outright empty box a third of the time, and 250 once
in a thousand. Somebody opening every hour of the day tops out near 270 —
beside the 200 that messages pay at their daily cap — so it cannot out-earn
practising by much even for the most devoted opener. `maxClaimsPerDay` is
reserved in the rules for the day that turns out to be wrong.

**The server owns both halves.** Whether a gift opens is one conditional
`findOneAndUpdate` on `profiles.lastGiftAt` whose filter _is_ the cooldown
check, so two devices opening at once cannot both win and there is no
read-then-write window. What it holds is drawn from `node:crypto` _after_ the
claim, so nothing the client sends can steer it; the distribution itself is a
pure function in `packages/shared` (`rollGift`) with the tier table beside the
other rules and a statistical test pinning its shape. The client only ever
sees a result. A refusal answers `RATE_LIMITED` with `retryAt`, which the app
writes straight back into its wallet cache — the card was stale, and the
refusal is the correction.

**A grant kind, not an award.** Gift tokens credit the all-time bucket only,
like the sign-up bonus and the referral payouts, so the week, month and year
tables never see them. The leaderboard ranks practice, and a table that could
be climbed by opening boxes on the hour would be ranking alarm clocks. For the
same reason a moderation freeze consumes the hour and pays nothing — the act
happens, the payout stops — and an empty gift writes no ledger row, because
"you received nothing" is not a transaction.

**Shake is decoration on a button.** The gift box is a `Pressable` first; the
accelerometer, when it arrives, only calls the same handler. That keeps the
screen usable with a screen reader, on the web build, and on a binary that does
not yet carry `expo-sensors` — the store build that adds the sensor and the
haptics ships behind this, and the hooks it fills in are already there with the
shape it needs. The copy says "tap" until the hook reports the sensor is real.
The words are the token brief's: a gift, never a prize, never a spin.

## Three native modules in one build: the shake, the buzz, and the review sheet

**They travel together because a build is the expensive part.** `expo-sensors`
(shake to open the hourly gift), `expo-haptics` (the tap you feel when it
opens) and `expo-store-review` (the OS's own "rate this app" sheet) each need
a binary, and each on its own would have been a store submission for a small
thing. The gift screen shipped a build earlier with a tap and two stubs shaped
for these; this batch fills the stubs in. Under the fingerprint runtime policy
the bundle carrying them reaches only the new binary — the old one keeps
tapping.

**The shake is still decoration on a button.** `useShake` reports `available`
only once the accelerometer is actually subscribed, and the copy says "shake"
only then; the box stays a `Pressable` everywhere, so a screen reader, the web
build and a simulator all keep the same control. The threshold and the
debounce are pure functions in `lib/gift.ts` with tests, not numbers inside a
sensor callback.

**The review sheet is rationed by us before the OS rations it.** iOS shows it
at most three times a year however often it is asked, and neither platform
says whether it showed. So the rules in `lib/reviewPrompt.ts` spend those asks
on purpose: a streak milestone the day it lands (which days, from the shared
`streakMilestones` table — a milestone is a reward just received, on a day
somebody came back for), or the 3rd, 25th and 100th correction written on this
device (helping somebody is the product). Never twice in one version, ninety
days apart, never a guest, never on web. The ask is recorded _before_ the
sheet, because the OS may decline silently and asking again tomorrow would
spend the same ration twice. Settings → About gets a plain "Rate LangX" row
that opens the listing itself — a row somebody taps on purpose must always
lead somewhere, and the sheet cannot promise that.

## Fluent to Polyglot: the store swaps the plan, the paywall says what will happen

Until 5 September 2026 the paywall disabled the tier held and nothing else.
A Fluent subscriber tapping Polyglot ran the ordinary first-purchase call on
every store, and a Polyglot subscriber could buy Fluent underneath. On iOS
that happens to work — both products sit in one subscription group and
StoreKit swaps them — but Play opens a second subscription beside the first
unless it is told which one is being replaced, and RevenueCat's web checkout
has no notion of replacing at all. Nobody had been through the scenario, and
the screen said nothing about it either way.

What a tap means is now one function, `planChangeFor` in `packages/shared`,
with four answers. **Covered**: the tier held or a lower one — disabled, with
"Included in Polyglot" above Fluent, since a downgrade is the store's own flow
and buying less for more is not a thing to offer. **Upgrade**: a paid plan
bought on this platform's store. iOS calls `purchasePackage` as before and the
group does the rest; Android passes `StoreProductChangeInfo` with the product
being left (from `activeSubscriptions`, `rc_promo_*` grants skipped, base
plan stripped) and `CHARGE_PRORATED_PRICE`, so the difference is charged for
the rest of the period — the same outcome Apple produces on its own, which is
why one sentence describes both. The web goes to RevenueCat's portal, where
upgrades are immediate with a refund of unused time; the SDK's `purchase`
would have started a second Stripe subscription. **Elsewhere**: a plan bought
on another platform's store — disabled, with a sentence naming where to change
it, because the alternative is two subscriptions and one very reasonable
refund request. **Buy**: the free tier, or a promotional grant.

The last case is the v1 loyalty gift, and it is the one that needed the
harness fixed rather than the paywall. Nothing sold the gift, so nothing can
prorate against it: a gifted Fluent buys Polyglot outright, holds both at
RevenueCat, resolves to Polyglot while it runs (`ENTITLEMENT_PRECEDENCE`) and
is back on Fluent — not free — when it lapses, because `EXPIRATION` reconciles
against the subscriber record and the promotional `pro` is still there. The
fake store used to keep one record per subscriber and a purchase overwrote the
grant, so this could pass in production and fail on every laptop; it now holds
the two separately and answers a second purchase with `PRODUCT_CHANGE`, and
`billingTestStore.test.ts` walks the whole sequence through the real webhook
handler. Two smaller things followed. A lifetime holder was offered "Manage or
cancel" pointing at a store subscriptions page with nothing on it, and now is
not; and the paywall tells them the gift stays underneath whatever they buy.

`inspect-lifetime-cohort.ts` answered the question the thresholds had been
carrying as a comment: against production's staged records, exactly ten
wallets clear the Polyglot line (the tenth holds 37,821, the threshold itself)
and 88 more clear Fluent's. `packages/shared/src/billing.test.ts` pins both
numbers, since the API's tests read them back from the constant and would have
stayed green through any edit.

**The screen that knew all four answers still opened on the wrong one.**
`planChangeFor` decided what a tap means, and nothing decided what the paywall
should be showing when it opens: the tier segment was seeded `'pro'`, so every
Fluent subscriber arrived on Fluent, read "Included in Fluent" over a disabled
button, and had to find the second segment to learn that a higher plan existed
at all. `firstOfferableTier`, in the same file, is the answer — the first entry
of `PAID_PLAN_TIERS` whose change is not `covered`, which is Fluent for a free
account and Polyglot for a Fluent one. It is _derived_ on the paywall rather
than seeded into `useState`, beside the period it already sits next to, and
that is not a style preference: `useEffectiveTier` reads the `me` query and
answers `free` while it is in flight, so a seeded initial state freezes a
subscriber onto the wrong tier on any cold load of `/paywall` — a reload, a
shared link — and never moves off it. The same reasoning renames the row in
Settings, which now says "Upgrade to Polyglot" to somebody who has already
bought the plans, and gives the Me tab's card a second face: the free version
keeps the quota line, because the limit is the argument, and the Fluent one
drops it, because there is no limit left to quote. `planChange.test.ts` pins
the four cases; the button reads "Your current plan" over the tier held, and
only over that one, since a lower tier is covered too and has its own sentence.

**Coming back from the web portal is a signal, and it was being thrown away.**
A web upgrade happens in RevenueCat's portal, which `Linking.openURL` opens in
another tab; the promise resolves the moment that tab exists and knows nothing
about what was done in it, and the plan change arrives at the server as a
webhook. So the screen sat on a stale tier until something else refreshed it —
in practice until the subscriber found "Restore purchases", which is the wrong
control for a change they just made. The paywall now arms a ref when it sends
someone to the portal and spends it on the next `AppState` `'active'`, which
react-native-web raises from `visibilitychange` when the original tab is looked
at again, calling the same `/billing/refresh` reconcile a purchase and a
restore already call. Once, and only for someone who actually left: a blocked
popup means nobody went anywhere, the ref stays armed, and the cost is at worst
one idempotent request the next time the tab is hidden and shown.

## The yearly price is chosen backwards from the monthly one

The paywall leads a yearly plan with what it costs a month, and the app never
computes that number — it prints the store's own `pricePerMonthString`, because
a price shown to a customer has to be the store's, formatted and converted by
the store. At $49.99 a year that string was **$4.16**. Nothing was wrong with
it; it was simply the remainder of a division nobody had designed for, sitting
in the largest type on the screen.

So the price moved instead of the code. Pick the monthly figure the design wants
and work back: $4.99 a month is $59.88 a year, which Apple does not sell — the
price-point endings are `.99`, `.00`, `.90` and `.95`. The `.90` at the same
dollar is the one that survives: `59.90 ÷ 12 = 4.99167`, printed as **$4.99**
whether the store rounds or truncates. `$59.99`would print`$5.00`, which is
the near miss worth writing down, because it is the number a dashboard offers
first.

The cost is that the fine print carries the odd ending — "7 days free, then
$59.90 a year" under a $4.99 headline — and that is the right way round: the
clean number belongs on the figure people compare between plans. Fluent's
advertised saving also fell from 40% to 29% when the yearly price rose to
$59.90, and nothing was edited to say so. `yearlySavingPercent` recomputed it
from the store's two numbers, which is the entire reason it does not read a
constant.

Each storefront needs the same treatment separately, since no single conversion
lands on a round monthly figure in every currency; the hand-tuned Turkish prices
were removed on 7 September 2026 so that monthly follows the stores' own
conversion everywhere and the yearly price is the only one edited per territory.
`planSaving.test.ts` asserts the division for the US pair, so a dashboard edit
that breaks the rule fails a test instead of shipping — the only place in the
repo where a real price is written down, and it is written down as an assertion.

## A report now reaches a person, and the mail is never the thing that fails

`reports` had no reader. The row was written, three distinct reporters could
freeze somebody's earning, and nobody was told any of it — a report of
harassment sat in a collection until someone thought to look. The moderation
console is still P2, so `POST /reports` now mails `SUPPORT_EMAIL` with both
parties, the reason, the whole `details` text and the ids it was raised from.

**It cannot fail the request.** `POST /feedback` lets a failed send become a
500, and that is right there: nothing is stored, so the mail _is_ the report
and a silent 202 would be a lie. Here the row and the freeze are already
written before the mail is built. Turning a mail provider's bad minute into a
500 would tell somebody their report failed when it did not, and invite a retry
that files it twice. So the send is awaited, its failure is logged, and the
answer is still 201.

The mail says whether this report crossed `REPORTS_TO_FREEZE_XP`; the response
still does not. Those are different audiences — see _a blocked user's profile
is 404_ for why the reporter is not one of them.

## The tracker gets a link, not a token

`POST /feedback` used to open the GitHub issue itself, with a
`GITHUB_ISSUE_TOKEN`. Two things were wrong with that, and the second is why it
is gone.

A fine-grained personal access token that reaches an organisation's repository
is subject to that organisation's maximum-lifetime policy, so it cannot be made
to live for ever. And `openFeedbackIssue` answered `null` on every failure —
correctly, since a tracker being down must not tell somebody their report
failed — while logging nothing at all. Put together: the token expires one
morning, issues quietly stop being opened, and the only trace is a line in the
support mail that reads like a configuration note. That is exactly how it was
found, by hand, a day after it had stopped working.

The support mail now carries a prefilled link to GitHub's own `/issues/new`
form — title, body and label already in it — and a person presses Submit. No
credential lives in this service, nothing expires, and the words that become
public are reviewed by someone before they do. A GitHub App would have solved
the expiry alone; it would not have solved anyone being able to file straight
into a public tracker from a form in the app.

The link drops its `body` parameter past 6000 characters, since GitHub answers
414 to a long enough URL and a 2000-character report in Cyrillic or Arabic gets
there. The title and label still land, and the text is in the mail the link
arrived in.

## A paid report says so, on both channels, whatever the settings say

`awardTokens` notified nobody. Confirming a bounty wrote a ledger row, and the
person who had written up the bug found out by opening their wallet and
noticing a bigger number.

The award now sends a push and an email, and **neither asks a preference**.
Every other push in the codebase checks `notificationsAllowed` first and every
other email goes through `sendNotificationEmail`; this is a receipt for tokens
already in the ledger, the same class of thing as the account-deletion
confirmation. Turning it into a seventh notification kind would have meant a
switch in Settings whose honest label is "do not tell me when I am paid".

Both are sent, rather than the email being a fallback for a missing device the
way the streak reminder's is: a phone that is off should not cost somebody the
record of the payment. The trigger is `result.awarded`, so the ledger's unique
index on `{userId, kind, refId}` is what makes it exactly once — a second press
of the same link pays nothing and says nothing.

## A campaign is queued, and the API drips it out

`send-campaign.ts` used to send from the laptop in one sitting: read the
audience, claim a batch, hand it to Resend, sleep 700 ms, repeat. Correct,
and wrong for the first real send — 3,901 v1 accounts plus 837 deleted ones
from a domain that had been sending twenty mails a day. Mailbox providers
rate a sender on what it did yesterday; that burst would have been throttled,
and the throttle does not know a verification link from a broadcast.

So the script now writes the campaign into `campaignQueue` and the
notification scheduler sends it: a day's budget from
`CAMPAIGN_WARMUP_PER_DAY` (1000, 4000, 8000), spread over the
half-hour ticks left in `CAMPAIGN_SEND_WINDOW_UTC`, so a process restarted at
noon carries on at the right pace rather than starting the day over. Two
instances are serialised through `jobRuns` on the tick's half-hour — that is
about pace; `emailCampaigns`' unique claim is what still makes double mail
impossible. `--pause` stops the next tick and `--resume` continues from the
claims. A campaign finishes when a tick finds nobody left who is not merely
deferred.

Deferred, because there is now a **marketing frequency cap**:
`MARKETING_MIN_GAP_DAYS` between two pieces of promotional mail or push to
the same person, on any channel, from any sender. Campaigns record
themselves in `emailCampaigns` and promotional passes claim under
`promo.<job>` in the ledger, so `recentlyMarketed` is two indexed reads.
Somebody inside the gap is not claimed and not skipped; the next tick after
the gap sees them again.

And an **`emailSuppressions`** list, keyed by address, which every sender
reads before every send — service mail included. It exists because two
writers have nothing but an address: the unsubscribe route, acting for a
pre-created v1 row whose owner pressed the link before ever onboarding
(there was no profile to switch anything off on, so the route answered
success and did nothing, and the profile they created later was seeded with
v1's consent as if they had never said no), and Resend's webhook, which
reports a permanent bounce or a spam complaint about a mailbox we should not
write to again. `createProfile` checks it before seeding the v1 consent. A
transient bounce is deliberately not on it: a full mailbox is a bad day, not
a dead address.

## A security notice has no switch, and no unsubscribe

Somebody could sign in to this app from a stranger's laptop and nothing
would say so. Four events now do: a sign-in from a device the account has
not been seen on, a password change (including a reset — an attacker with a
stolen inbox is exactly who the mail is about), and a sign-in method
connected or disconnected.

**None of them asks a preference**, and both channels fire rather than one
falling back to the other. The reasoning is the bounty receipt's: a setting
whose honest label is "do not tell me when somebody signs in as me" is not
one to offer, and an attacker who has the phone must not be able to keep the
mail from arriving. So no `notificationsAllowed` check, no
`sendNotificationEmail`, no `List-Unsubscribe` header — it is not a list.
The mail carries the device, the country the edge reported and the time in
UTC (labelled as such: guessing a timezone from an IP is how a notice tells
somebody in Toronto they signed in at an hour they were asleep), and one
button, to the screen that changes the password and signs every other device
out.

**"A device we have not seen" is its own collection.** The obvious source
was `session`, and it is wrong: those rows expire in a week, so a person who
signs in every fortnight would be told every fortnight that their own phone
was new — which is how a security mail becomes the one people filter away.
`knownDevices` is keyed `<userId>:<fingerprint>` with no TTL, so the insert
failing is what says "seen before", and two sign-ins racing each other
produce one letter.

The fingerprint is deliberately coarse — `ios-safari`, `android-chrome`,
`ios-app` — because a browser version bump is not a new device. It comes
from about forty lines of regex rather than a user-agent library: those
carry a pattern database the size of this app's whole i18n catalogue in
order to tell Chrome 118 from Chrome 119, which is the one distinction being
thrown away here.

All of it hangs off a single Better Auth `after` hook keyed on
`ctx.context.newSession` rather than on a list of sign-in paths, because
that list is exactly the thing a future plugin would silently add to. A
sign-up is excluded: being told you signed in seconds after creating the
account is noise. Nothing thrown inside is allowed to reach the caller —
these fire on the response to a correct password, and a mail provider having
a bad minute must not turn that into an error page.

## Six nudges, one pass, one at a time

The remarketing scenarios could each have been a pass, the way the digest and
the visit round-up are. They are not, and the reason is arithmetic: the
candidates are the same people every time — everybody with `promotions.email`
on — and what separates the scenarios is two or three fields on a profile
that has already been read. Six passes would have been six collection scans
every half hour in order to send, on most ticks, nothing.

So `promotions.ts` is a **table**, walked in order for each candidate, and
the order is the priority: photo, streak repair, 7 days away, 30 days away,
idle tokens, invite. The first one that matches is sent and the loop breaks.
`MARKETING_MIN_GAP_DAYS` then keeps the next one a week off, so somebody who
qualifies for three hears one, and hears the second only if it is still true
next week. The list is a queue of things worth saying, not a list of things
to say at once.

Two choices inside it are worth naming. The **streak repair sits under the
`streak` switch, not `promotions`** — it is about the streak, the repair is
one sentence, and somebody who asked for streak reminders asked for exactly
this; putting it behind the marketing switch would have hidden it from the
people it is for. And the **away nudges key on `stats.lastActiveAt`**, which
does not move while somebody is away — the same trick the unread digest uses,
and what makes "we miss you" one letter rather than a daily one.

The push half is not a fallback for the mail and not gated on it. Somebody
with the app installed and promotions on asked for both, and the mail is
often the one that is never opened.

## The newsletter is monthly, and its editorial half is a pull request

A weekly recap was the obvious cadence and the numbers rule it out: a week of
a language exchange is three conversations and a correction, which reads as
an accusation rather than a summary. Monthly, at ten in the morning on the
reader's own clock — and on **any of the first seven days**, not only the
first, because a deploy that slipped would otherwise skip a month silently
and the ledger claim already makes a second send impossible.

Two halves, and both are load-bearing. The personal numbers are the reason to
open it; the community numbers are the reason to come back, because they are
true whether or not the reader was there. A month somebody sat out swaps the
personal half for a single sentence rather than printing three zeroes at
them.

Nothing new is stored to compute any of it. `dailyActivity` already holds a
row per person per day with the two numbers a recap wants — it exists to cap
the daily pool — and `tokenAggregates` already has the month's tokens.
Summing thirty small rows is cheaper than a second running total that could
disagree with the first.

**The editorial half is written by a scheduled routine and approved by
merging its pull request.** The alternative — an admin screen, or a note
typed into a database — would have put the one piece of user-facing copy this
app sends outside review, outside git, and outside the eight-language
catalogue that every other string lives in. A month with no merged note still
gets its recap; the numbers are the part that is always true. See
`src/email/newsletters/README.md`.

## Promotional email is opt-out now, and the published copy moved with it

This reverses a decision recorded above. Promotions used to be off on both
channels, with the argument that consent to be marketed at has to be given
rather than withdrawn. On 10 September 2026 the owner decided otherwise:
everybody is on the mailing list, and the unsubscribe in every message is the
way out. Three profiles had promotional email on at the time, so the
alternative was building a remarketing programme and a newsletter for three
people.

I raised the objection and it is worth keeping written down: a pre-ticked box
is not consent under GDPR, CASL asks for consent too, and the practical risk
is not a regulator but deliverability — spam complaints land on the domain
that also carries the verification links. Behic reaffirmed it. What the
decision bought in exchange is that the list is real; what it cost is that
the app now has to be _very_ good at the unsubscribe, which is the rest of
this entry.

Three things did not move:

- **Push stays off.** Nobody asked to be buzzed at by marketing, and it is
  the intrusive channel.
- **An explicit refusal wins over everything.** `opt-in-everyone.ts` changes
  only profiles that `notificationsUntouched` recognises — every set of
  preferences this codebase has ever written on somebody's behalf, which now
  includes the pre-flip default. Somebody who opened Settings and left
  promotions off had already answered; re-adding them is the one thing worse
  than never having asked.
- **A suppressed address gets nothing**, whatever its profile says. That is
  what makes an unsubscribe pressed before onboarding survive the account
  being created afterwards.

And the published copy had to change **before** the script could run, because
a default-on list under text that says "off unless you ask" is a false claim
rather than a stale one: the Settings row in eight locales, and
`docs/legal/promise-change.md`, which describes the default out loud.

## The app speaks for itself from a profile row, not a message type

`@langx` and `@copilot` are accounts. They could have been a `system` message
type with a flag on it, and every consideration pointed the other way: a
conversation with the assistant has to sort, unread-count, translate, archive,
delete, push and render exactly like a conversation with a person, and all of
that already exists for profiles. A parallel system-message world would have
had to re-earn every one of those behaviours, and would have got one of them
subtly wrong.

What follows from that choice is the rest of this entry.

**They are created at boot**, right after the indexes, rather than by a
migration or a seed script. A migration is a thing somebody has to remember to
run; boot is a thing that happens. So a fresh self-host, a test database and
production all have the accounts, and nobody has to be told to make them. It is
idempotent on `handle_unique`, and a handle already held by a real account is
left alone and logged loudly — `copilot` was only reserved once these accounts
were designed, so a database that predates that may have somebody sitting on
the word, and taking it off them would be a data loss no index would catch.

**Nobody can sign in to them.** The Better Auth row carries an address under
`.invalid`, which RFC 2606 reserves and DNS resolves nowhere. That is stronger
than a flag saying "do not allow login": there is no mailbox for a reset link,
a magic link or a verification mail to arrive in, so the account cannot become
a session by any route the app has, including ones added later.

**The assistant is an optional service**, like email, storage and translation.
Without `ANTHROPIC_API_KEY` it is off and says so; the welcome message and
announcements are unaffected, because those are ours and not the model's. The
provider sits behind an interface so the orchestration is tested against a fake
— which account answers, the daily ceiling, what the tools write, what a
failure says — and no test needs a key or a network.

**Official conversations are outside the token economy.** `awardForSend`
returns early for either side of an official pair, so talking to a program pays
nothing, moves no streak and reaches no leaderboard. `startConversation` charges
no initiation quota, because spending one of five daily slots to ask a question
— or to report somebody — would price support out of the free tier.

**An account already answering as LangX is adopted, not replaced.** Production
had a real account on `@langx` — the support address, a bio of links, five
conversations, two dozen messages — which is precisely the thing this feature
automates. Renaming it would have broken every link anybody had been given, and
`ensureOfficialAccounts` will not take a handle from a profile it did not
create, by design. So adoption is its own script, run once by a person: it
keeps the history and takes away the sign-in, because "nobody can sign in to an
official account" is a property of the design rather than a rule with an
exception in it. The side effect is that the support address goes back to being
only a mailbox, which is what it should have been.

That is also why the display name, the avatar and the bio are rewritten from
code on every boot rather than only at creation: an adopted account arrives
wearing whatever it was wearing, and after adoption there is no screen left
that could change it.

The one thing the accounts are _not_ is a second authorisation story. The
assistant's two tools are the flows that already existed: `report_user` is the
call the profile menu makes, and `submit_feedback` is the call `POST /feedback`
makes, lifted out of the route unchanged. The reporter is always the person
writing — not a rule the model is asked to honour, but the only id the call can
be given.

## The feed and the wallet get switches of their own

Two kinds joined the six: `social` — a follow, a correction or a recorded
answer on a post, a batch of likes — and `wallet`, for the daily pool paying
out and the hourly gift coming back. Both default to push on, email off, and
neither has an email sender.

They are not folded into the kinds that already existed, and the reason is
what a person means when they turn one off. A message is somebody addressing
you directly and waiting; the feed is the room reacting to something you left
in it. Somebody who mutes one very often wants the other, and a shared switch
makes that choice unavailable. `wallet` is separated from both for a simpler
reason: it is the only kind that is about a number rather than a person.

**The feed sent nothing at all before this**, which was the largest hole on
the channel and the most expensive one: a correction is the whole product,
and it arrives while its author is somewhere else.

Three throttles carry the design, and each is the answer to a specific way
these become the notifications people mute:

- **One push per post per hour.** Three people correcting the same sentence
  within a minute is the good case, not the rare one.
- **Likes are a daily batch, never an event.** A like is the cheapest thing
  anybody can do here, so a post that does well would otherwise be twenty
  buzzes about twenty taps.
- **One follow notice per follower, ever.** Unfollowing and following again
  is not news.

The pool push is read from `tokenLedger` by a pass rather than sent by
`runDailyPool` itself, and that is deliberate: the pool pays at a fixed UTC
hour, and being buzzed about tokens at four in the morning is worse than not
being told. The pass picks each person up when it is nine where they are.

## Three-letter usernames, and what the floor was actually protecting

`HANDLE_MIN_LENGTH` was four; on 10 September 2026 it became three, which is
`HANDLE_PATTERN`'s own minimum. Claiming and reading now agree on length, and
the only thing left between the two schemas is the reserved list.

Two arguments had held the floor up, and neither survived being looked at.

The first was route collisions: a profile lives at `/<handle>`, short names
are the ones a future page will want, and `api`, `www` and `app` are all three
letters. True, and answered by the wrong mechanism. `RESERVED_HANDLES` is what
stops a collision, `routeLiterals.test.ts` fails CI when a screen is added
without reserving its name, and a four-letter route — `chat`, `feed`, `post` —
is exactly as much of a collision as a three-letter one. The length was a
proxy for a check that already exists and is stricter.

The second was squatting, and it was a guess. Nobody has squatted anything
here; what the floor did instead was refuse the handle to every person whose
name is three letters, which is a great many people in Turkish, Chinese and
Korean.

Dropping it made four words claimable that had never been reachable before, so
they are reserved now: `pro`, which is a page on langx.io rather than a screen
in this tree and so is invisible to the route test, and `dev`, `ftp` and `git`
beside the hostnames already there. Numbers-first names like `404` were never
possible — `HANDLE_PATTERN` requires a letter first.

The reading schema does not move, because it never could: v1 handles came
across under a three-character rule, so a three-letter account has existed all
along. What changed is that somebody can now be given one on purpose.

## A refusal is worth remembering, and a correction is worth a digest

The last two scenarios in the plan, and both were blocked on the same kind of
thing: the code knew something momentarily and threw it away.

**`consumeQuota` refused people and forgot.** "You keep hitting the free
limits" is the one nudge here that is an argument for paying, and it needs to
tell a person who ran out once from a person who runs out every evening —
which nothing recorded. `quotaRefusals` is a rolling three-day array,
written inside `consumeQuota` rather than at the three call sites that catch
its `false`: that is where the refusal is _decided_, so the fourth caller,
whenever it arrives, gets this for free rather than being the one that forgot.
Three refusals in three days is the threshold — once is Tuesday, twice is a
coincidence. Free tiers only: a paid tier has no limit to hit, so the array
can only be stale, and somebody who upgraded yesterday must not be sold the
thing they just bought.

**`social.email` had a switch and nothing behind it.** The feed's push fires
on the reply and is throttled to one an hour; the digest is the other half,
and the two answer different questions. A push says _something happened, look
now_. A digest says _here is what the day amounted to_ — which is the one
worth reading when the corrections are the reason somebody posted at all. It
goes in the evening, because a sentence posted in the morning has had the day
to be answered and a correction is something people sit down with.

The letter carries counts and the opening words of the reader's **own**
sentence, never the correction itself. The unread digest withholds message
text for privacy; this withholds it for a different reason — a mail that
already contains the answer is a mail nobody clicks, and a correction is
worth seeing beside the sentence it corrects.

With a sender behind it, `social.email` now defaults **on**, like `messages`.
A switch that was off because it did nothing should not stay off once it does
the thing people joined for.

## The app keeps what it says, not only that it said it

`social.ts` throttles the reply push to one per post per hour and explains
why in a comment that ends _"the rest are waiting in the app"_. They were
not. Nothing stored them. A person could write a sentence, have it corrected
by three strangers, get one push, read it on a lock screen and swipe it away,
and there was no screen anywhere that could tell them what the other two had
said. The same hole swallowed every like — batched to a daily push by design,
because a like is one tap — and every follow after the first.

So there is a `notifications` collection now, and a bell in the Feed header
over it. Four things about its shape were decisions rather than defaults.

**It is per event, where the push is batched.** Three comments are three rows
even though they were one push. The throttles were never about volume being
uninteresting; they were about a phone buzzing three times, which is how a
notification permission gets revoked. A list somebody chose to open interrupts
nobody, so the reason does not apply and the rows all stay. Not one sender,
ledger claim or throttle changed to make room for this.

**It is not gated by the notification switches.** `notificationsAllowed` is
never called on the write path, and the badge write in `badges.ts` sits
deliberately _above_ the `wantsPush`/`wantsEmail` check with a test pinning it
there — because moving it below reads like tidying and would quietly make the
centre a ninth switch nobody agreed to. Those eight kinds have two channels,
push and email, and both are about what **leaves** the app. Somebody who
turned social push off asked not to be buzzed at. They did not ask never to
find out.

**Uniqueness is ninety days long, not eternal.** `{userId, kind, refId}` is
unique and the insert failing is the check, the same trick as everywhere else
here — but `ttl_90d` removes the row that carries it, so unfollowing and
refollowing next season is news again. That would be a bug in
`notificationLedger`, whose whole job is "we already told them, ever", and it
is correct in a feed, which is the clearest statement of why the two are
different collections rather than one with a flag.

**The wire carries data, never prose.** Every push in this app is composed
server-side because the OS draws it; an inbox row is drawn by a component that
has all eight catalogues, so the row ships an actor and a count and the app
writes the sentence. A count assembled on the server would be English grammar
wearing eight translations — and `{count} people looked at your profile` needs
a plural entry, which Russian splits four ways and Arabic six.

Three things were deliberately left out. **Chat messages**, because the Chats
tab already is that inbox and folding them in would bury everything else under
them. **The hourly gift**, because "your gift is ready" is a statement about a
button being available rather than a record of something that happened, and a
row saying it was ready three days ago is noise in a list meant to be scanned.
And **who viewed you** — the visit row is a count with no actor, because
identities are the paid half of that feature and a row carrying a name and a
face would hand the paywall's argument out to everybody. That one also had a
second, quieter reason: a per-day row whose count grew would have to be
_updated_, and a row that moves inside a keyset page makes a cursor skip or
repeat, which is the exact failure `dateIdCursor` exists to prevent.

Badges and profile visits are written inside their existing scheduled passes
rather than at a source, because neither has one: a badge is derived from
counters and never stored, so the pass that diffs `notifiedBadgeIds` is the
only thing in the system that knows one was earned. Both therefore inherit
their pass's hour — a badge earned at breakfast appears that evening. The
pool payout does have a real source, `awardTokens` saying it paid, so its row
lands at 04:00 with the money while the push still waits for 09:00 on the
reader's own clock. A record and a phone buzzing are different things, and
only the second has an opinion about what hour it is.

## Ten comments are one piece of news, and reading is not marking

Two things were wrong with the notification centre the day after it worked.

**A pile of replies was a pile of rows.** Ten people commenting on one
sentence produced ten rows, which is faithful and useless: the screen exists
to be scanned, and a list that repeats itself ten times cannot be. They
collapse now — one row per `{kind, post}`, reading "and 9 others" — while a
follow never does, because each one is a different person and the row opens
that person rather than the pile.

The grouping is done when the list is **read**, in an aggregation, and not by
keeping a counter on a single row. A counter is the obvious design and it is
the wrong one here for a reason this codebase has already paid for once: a row
whose count grows has to move its `createdAt` to be noticed, and a row that
moves inside a keyset page makes a cursor skip or repeat — which is exactly
why the profile-visit row is insert-only. So the cursor points at the group's
newest member and the `$match` for it runs after the `$group`.

The unread count had to learn the same trick, and that is not a detail. It was
a plain `countDocuments`, which would have put **10** on the badge over a list
with one thing in it. A badge that disagrees with the screen it leads to is
worse than no badge: it sends somebody looking for nine things that were never
there. It filters blocked people for the same reason.

**And opening the list marked it read.** That was convenient and quietly
destructive: somebody who came to check one name had thereby dealt with the
other eleven, and the only record of what they had not looked at was gone.
It is a button now — hard right in the header, and drawn only when there is
something to clear, because a control that can do nothing should not be on
screen.

Making it explicit deleted more code than it added. The dots read `read`
straight off the row again, so the sticky set that kept them visible through
the automatic mark, and the fetch-timestamp latch that stopped that mark
firing before the page it was marking had arrived, both went. Both were
careful, both were tested, and both existed only to hold up a behaviour that
turned out to be the wrong one.

## A tap is what marks a notification read

Opening the centre marks nothing, and for a while a **Mark all read** button
was the only thing that did. That was better than the automatic version it
replaced, and still wrong in its own way: most people never press a button
like that, so the badge becomes a number that is always on — and a number
always on stops being read, which eventually trains people not to look at the
bell at all. An explicit control was the right instinct applied to the wrong
half of the problem.

So a tap reads the row it opened. The count then means "things not yet dealt
with" and falls as they are dealt with, which is the only reading of a badge
that survives contact with somebody who uses the app every day. The button
keeps its job — the leftovers, the ones being deliberately ignored — and is
drawn only when there are any.

A tap reads the **whole pile** behind the row, not the one document the row
was named after. The row already said nine other people commented; leaving
eight of its members unread would put the badge straight back up for something
the reader has demonstrably just looked at. Server-side that is the same
grouping rule the list uses, which is why `markNotificationsRead` takes a row
id rather than a list of them and resolves the group itself — and why it scopes
the lookup by `userId` as well as `_id`, so an id belonging to somebody else
matches nothing instead of reading their inbox for them.

## Two machines, one socket bus

On 3 September 2026 the API went from one Fly machine to two, so a crash-loop
would be a degradation rather than an outage. The paragraph above had said,
since the first deploy, that going past one machine needs a Socket.io adapter
first. It did not get one.

What that looked like from a chat: two people, two browsers, the first message
arrives instantly and the reply never does — until a refresh, which fetches it
over REST and shows it was there all along. Not one direction: whichever
direction crossed the machines. Socket.io's default adapter keeps every room in
the process's own memory, and Fly's proxy hands each new WebSocket to whichever
machine it likes, so the two participants held sockets on different machines
about half the time. `io.to(userRoom(x))` on the machine that took the send
reached nobody on the other. The `message:new` was gone, and so was everything
else on that path: the delivered tick (`fetchSockets()` saw no recipient, so
none was stamped — and a push went out to somebody who was sitting right
there), typing, and the read receipt. The client's "resync on reconnect" never
fired because the socket had not dropped; it was connected, healthy, and
listening on the wrong machine.

The one-instance test suite could not see it, because with one process every
room lookup happens to be local. `ws/crossInstance.test.ts` boots two API
instances over one database — production's shape — puts one participant on
each, and asserts all four paths. All four failed before the fix and pass
after it.

The fix is `@socket.io/mongo-adapter`: every emit is written to a
`socketEvents` collection and every instance tails it with a change stream,
so a broadcast reaches a socket held anywhere. Mongo rather than Redis because
Mongo is already here and is already a replica set (Better Auth needs one),
which is what a change stream needs — no new service, no new secret. A TTL
index, declared in `db/indexes.ts` like every other, expires the rows after a
minute: nothing replays them, and a `fetchSockets` answer carries each socket's
handshake, session cookie included, so they should not linger. That cookie is
the one thing to know about the collection — it is the same token the
`session` collection already holds in the same database, so it widens nothing,
but it is there.

`fetchSockets()` is a cluster-wide question now and can time out (5s) when a
machine that answered a heartbeat in the last ten seconds has since died —
a blue-green switch is exactly that. `fanOut.ts` catches it: the emit has
already gone out, and what is lost is one message's tick and push. The adapter
also reopens its change stream a second after every close for as long as it
lives, so `attachSocketServer` closes it in an `onClose` hook — a test that
closes the Mongo client without that gets a failed reopen every second, forever.

One semantic shift came with it, and the test suite is where it showed. A
broadcast used to be synchronous: whoever was in the room at the instant of
the emit got it, nobody else ever would. Now it is written first and delivered
a moment later — locally on the next tick after the insert, remotely when the
change stream catches up — so a socket that joins the room inside that gap is
handed what was just broadcast to it. In the tests, that was the conversation's
opening message (sent over REST before the sockets connected) arriving on a
socket that had been waiting for the _next_ one; the waiters now say which
event they mean. In the app it is a duplicate the client already discards by
id, since the same echo reaches the sender's own socket by design.

## Signing in navigated and reconfigured the navigator in the same breath

Every sign-in on Android ended on a red screen. `SurfaceMountingManager` threw
`addViewAt: cannot insert view [328] into parent [348]: View already has a
parent [330]` — Fabric being asked to move a view it had not been told to
remove first. Reloading recovered completely, which is the only reason it was
survivable in development and the reason it went unnoticed for so long: iOS
never reproduced it, and a reload made it look like a hiccup rather than a
certainty.

It was neither a stale dev client nor a library bug. Rebuilding the Android
dev client from the current tree reproduced it exactly, and so did a tree with
the overlay hosts removed, and one with every `Stack.Protected` guard pinned
open — all three of the obvious suspects, all three wrong.

The cause was one line in `sign-in.tsx`, and its own comment described the
race without naming it: _"the root layout's Stack.Protected re-evaluates on
the session change this triggers, but replacing the route now avoids a stale
sign-in screen flash while that catches up"_. Both things happen in the **same
commit**. The session appears, so `Stack.Protected` rebuilds the set of screens
in the root navigator — and `router.replace('/')` asks that same navigator to
move between two of them at the same moment. `react-native-screens` gets a
reorder and a rebuild in one mounting transaction, and on Fabric that is the
reparent above.

The replace is not needed. `(auth)` unmounts when the guard flips, taking the
sign-in screen with it, and the navigator falls back to `index`, which
redirects. Measured frame by frame with the call removed: the form, one splash
frame, then Discovery — there is no flash for it to have been covering. The
same call in `SocialAuthButtons` goes for the same reason; it only ever renders
inside `(auth)`.

`magic-link` and `verify-email` keep theirs, and the difference is the whole
rule: those two are registered at the **root**, outside both guards, so nothing
unmounts them. The guard alone would leave the reader sitting on the screen
they arrived through. **Replace after a session appears only from a screen the
guard will not take away.**

## v1 named nine people in ten, and they get one chance to answer

v1 handed out usernames. Its generator wrote `langx_` and four hex characters
— `langx_6430`, `langx_003c`, `langx_00a5` — and against the staged records
that is **2846 of 3164** profiles. 313 people named themselves, five typed
something starting with `langx_` by hand, and everybody else is carrying an
address a machine picked in 2023. The digits-only ones are not a category:
they are the draws that happened to land on `0-9`.

So `POST /profiles/me/handle` exists, and the rule against renaming still
stands for everybody else. The reason it stands has not changed — a handle is
a public address, and moving off one breaks every link already shared — but it
was written for a name its owner chose, and most of these are not that.
"You cannot change your name" is a fair rule; "you cannot change the name we
gave you" is not.

**The offer is not narrowed to the generated shape**, even though the shape is
exact enough to match on. Anyone whose v1 profile came back gets the one
claim. Refusing `langx_david` while allowing `langx_00a5` is a distinction no
recipient could explain, and the 313 who did name themselves did it under v1's
rules and years ago. `canClaimNewHandle` is the whole of it, in
`packages/shared` so the server's refusal and the app's Settings row cannot
drift into disagreeing about who is being offered what.

**Once, and `previousHandle` is what counts it** — no flag, no counter. The
old name has to be kept anyway, so its presence already says the claim was
spent and its absence makes the first one free with no migration. Same shape
as `genderChangedAt`, for the same reason.

Keeping the old name is the half that took the most thought, and releasing it
was never really an option. Links outlive names: a v1 profile URL, a QR code
printed on something, a screenshot of a card. `findProfileByHandleOrId`,
`getSharedProfile` and `emailForHandle` all resolve through `previousHandle`,
so none of those break. And a released name is a name a stranger can take,
which would turn every one of those links into somebody else's profile — a
small door, since nobody covets `langx_003c`, but an impersonation door all
the same.

What that costs is one guard no index can express. Mongo will make `handle`
unique, and `previousHandle` unique, and has no way to say that a value in one
excludes the same value in the other. So `assertNotSomeonesOldHandle` is a
read, on both paths that write a handle — the claim and onboarding — and the
window between the read and the write stays open, about as wide as
`isHandleAvailable`'s and over the same kind of name.

The claim goes through `resolveHandleClaim` like onboarding does, and that is
not tidiness: the reservation is what stops two people racing for one v1
handle, and a second path that skipped it would be the way around it. It also
buys the case this route is quietly for — somebody who onboarded under a
made-up name because they could not face `langx_00ec`, and whose real v1
handle has been sitting unclaimed ever since. They take it back here, past the
floor and the reserved list, because it was reserved for them all along.

It is offered in two places, and skipping it costs nothing. The welcome-back
screen already had a line about the handle, saying it was theirs again; for
these accounts it now says who chose it and offers the alternative, and
"Start exploring" walks past it. Settings → Account keeps the row for as long
as it goes untaken, which is also the answer for the people who came back
before any of this shipped.

## The one dialog, and the flag that was written before it opened

A phone arrived with no notifications at all, and its iOS Settings page showed
no Notifications row either — Siri, Search, Cellular Data, and then nothing.
That row is not something an app can lose: iOS adds it the first time
an app actually requests authorisation, so its absence is proof the dialog had
never opened, not that permission had been refused.

Two things met to make that state permanent. The chats tab is the only asker
after onboarding — `NotificationPriming` mounts on the two onboarding exits and
`welcome-back` is shown once, so neither is reachable again — and the tab wrote
`pushAsked` _before_ calling `requestPermissionsAsync`. That order is right for
a ledger claim, where a notification nobody gets beats one that repeats every
evening; here it is exactly backwards. Anything between the two — a throw
inside the request, the app killed on that frame — records an answer to a
dialog nobody saw, and there is no second asker and no row in Settings to put
it right from the outside. The phone is silent for good, while the per-kind
push switches in Settings go on reading as on.

So the flag is written after the dialog returns, and `shouldAskForPush` decides
when it is worth believing. **iOS cannot collect an answer without showing the
dialog**, so a status still undetermined there means it never appeared,
whatever the flag says — and asking again is the only thing that can be right.
**Android can**: its dialog is dismissable and a dismissal leaves that same
state, so the flag stands there, which is what keeps one dismissal from
becoming a dialog on every visit to the tab. The asymmetry is the platforms',
not a preference.

**And Settings became the second asker**, because the first one cannot be
enough. Every automatic ask happens once and passes: the priming card mounts
on the two onboarding exits, `welcome-back` is shown once, and a phone that
arrives at an existing account — a reinstall, a new handset — reaches neither,
so the chats tab's single attempt is the whole of it. A phone that misses that
has nowhere to complain, since iOS shows no Notifications row for an app that
has never requested. The reinstall that was supposed to prove the flag theory
is what settled this: it cleared the flag, and the phone was still silent.

So the per-device switch tells the truth and does something about it. It read
its own flag, which defaults to on, and so sat there promising notifications a
phone had been granted nothing for; it now reads granted-and-not-silenced, and
turning it on raises the dialog — ignoring `pushAsked` entirely, because
somebody who taps a switch labelled "notifications on this phone" has asked in
so many words. Where iOS will not raise it again the switch opens the Settings
app instead, which is the only place left that can change the answer, and the
screen re-reads the permission on focus for when they come back from it.

## Notification permission gets the page location already had

`settings/location.tsx` exists because "location does not work" has four
different answers and only one of them is "allow it" — the OS may never ask
again, the device-wide switch may be off, and a browser settles it somewhere
the app cannot reach. Notifications have exactly that shape and had no such
page: the only thing the app could say was a switch that sprang back.

So there is a second guide, `settings/push.tsx`, and it is deliberately the
same screen: the same states-as-a-value split (`pushGuideStatus`, pure and
tested, beside `locationGuideStatus`), the same numbered steps per platform,
the same re-read on every foreground — the path both pages exist for ends in
the Settings app, and a guide still saying "your device will not ask again"
when you come back from granting it looks broken at the moment it worked.

Its fourth state is the one location does not have. `servicesOff` there means
the device switch is off; `silenced` here means **LangX's own** per-device
switch is off while the OS is perfectly willing. Nothing in the Settings app
would fix it, so that state offers no button at all and names the switch one
screen up instead. Calling it "on" because the OS said yes would be a lie to
somebody receiving nothing, which is the failure this whole run of work
started from.

The row sits under the switch it explains, exactly where
`privacy.locationPermission` sits under the two rows it explains, and it
carries no live state for that row's stated reason: what the permission
currently is takes an OS read and an `AppState` listener to stay true, and a
row that goes stale in a list of switches reads as a switch that is wrong.

## A reported post can be hidden from the mailbox, never deleted from it

A report raised from the feed is usually about one sentence, not about the
person who wrote it, and until now the report email could only decide the
person: suspend for N days, suspend forever, dismiss. The proportionate answer
— take that post down and leave the account alone — did not exist, so the
choice was between doing too much and doing nothing.

It exists now as `hide_post` / `unhide_post`, offered on the review page only
when the report names a post. What it writes is `hiddenAt` on the post, and
`notHidden()` is spread into every read that can put a post in front of
somebody — the feed's two queries, the thread, the comments, the answers, the
likes, and the author's own `/me/posts`.

**There is deliberately no `delete_post`.** `email/reviewToken.ts` justifies
treating a mailbox as authorisation by a single property: the worst a stolen or
forwarded link can do is something a person can undo. A hard delete takes the
post, its corrections, its answers and its attachments with it and breaks that
property outright. Hiding is the reversible half of the same intent; a genuine
deletion stays a script somebody runs by hand.

The author's own list filters it too, which is the part worth stating because
it looks like an oversight. Hiding is silent — nobody is emailed, nothing is
labelled — so the one place the post stayed visible would be the one place the
silence broke, and a writer watching their sentence sit in a list nobody else
can reach is worse than either honest answer.

Showing it again does not reopen the report. The second decision corrects the
first rather than handing somebody work that is already done.

## Discovery accepts a one-sided match while the app is this small — temporarily

Mutual fit is the honest rule and the whole point of the product: their native
is something I am learning **and** their learning is something I speak. With
the number of profiles there are today that conjunction returns nothing for
most people. Somebody signs up, finishes onboarding, opens Discover and sees an
empty screen — which is not a list with no results, it is an app that looks
broken, and it is the one first impression there is no recovering from.

So `DISCOVERY_CROSS_MATCH_FALLBACK` in `packages/shared` turns the `and` into
an `or` for the **default** search. A Turkish native learning English now sees
an English native learning French: one side fits, the other does not, and a
half-fit somebody can still talk to beats a blank screen. It is one constant
and it is meant to be flipped back.

Three boundaries, each of which is the thing the relaxation could easily have
broken:

**It widens the match, it does not remove it.** Somebody who shares no language
at all in either direction is still not a candidate. The screen fills with
people you have something in common with, not with everybody.

**A named language scope restores both directions.** `learningLanguages` or
`nativeLanguages` on the request is somebody asking about particular languages,
and the answer to a question asked explicitly is the strict one. Note that
_either_ side named restores _both_ — scoping the relaxation to the side the
request happened to narrow would answer a question nobody asked.

Other filters do not turn it off, deliberately. Age, country or gender narrow a
pool that is already too small; a relaxation that exists to fill an empty
screen must not switch itself off the moment somebody touches the filter
sheet. The level band is the one that constrains the match anyway, because
`$elemMatch` on `learning` re-imposes "their learning is one of my natives" by
construction — that is consistent rather than accidental, and it is what a
level filter means.

**Ranking needed no rule.** `recommended` scores the two intersections and
sums them, so a mutual fit scores 2 where a one-sided fit scores 1 and leads
it without anything being added. `active` and `nearby` intermix them, which is
correct: those sorts answer "who is here" and "who is close", not "who fits
best".

The one thing this cost is a shape. The language fit is a top-level `$or` now,
and the boosted strip spreads the shared scope into an object where it adds an
expiry `$or` of its own — the second key would have silently replaced the
first, and the strip would have shown every paying member in the app
regardless of language, with nothing failing anywhere. The strip composes the
two halves with `$and` instead, and a test pins it.

Reverting is the constant, the tests named `cross-match fallback`, and the
second case in the index-usage test. Do it once there are enough profiles for
the honest rule to fill a page.
