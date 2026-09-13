#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# A web session starts from a fresh clone: no node_modules, no mongod binary.
# Both are the whole cost of the first `pnpm test`, and paying it here means the
# session can typecheck, lint and test from its first message instead of
# spending them on an install.
set -euo pipefail

# Local sessions have their own install and their own mongod; nothing here
# applies to them.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

corepack enable >/dev/null 2>&1 || true

pnpm install --frozen-lockfile

# apps/api's test files each start their own MongoMemoryServer, and vitest runs
# them in parallel workers. On a cold cache they race on the same binary's
# download and lockfile, which reads exactly like a real test failure — the same
# reason .github/workflows/ci.yml fetches it in its own step. The install's
# postinstall usually has it already; this is a no-op then, and it also proves
# the binary actually starts rather than only that it downloaded.
# pnpm's layout is isolated, so the package resolves from apps/api and nowhere
# else — running this from the root finds nothing.
(cd apps/api && node --input-type=module -e "
  import { MongoMemoryServer } from 'mongodb-memory-server'
  const server = await MongoMemoryServer.create()
  await server.stop()
") >/dev/null

# Outbound TCP 27017 is closed in web sessions, so MONGODB_URI — an Atlas
# cluster — is unreachable here however valid its credentials are. Tests do not
# care: they run against mongodb-memory-server. `pnpm dev` does, and fails with
# a server-selection timeout that looks like a bad connection string.
echo "Ready: pnpm test | pnpm -r typecheck | pnpm lint. No Atlas from here — tests use an in-memory mongod."
