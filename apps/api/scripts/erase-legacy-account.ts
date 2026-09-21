/**
 * Erases one **v1** person's staged data, for a deletion request that arrives
 * by email rather than through the app.
 *
 * A v1 account cannot use the product's own deletion flow: it has no v2 user
 * id, so `requestDeletion` has nothing to key on. Its data sits in the Faz 11
 * staging collections instead — and, crucially, its pictures were copied into
 * *our* bucket by `migrate-profiles.ts`, which stages on the strength of an
 * Auth email and never asked whether the owner had deleted the account in v1.
 * `precreate-v1-users.ts` does ask (`status: false` gets no `user` row), so a
 * v1-deleted account is invisible in the product while its photos stay
 * publicly fetchable. That gap is what this closes, one person at a time.
 *
 * What it will not do: touch a **live v2 account**. If the address has signed
 * up since, that account is a different thing with conversations, tokens and a
 * grace period, and it goes through `requestDeletion` + `purgeExpiredAccounts`
 * like everyone else's. This prints it and stops rather than half-deleting
 * across both worlds.
 *
 * What survives, and why:
 *
 * - The **peer's** messages in a shared v1 thread, and the `legacyRooms` row
 *   holding them. Those are somebody else's words. The thread can never import
 *   once this person's staging record is gone — `importLegacyConversations`
 *   needs both sides restored — so what is left is inert, and deleting another
 *   person's data was not what was asked.
 * - An `emailSuppressions` row. It is the record of "never mail this address
 *   again", and erasing it is how somebody who unsubscribed starts getting
 *   mail. Reported, never deleted.
 *
 * **Idempotent.** A second run finds nothing and says so.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env \
 *     scripts/erase-legacy-account.ts --email <address> [--legacy-id <v1 id>]
 *   ... --apply     # actually delete
 */
