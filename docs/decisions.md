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
the "demote the language filter" option, and it is acceptable only because
`maxDistance` bounds the candidate set — which is why `NEARBY_MAX_KM` is a cap
rather than a nicety, and why a radius with no ceiling was never on the table.

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
different audience, not the same dashboard with a lock removed.

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

## Gender is set once, like a birth date

`birthDate` has never been in `updateProfileSchema`. `gender` was, and that was
the half of the rule that got left open.

Both are inputs to somebody _else's_ discovery filter: `discoverProfiles`
matches on `gender` directly and on a `birthDate` band. A field that decides
whose results you appear in is not a field you can retype. Editing it is not
editing your profile, it is stepping in and out of other people's searches at
will — and a filter whose subjects can move between its buckets on a whim is
not a filter, it is a suggestion.

There is one move left, and it needs its own route. `undisclosed` → a real
value, once, through `POST /profiles/me/gender`. Without it the lock would be
a trap: `onlyMyGender` is deliberately inert for an undisclosed viewer, and it
is free now, so everybody who skipped the question at onboarding would be
permanently unable to use it — while the filter screen went on telling them, in
eight languages, to add their gender to their profile.

It is one-way in both directions that matter. `discloseGenderSchema` has no
`undisclosed` member, so there is nothing to go back to; and the repository's
filter matches only a profile that is _still_ `undisclosed`, so the value it
writes is the last one that field will hold. Nobody can cycle. The condition
lives in the update's filter rather than in a read before it, for the reason
every other guard here does — two taps that race would both pass a
check-then-write, and the second would win.

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

## No photo in the first five messages. From anybody.

The failure this exists to prevent has one shape: the first thing a stranger
sends is a photograph, and the person receiving it did not agree to look at it.
Moderation cannot fix that one. A report arrives after the picture has been
seen, and being right afterwards is not the same as it not happening.

So the rule is structural rather than punitive: a conversation carries no
attachment until it has carried `MEDIA_UNLOCKS_AFTER_MESSAGES` messages,
counted across both people. Nothing has to be detected, nobody has to be
judged, and there is no model deciding what a photograph contains.

**There is no exception, and that is the feature.** Not for Pro, not for
Polyglot, not for somebody with a long history who has opened a new thread. A
paid tier attached to this rule would say the behaviour is acceptable from
customers, and it is not acceptable from anybody. It is also the only version
that survives being said in one sentence: _photos unlock after five messages,
for everyone._ Every carve-out costs a clause, and a rule people cannot repeat
is a rule that does not deter.

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

`messageCount` rides the `findOneAndUpdate` that `recordMessage` was already
issuing for `lastMessage` and `unread`, so the counter is free. Its **absence**
means something specific: the conversation predates it. Those are the threads
with the most history, so `messagesInThread` counts them rather than reading a
missing field as zero and locking a two-year-old conversation out of sending a
photo — a cost that decays to nothing as old threads get their next message.

The client is told how many more are needed rather than just that it cannot,
and the camera is disabled rather than hidden. A control that vanishes teaches
nothing, and a rule nobody knows about deters nobody.

## Referrals — the handle is the code, and the award waits for a real message

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
by the first `/billing/refresh` — and the paywall calls it on open and on
restore. Anything that grants entitlement has to go through RevenueCat, which
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

Going past one machine needs a Socket.io adapter first. Socket.io's default
transport list starts with HTTP polling, which assumes consecutive requests
reach the same instance, and Fly has no sticky sessions. Everything else about
the app is already safe to run multiply — the `jobRuns` unique index means only
one instance can own a given day's pool.

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

The chat composer uploads the moment you pick, because in a thread picking _is_
sending. The feed composer holds the local file and uploads when the post is
actually submitted: there is still a sentence being written, and uploading on
pick would spend a day's media quota and leave bytes in the bucket for a post
the writer then abandons.

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

## Shipping lives on expo.dev, and only tests live on GitHub

Behic's call on 3 September 2026, after a day of weighing the alternative:
builds, store submissions and over-the-air updates are EAS workflows in
`apps/mobile/.eas/workflows/`, started from Expo's dashboard or by a push to
`main`. GitHub Actions keeps `ci.yml` and nothing else. The API and the web
build are unaffected — Fly and Cloudflare Pages are still deployed by hand,
see the runbook.

Two things decided the shape of the workflows.

_Updates are automatic, builds are not._ A merge to `main` publishes an OTA
update to the `preview` channel for nothing; a cloud build spends one of the
free plan's fifteen a month. So the only workflow on a push trigger is the
update, and both build workflows are `workflow_dispatch` with a platform
input. Somebody spends a build on purpose, not because a README changed.

_Production updates are manual too._ An update on the `production` channel
reaches every store install at once, and `runtimeVersion` is the SDK version,
so a JS change that assumes a native module which is not in the store build
would land on phones that cannot run it. Publishing to production is a
deliberate `eas update --channel production` after the matching build has
shipped, not a side effect of merging.

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
gender is writable exactly once, from `undisclosed` to a value, and a
cache-busting parameter would have to carry the very field this keeps off the
wire.

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
Android cameras ignore custom schemes, so the eight-character code stays the
primary path — eight, not the six three comments and a placeholder claimed.

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
