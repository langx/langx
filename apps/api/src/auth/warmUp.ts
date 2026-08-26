import { ObjectId, type Db } from 'mongodb'
import type { Auth } from '../auth'

const WARMUP_EMAIL = 'bootstrap-warmup@internal.langx.invalid'
const WARMUP_PASSWORD = 'bootstrap-warmup-not-a-real-account'

interface WarmUpLogger {
  warn(obj: Record<string, unknown>, msg: string): void
}

/**
 * A brand-new database's very first write to Better Auth's `user`/`account`
 * collections can race its own lazy `ensureModelIndexes()` — confirmed by
 * hand against both `mongodb-memory-server`'s replica set and a real,
 * freshly-initiated local mongod. MongoDB throws a transient error
 * ("...due to catalog changes; please retry the operation"), and
 * `@better-auth/mongo-adapter@1.7.1` doesn't retry it: its transaction
 * wrapper unconditionally calls `abortTransaction` in the catch block, which
 * itself throws because `commitTransaction` already went through
 * ("Cannot call abortTransaction after calling commitTransaction"). One
 * transient blip becomes a hard 500 — in production, on whichever request
 * happens to run first, quite possibly a real person's first sign-up.
 *
 * Once past, it doesn't recur (Better Auth caches that a model's indexes are
 * already ensured). This absorbs the cost at boot with a disposable account
 * instead, deleted immediately after. Best-effort: a failure here logs a
 * warning and lets boot continue rather than blocking it — worst case we're
 * back to the pre-existing risk, not a new one.
 */
export async function warmUpAuthCollections(
  auth: Auth,
  db: Db,
  logger: WarmUpLogger,
  maxAttempts = 5,
): Promise<void> {
  // Defensive: a previous run that died before cleanup would otherwise
  // collide with this attempt's fixed email.
  await db.collection('user').deleteOne({ email: WARMUP_EMAIL })

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { user } = await auth.api.signUpEmail({
        body: { email: WARMUP_EMAIL, password: WARMUP_PASSWORD, name: 'Warm Up' },
      })
      // Better Auth's mongo-adapter stores reference fields like
      // `account.userId` as an ObjectId even though the public API returns
      // `user.id` as a plain string.
      await db.collection('account').deleteMany({ userId: new ObjectId(user.id) })
      await db.collection('user').deleteOne({ email: WARMUP_EMAIL })
      return
    } catch (error) {
      if (attempt === maxAttempts) {
        logger.warn(
          { err: error, attempts: maxAttempts },
          "auth collection warm-up never succeeded — a fresh database's first real sign-up may hit the same transient error once",
        )
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt))
    }
  }
}
