# Self-hosting LangX v2

LangX is BSD-3 licensed and runs on infrastructure you control. This is the
whole list — there is no hosted control plane you have to sign up for, and
nothing here phones home.

## What you actually need

| Service                 | Why                                                                                                                                             | Cheapest workable option                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| MongoDB **replica set** | Better Auth wraps writes in transactions, and MongoDB only offers those on a replica set. A standalone `mongod` will fail on the first sign-up. | Atlas free tier (already a replica set), or `mongod --replSet rs0` + `rs.initiate()` on one node |
| Node 24+                | The API targets it                                                                                                                              | any VPS                                                                                          |
| An S3-compatible bucket | avatars, gallery photos                                                                                                                         | Cloudflare R2 (no egress fees), Backblaze B2                                                     |

Everything else is optional and the app boots without it: no email provider
means verification links are printed to the log, no translation credentials
means `/translate` returns a clear "not configured" error, no RevenueCat means
everyone stays on the free tier, no push credentials means notifications are
logged instead of sent. That is deliberate — a self-hoster should be able to
get a working instance before deciding which paid services they want.

## Quick start

```bash
git clone https://github.com/langx/langx2 && cd langx2
pnpm install
cp .env.example .env      # fill in MONGODB_URI and BETTER_AUTH_SECRET at minimum
pnpm dev                  # API on :4000, Expo on :8081
```

`BETTER_AUTH_SECRET` must be at least 32 characters. Generate one with
`openssl rand -base64 32`.

### A local replica set

The single most common self-hosting failure is a standalone MongoDB. If
sign-up returns a 500 mentioning transactions, this is why:

```bash
mongod --dbpath /your/data/dir --replSet rs0 --bind_ip 127.0.0.1
mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
```

Homebrew's default `mongod.conf` has no `replication` block — add one rather
than passing `--replSet` by hand if you want it to survive a restart.

## Indexes

`ensureIndexes()` runs at boot and creates every index the app needs, so a
fresh database is correct before it serves its first request. Never create
indexes by hand: if a declaration in `src/db/indexes.ts` is edited without a
migration, boot fails loudly rather than leaving a query silently scanning the
whole collection.

## Background work

Three schedulers start with the API. None of them is a cron expression — each
asks "is there unfinished work?" on an interval, so a process that was down
during the window catches up on its next tick instead of skipping silently.

| Scheduler        | Interval | What it does                                                                                                                      |
| ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Daily token pool | 15 min   | Distributes a closed day's token pool. Idempotent twice over: a `jobRuns` lock, and the ledger's unique index. Catches up 7 days. |
| Account purge    | 1 hour   | Hard-deletes accounts past their 30-day grace period.                                                                             |
| Streak reminder  | 30 min   | Sends the nudge at 20:00 in each user's own timezone, once per local day.                                                         |

Running several API instances is safe. The pool's `jobRuns` unique index means
only one instance can own a given day.

## Deploying

**API** — `pnpm --filter @langx/api run build` produces a single
`dist/index.js` (external deps). Run it with `node dist/index.js` behind a TLS
terminator. Set `NODE_ENV=production` so `trustProxy` is on, or the rate
limiter will see your proxy's IP for every request and put all your users in
one bucket.

**Web** — `pnpm --filter @langx/mobile exec expo export --platform web` emits
a static site in `dist/`. Serve it from any static host. It needs
`EXPO_PUBLIC_API_URL` set at build time, and that origin must appear in the
API's `TRUSTED_ORIGINS` or the browser will block the session cookie.

**Mobile** — EAS handles builds; see `eas.json`. Self-hosters building their
own app need their own bundle identifier, their own signing keys, and their
own store listings. Do not reuse the identifiers in `app.config.ts` — they
belong to the published LangX app.

## Storage: B2 or R2

`StorageProvider` is one interface over `@aws-sdk/client-s3`, so B2 and R2 are
a config swap, not a code change. R2 is the recommended default purely because
it charges no egress — a language-exchange app serves a lot of avatars.

## What is NOT in this repo

The published app's signing keys, store credentials, and API keys. Obviously.
Also the RevenueCat product identifiers: entitlement is enforced server-side
from a webhook, so a self-hosted instance with no RevenueCat simply has every
user on the free tier, which works.
