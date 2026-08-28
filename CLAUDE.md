# Working in this repo

LangX v2 — a language-exchange app. Expo (iOS/Android/web) + Fastify + MongoDB,
in a pnpm workspace. Open source, BSD-3, and **the repo is public**.

Start with [`docs/architecture.md`](docs/architecture.md) for the design,
[`docs/decisions.md`](docs/decisions.md) for why things are shaped the way they
are, and [`docs/v1-reference.md`](docs/v1-reference.md) for the identifiers of
the system this replaces. Both are worth reading before changing anything structural — several
decisions look arbitrary until you know what went wrong the first time.

## Layout

| Path              | What                                                                         |
| ----------------- | ---------------------------------------------------------------------------- |
| `apps/api`        | Fastify + Better Auth + Socket.io, one process                               |
| `apps/mobile`     | Expo app; the web build comes out of the same code                           |
| `packages/shared` | zod schemas, DTO types, `PLAN_LIMITS`, `TOKEN_RULES`, languages, error codes |

## Commands

```bash
pnpm dev            # API on :4000, Expo on :8081
pnpm test           # vitest, everywhere
pnpm -r typecheck
pnpm lint           # eslint; lint:fix to autofix
pnpm format         # prettier
```

CI runs typecheck, lint, format:check and tests. All four must pass.

## Local MongoDB must be a replica set

Better Auth wraps writes in transactions and MongoDB only offers those on a
replica set. A standalone `mongod` fails on the first sign-up with a
transaction error. See `docs/self-host.md`.

## Conventions that are load-bearing

**No handler queries a collection directly.** Every module has repository
functions and access control lives there. This replaces Appwrite's
document-level permissions, so it is the whole authorisation story, not a style
preference.

**Socket events pass through the same guards as REST.** The WebSocket must
never become a back door around authorisation, quota or token accounting.

**Indexes are declared in `apps/api/src/db/indexes.ts`** and applied at boot.
Never create one by hand. The uniques there are invariants, not optimisations —
they make double-awarded tokens and twice-run cron jobs physically impossible.

**Two id worlds.** Better Auth's collections (`user`, `session`, `account`,
`verification`) store ids as ObjectId; ours store the string form. Use
`lib/authId.ts` at every boundary — a string against `session` matches nothing
and reports success.

**Limits and rules are config**, in `packages/shared`. Never hard-code a
threshold.

**Optional services degrade, they do not crash.** No email credentials means
verification links are logged; no storage means the upload endpoint fails with
a clear message; no RevenueCat means everyone is on the free tier. The app must
boot and work without any of them.

**No secrets, ever.** The repo is public. `.env.example` is the template.

## Writing style

Comments explain _why_, not what — especially where the code looks odd, since
that is usually where a subtle failure was fixed. Commit messages are English,
and so is everything else in the repo except language data and localized store
copy.

**Answer Behic in Turkish.** From the first message of every new session, and
without waiting to be asked again — this rule is why it is written down rather
than repeated. It does not soften the paragraph above: what lands on disk is
still English, all of it. The two cover different things, the artefact and the
conversation, and only the artefact is what other people read.
