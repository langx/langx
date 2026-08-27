# LangX v2

Language exchange, built as a game. Speak the languages you know, learn the ones
you want, get matched on mutual fit, chat, correct each other's sentences — and
keep a streak while doing it.

iOS, Android and web all come out of one Expo codebase. BSD-3, open source, same
as v1.

> **Status: pre-release.** v2 is a ground-up rewrite of
> [`langx-angular`](https://github.com/langx/langx-angular) (Ionic/Angular on Appwrite) onto
> Expo + Fastify + MongoDB Atlas. It ships as an **update to the existing App
> Store and Play Store listings**, not as a new app.

v2 was written in a separate repository and moved here, because this is where
the releases and the issue history are. Nothing was dropped in the move: the
`v1` branch is `main` as it stood beforehand, and the shipped v1 is tagged up
to `v0.15`.

## Stack

| Layer      | Choice                                                             |
| ---------- | ------------------------------------------------------------------ |
| Mobile/web | Expo SDK 57 · expo-router · TanStack Query + Zustand · NativeWind  |
| API        | Node 24 · Fastify 5 · Better Auth · Socket.io — a single container |
| Data       | MongoDB Atlas, official driver (no Mongoose)                       |
| Storage    | S3-compatible (Cloudflare R2; Backblaze B2 via config)             |
| Billing    | RevenueCat — StoreKit / Play Billing / RevenueCat Web + Stripe     |

## Quick start

MongoDB needs to run as a replica set (Better Auth's writes use
transactions) — full setup in [CONTRIBUTING.md](CONTRIBUTING.md#getting-set-up).

```bash
pnpm install
cp .env.example .env      # set MONGODB_URI and BETTER_AUTH_SECRET
pnpm dev                  # API on :4000, Expo on :8081
```

- `pnpm dev:api` — API only
- `pnpm dev:web` — Expo web only
- `pnpm typecheck` · `pnpm lint` · `pnpm test`

## Layout

```
apps/api          Fastify API — auth, REST, realtime, scheduled jobs
apps/mobile       Expo app (iOS + Android + web)
packages/shared   zod schemas, language + level tables, PLAN_LIMITS, TOKEN_RULES
packages/config   shared tsconfig + eslint presets
```

## Self-hosting

Running your own instance needs MongoDB Atlas (or any MongoDB), an S3-compatible
bucket, and an SMTP/Resend key. Billing and translation are optional and degrade
cleanly when unconfigured. See `docs/self-host.md` _(written in Faz 12)_.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

BSD 3-Clause. See [LICENSE](LICENSE).
