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
git clone https://github.com/langx/langx && cd langx
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
`dist/index.js`. npm packages stay external, but `@langx/shared` is inlined by
an esbuild `--alias`: it ships as TypeScript source, so left external Node
resolves it to a `.ts` file whose own extensionless imports it then cannot
follow, and the process dies at startup. Run it with `node dist/index.js`
behind a TLS terminator. Set `NODE_ENV=production` so `trustProxy` is on, or
the rate limiter will see your proxy's IP for every request and put all your
users in one bucket.

The `Dockerfile` at the repo root packages exactly that, and the build context
is the workspace root rather than `apps/api`. Note that `deploy` runs with
`--config.node-linker=hoisted`: pnpm's default symlink layout keeps a `.pnpm`
store holding the whole workspace, so the API image would otherwise carry Expo,
React Native and the Hermes compiler.

**Fly.io** — `fly.toml` is committed and holds no secrets. First deploy:

```bash
fly launch --no-deploy          # claims the app name; keeps the committed fly.toml
fly secrets set MONGODB_URI='...' BETTER_AUTH_SECRET='...' BETTER_AUTH_URL='https://<host>'
fly deploy
fly certs add <your-domain>     # Let's Encrypt, issued and renewed automatically
```

If DNS is behind Cloudflare, the record has to be DNS-only (grey cloud) for
the certificate to issue — a proxied record answers Fly's challenge itself and
the certificate stays pending forever. Leaving it grey afterwards is the
simpler setup; a proxied record additionally needs Cloudflare's SSL mode on
Full (strict), because "Flexible" talks HTTP to an origin that redirects to
HTTPS and the request loops.

Do not let the platform scale the API to zero. The four schedulers above are
interval ticks inside the process, not platform cron: a suspended machine runs
none of them, and no request arrives to wake it at 20:00 in a user's timezone.
`auto_stop_machines = 'off'` in `fly.toml` is there for that reason.

Socket.io is served by the same process over the same port, so WebSockets need
no extra configuration — but its default transport list starts with HTTP
polling, which assumes consecutive requests reach the same instance. Fly does
not do sticky sessions, so going past one machine needs a Socket.io adapter
first.

**Web** — `pnpm --filter @langx/mobile exec expo export --platform web` emits
a static site in `dist/`. Serve it from any static host. It needs
`EXPO_PUBLIC_API_URL` set at build time, and that origin must appear in the
API's `TRUSTED_ORIGINS` or the browser will block the session cookie.

Cloudflare Pages is the host this repo is set up for — a static export needs
no server of its own, so it needs no machine and costs nothing:

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=https://<your-api-host> pnpm run build:web
pnpm run deploy:web
```

Two details in that setup are not decoration. `apple-app-site-association` is
sent as `application/json` by `public/_headers` — it is checked in without a
file extension, so a host that sniffs the type breaks iOS deep links while
Android keeps working. And `build:web` copies Expo's `+not-found.html` to
`404.html`, which is the name Pages answers unmatched paths with, and it
answers with a real 404: `output: 'static'` writes a file per route, so a host
that rewrites everything to `index.html` would return 200 for every typo.

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