import type { Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { hashLegacyEmail } from '../src/modules/handles/legacyEmailHash'
import type { LegacyProfile } from '../src/modules/handles/legacyProfiles'
import type { HandleReservation } from '../src/modules/handles/handleReservations'
import type { LegacyMessage } from '../src/modules/handles/legacyConversations'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import { supportsPut, type StorageProvider } from '../src/storage/StorageProvider'

function argOf(flag: string): string | undefined {
  const at = process.argv.indexOf(flag)
  return at >= 0 ? process.argv[at + 1] : undefined
}

/**
 * Deletes the objects behind a list of public URLs, counting only what was
 * ours to take. `keyFromPublicUrl` returning null is the bucket check — a URL
 * from somewhere else is reported, not followed.
 */
async function deleteObjects(
  storage: StorageProvider,
  urls: (string | undefined)[],
  apply: boolean,
): Promise<{ deleted: number; foreign: number }> {
  if (!supportsPut(storage)) {
    console.log('  storage not configured — objects left in place')
    return { deleted: 0, foreign: 0 }
  }
  let deleted = 0
  let foreign = 0
  for (const url of urls) {
    if (!url) continue
    const key = storage.keyFromPublicUrl(url)
    if (!key) {
      console.log(`  not in our bucket, skipped: ${url}`)
      foreign++
      continue
    }
    console.log(`  ${apply ? 'delete' : 'would delete'} ${key}`)
    if (apply) await storage.deleteObject(key)
    deleted++
  }
  return { deleted, foreign }
}

interface Target {
  email: string | undefined
  legacyId: string | undefined
  /** Absent when the target was given as an id — there is nothing to hash. */
  hash: string | undefined
}

async function run(
  db: Db,
  target: Target,
  storage: StorageProvider,
  apply: boolean,
): Promise<void> {
  const { email, legacyId, hash } = target

  /*
   * The live side first. Finding an account here changes what the whole run
   * means, so it is answered before anything is counted, let alone deleted.
   */
  if (email) {
    const user = await db.collection<{ _id: unknown; email: string }>(COLLECTIONS.user).findOne({
      email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    })
    if (user) {
      console.log(`LIVE v2 ACCOUNT: user ${String(user._id)} (${user.email})`)
      console.log('Not touched. A live account is deleted through the app, or by setting')
      console.log('`deletedAt` on its profile and letting `purgeExpiredAccounts` run.')
      return
    }
    console.log('live v2 user:        none')
  }

  const legacy = await db
    .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
    .findOne(legacyId ? { _id: legacyId } : { legacyEmailHash: hash! })

  if (!legacy) {
    console.log('legacyProfiles:      no row — nothing staged for this person')
  } else {
    console.log(
      `legacyProfiles:      _id ${legacy._id} @${legacy.handle}` +
        `${legacy.restoredBy ? ` — RESTORED BY ${legacy.restoredBy}` : ''}`,
    )
    /*
     * A restored record belongs to a live v2 account that is now using it, and
     * the branch above only catches that when the v2 address matches the v1
     * one. It often will not: the restore proves the old email, then the
     * account carries on under whatever address it signed up with.
     */
    if (legacy.restoredBy) {
      console.log('Not touched. This staging record was claimed by a live account.')
      return
    }
  }

  const effectiveHash = legacy?.legacyEmailHash ?? hash
  const effectiveId = legacy?._id ?? legacyId

  const reservations = effectiveHash
    ? await db
        .collection<HandleReservation>(COLLECTIONS.handleReservations)
        .find({ legacyEmailHash: effectiveHash })
        .toArray()
    : []
  console.log(`handleReservations:  ${reservations.length}`)

  const messages = effectiveId
    ? await db
        .collection<LegacyMessage>(COLLECTIONS.legacyMessages)
        .find({ senderId: effectiveId })
        .toArray()
    : []
  const rooms = effectiveId
    ? await db.collection(COLLECTIONS.legacyRooms).countDocuments({ participants: effectiveId })
    : 0
  console.log(`legacyMessages sent: ${messages.length}`)
  console.log(`legacyRooms:         ${rooms} (left in place — the peer's half)`)

  if (email) {
    const suppressed = await db
      .collection(COLLECTIONS.emailSuppressions)
      .countDocuments({ _id: email.toLowerCase() as never })
    console.log(`emailSuppressions:   ${suppressed} (left in place — see the header)`)
  }

  console.log('\nobjects:')
  const { deleted, foreign } = await deleteObjects(
    storage,
    [
      legacy?.avatarUrl,
      ...(legacy?.photos ?? []).map((photo) => photo.url),
      ...messages.map((message) => message.media?.url),
    ],
    apply,
  )
  if (deleted === 0 && foreign === 0) console.log('  none')

  if (apply) {
    if (legacy) {
      await db.collection<LegacyProfile>(COLLECTIONS.legacyProfiles).deleteOne({ _id: legacy._id })
    }
    if (effectiveHash) {
      await db
        .collection(COLLECTIONS.handleReservations)
        .deleteMany({ legacyEmailHash: effectiveHash })
    }
    if (effectiveId) {
      await db.collection(COLLECTIONS.legacyMessages).deleteMany({ senderId: effectiveId })
    }
  }

  console.log(
    `\n${apply ? 'Deleted' : 'Would delete'}: ` +
      `${legacy ? 1 : 0} staging profile, ${reservations.length} reservation(s), ` +
      `${messages.length} message(s), ${deleted} object(s)`,
  )
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)

  // Before the connection: a missing argument should not cost a round trip to
  // Atlas to find out about.
  const email = argOf('--email')
  const legacyId = argOf('--legacy-id')
  if (!email && !legacyId) throw new Error('--email <address> or --legacy-id <id> is required')
  if (email && !env.LEGACY_EMAIL_HASH_SALT) {
    throw new Error('LEGACY_EMAIL_HASH_SALT is required to look an address up')
  }
  const target: Target = {
    email,
    legacyId,
    hash: email ? hashLegacyEmail(email, env.LEGACY_EMAIL_HASH_SALT!) : undefined,
  }

  const storage = createStorageProvider(env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  try {
    await run(handle.db, target, storage, apply)
    if (!apply) console.log('\nDry run. Pass --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
