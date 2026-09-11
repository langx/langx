/**
 * Fills in `nameTokens` on profiles written before the search box could match
 * a name.
 *
 * Search used to look at `handle` alone. It now also matches the start of any
 * word in `displayName`, and it does that through `nameTokens` — a derived
 * array with a multikey index behind it, because a case-insensitive regex over
 * free text cannot use an index at all. Every write since sets the field; this
 * is for the profiles already on file, which are otherwise findable by their
 * username and by nothing else.
 *
 * **Idempotent, and self-healing.** It re-derives every profile's tokens and
 * writes only the ones that come out different, so a second run finds nothing
 * to do — and a future change to `nameTokens` is applied by running it again
 * rather than by a new script.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/backfill-name-tokens.ts            # dry run
 *   pnpm --filter @langx/api exec tsx scripts/backfill-name-tokens.ts --apply
 *
 * Against production, per docs/self-host.md:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/backfill-name-tokens.ts
 */
import type { AnyBulkWriteOperation, Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { nameTokens } from '../src/modules/profiles/nameTokens'
import type { Profile } from '../src/modules/profiles/profiles'

/** Same tokens in the same order, or not. */
function matches(stored: string[] | undefined, derived: string[]): boolean {
  return (
    stored !== undefined &&
    stored.length === derived.length &&
    stored.every((token, index) => token === derived[index])
  )
}

async function run(db: Db, apply: boolean): Promise<void> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)

  // Deleted profiles are left alone: nothing can search them up, so a token
  // array on one is an index entry that no query will ever read.
  const rows = await profiles
    .find({ deletedAt: { $exists: false } }, { projection: { displayName: 1, nameTokens: 1 } })
    .toArray()

  const writes: AnyBulkWriteOperation<Profile>[] = []
  for (const row of rows) {
    const derived = nameTokens(row.displayName)
    if (matches(row.nameTokens, derived)) continue
    writes.push({
      updateOne: { filter: { _id: row._id }, update: { $set: { nameTokens: derived } } },
    })
  }

  console.log(`${rows.length} live profiles, ${writes.length} without usable tokens`)
  if (writes.length === 0) return

  const sample = writes.slice(0, 5).map((write) => {
    const update = write as { updateOne: { filter: { _id: string } } }
    const row = rows.find((candidate) => candidate._id === update.updateOne.filter._id)!
    return `  ${row.displayName || '(no name)'} → [${nameTokens(row.displayName).join(', ')}]`
  })
  console.log(sample.join('\n'))

  if (apply) {
    // Unordered, so one profile that fails does not stop the rest.
    const result = await profiles.bulkWrite(writes, { ordered: false })
    console.log(`Wrote ${result.modifiedCount}`)
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  try {
    await run(handle.db, apply)
    if (!apply) console.log('Dry run. Pass --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
