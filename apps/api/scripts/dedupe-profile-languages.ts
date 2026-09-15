/**
 * Removes languages a profile lists twice.
 *
 * Between #1381 and the fix that follows it, the languages screen applied one
 * tap to its own optimistic write and sent the result: adding a language put
 * two identical entries in the request, and the API stores what it is given —
 * nothing refuses a code repeated inside a single list, because until now
 * nothing could produce one.
 *
 * A duplicate is not cosmetic. The × removes by code, so on the fixed build it
 * takes every copy at once — which is the repair, unless the duplicated
 * language is the whole list. Then the write that would empty it is refused
 * (`min(1)`), and the person is left with two rows they cannot touch. That is
 * the case this exists for.
 *
 * The first occurrence wins, with `learning` renumbered 1..n afterwards so the
 * priorities left behind are a sequence again rather than a gap. Idempotent: a
 * second run finds nothing.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/dedupe-profile-languages.ts            # dry run
 *   pnpm --filter @langx/api exec tsx scripts/dedupe-profile-languages.ts --apply
 *
 * Against production, per docs/self-host.md:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/dedupe-profile-languages.ts
 */
import type { AnyBulkWriteOperation, Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { Profile } from '../src/modules/profiles/profiles'

function firstOfEachCode<T extends { code: string }>(entries: T[]): T[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    if (seen.has(entry.code)) return false
    seen.add(entry.code)
    return true
  })
}

async function run(db: Db, apply: boolean): Promise<void> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)

  // Deleted profiles are left alone: nobody reads their languages, and a
  // repair on one is a write with no reader.
  const rows = await profiles
    .find(
      { deletedAt: { $exists: false } },
      { projection: { handle: 1, nativeLanguages: 1, learning: 1 } },
    )
    .toArray()

  const writes: AnyBulkWriteOperation<Profile>[] = []
  for (const row of rows) {
    const native = firstOfEachCode(row.nativeLanguages ?? [])
    // Sorted before renumbering, so the order the reader arranged survives —
    // stored order and priority order are two statements and only the second
    // is theirs.
    const learning = firstOfEachCode(
      [...(row.learning ?? [])].sort((a, b) => a.priority - b.priority),
    ).map((entry, index) => ({ ...entry, priority: index + 1 }))

    const nativeDropped = (row.nativeLanguages?.length ?? 0) - native.length
    const learningDropped = (row.learning?.length ?? 0) - learning.length
    if (nativeDropped === 0 && learningDropped === 0) continue

    console.log(
      `  @${row.handle}: native ${row.nativeLanguages?.map((l) => l.code).join(',')} → ` +
        `${native.map((l) => l.code).join(',')}; learning ` +
        `${row.learning?.map((l) => l.code).join(',')} → ${learning.map((l) => l.code).join(',')}`,
    )
    writes.push({
      updateOne: {
        filter: { _id: row._id },
        update: { $set: { nativeLanguages: native, learning, updatedAt: new Date() } },
      },
    })
  }

  console.log(`${rows.length} live profiles, ${writes.length} carrying a duplicate`)
  if (writes.length === 0) return

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
