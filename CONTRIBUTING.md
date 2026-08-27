# Contributing to LangX v2

Thanks for helping out. LangX is BSD-3 licensed and stays open source.

## Repository layout

```
apps/api        Fastify + MongoDB API (auth, REST, Socket.io — one process)
apps/mobile     Expo app; iOS, Android and web come out of this codebase
packages/shared zod schemas, DTO types, language + level tables, PLAN_LIMITS, TOKEN_RULES
packages/config shared tsconfig + eslint presets
```

`packages/shared` is the contract between the two apps. If a limit, error code or
payload shape is used on both sides, it belongs there — not duplicated.

## Getting set up

Requires Node >= 24 and pnpm 10.

MongoDB must run as a **replica set**, even locally with one node — Better
Auth's writes use multi-document transactions, which a standalone `mongod`
doesn't support:

```bash
mkdir -p ~/mongodb-data
mongod --dbpath ~/mongodb-data --replSet rs0 --logpath ~/mongodb-data/mongod.log --fork
mongosh --quiet --eval "rs.initiate()"   # once, the first time
```

Then:

```bash
pnpm install
cp .env.example .env
# fill in MONGODB_URI and generate a secret:
#   openssl rand -base64 32   ->  BETTER_AUTH_SECRET
pnpm dev                  # API + Expo together
```

Everything else in `.env.example` (Resend, Google/Apple OAuth) is optional for
local dev — email/password auth works without them; verification and
reset-password links print to the console instead of sending until
`RESEND_API_KEY` is set.

`pnpm dev:api`, `pnpm dev:mobile` and `pnpm dev:web` run them individually.

## Running on a phone

The web build and the simulators cover most of it, but three things only
exist on a real device: push notifications, App Links opening the app
instead of the browser, and Sign in with Apple's native sheet. All three
need a **development build** — Expo Go cannot load the app's native modules.

```bash
cd apps/mobile
eas login                       # once
eas build --profile development --platform ios       # or android
```

Install the result, then `pnpm dev` and scan the QR code. The API does not
need any extra configuration: it already listens on `0.0.0.0`, and the app
takes the host from the dev server it connected to rather than from
`EXPO_PUBLIC_API_URL`, whose `localhost` would be the phone itself. Both
have to be on the same network.

To build the native project locally instead — useful for checking that a
newly added native module links, without waiting on a build queue:

```bash
npx expo prebuild --platform ios --clean
cd ios && pod install
npx expo run:ios --device "<simulator name or udid>"
```

`ios/` and `android/` are generated and gitignored; nothing in them is
edited by hand, and `--clean` throws them away and regenerates from
`app.config.ts`. Building onto a physical iPhone this way additionally
needs a signing certificate in Xcode, which the EAS route handles for you.

## Before you open a PR

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
```

CI runs the same four.

## House rules

- **No secrets, ever.** See `SECURITY.md`. `EXPO_PUBLIC_*` is world-readable.
- **Handlers never query collections directly.** Every module exposes repository
  functions and the access check lives there. This replaces the document-level
  permissions we had on Appwrite, so a direct `db.collection(...)` call in a
  route handler is a security regression.
- **Socket events go through the same guards as REST.** WebSocket must not
  become a back door around authorization, quota or token accounting.
- **Authorization, quota and entitlement decisions are server-side.** The client
  may cache them for UI, never for enforcement.
- **Indexes are declarative.** Add them to `apps/api/src/db/indexes.ts`; they are
  applied on boot by `ensureIndexes()`. Do not create indexes ad hoc.
- **Expo-owned versions** (`expo-*`, `react-native*`, `react*`) are changed only
  via `npx expo install --check`, never by hand. Everything else shared between
  workspaces goes in the `catalog:` block of `pnpm-workspace.yaml`.

## Commits

Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).

## Code of conduct

By participating you agree to [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
