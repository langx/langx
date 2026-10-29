import { MongoInstance } from 'mongodb-memory-server'

/**
 * How long a test's mongod may take to start before mongodb-memory-server
 * gives up on it. `setupFiles` in vitest.config.ts loads this before every API
 * test file, so the ~140 files that each start their own server with a bare
 * `MongoMemoryServer.create()` or `MongoMemoryReplSet.create(...)` get it
 * without saying so — and so does the next file copied from any of them.
 *
 * The library's default is 10 s, and an idle machine has a mongod ready in
 * about one. But `pnpm test` starts one in every vitest worker at the same
 * moment, and on a loaded machine or a busy CI runner that burst has taken
 * longer than 10 s: the file then fails with "Instance failed to start within
 * 10000ms" before any of its tests run, which reads exactly like a broken test
 * and is not one.
 *
 * 60 s is six times the default: 120 replica sets started at once on a loaded
 * 12-core machine lost 85 of them at 10 s and none at 60 s. It is still
 * bounded, so a mongod that will never come up fails with the library's own
 * error, which names the cause, rather than with a bare "Hook timed out". That
 * only holds while the hook outlasts it — 60 s to launch, up to 30 s more for a
 * replica set to elect its primary (the library's fixed wait), then the rest of
 * the beforeAll — which is why vitest.config.ts gives hooks 120 s and the hooks
 * that start a mongod take that default rather than a shorter one of their own.
 */
const MONGOD_LAUNCH_TIMEOUT_MS = 60_000

// `start` is where the launch timer is armed, from `instanceOpts.launchTimeout`,
// and every mongod goes through it: a MongoMemoryServer, each member of a
// MongoMemoryReplSet, a restart. Patching it here is the one place that covers
// them all; a caller that names its own launchTimeout keeps it.
// eslint-disable-next-line @typescript-eslint/unbound-method -- called with `this` below
const start = MongoInstance.prototype.start
MongoInstance.prototype.start = function (this: MongoInstance): Promise<void> {
  this.instanceOpts.launchTimeout ??= MONGOD_LAUNCH_TIMEOUT_MS
  return start.call(this)
}
