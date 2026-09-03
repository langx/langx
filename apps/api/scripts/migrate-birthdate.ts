/**
 * One-off: `birthYear: 1995` → `birthDate: '1995-01-01'`.
 *
 * It used to convert `settings.notifications` in the same pass, flattening
 * every shape to one boolean per kind. That half is gone. The channel axis is
 * back — a preference is `{push, email}` again — so the conversion would now
 * destroy the very choices it once tidied up, and it has already run against
 * every document that needed it.
 *
 * v2 stores the whole calendar day now — for the age gate, which is unchanged,
 * and for birthdays, which are the point. Documents written before the switch
 * only have the year, and the day and month of somebody's birth cannot be
 * derived from anything: **the date this writes is a placeholder**. It keeps
 * the year, so nobody's age changes and no profile is left unreadable by a
 * schema that now requires the field, and it is deliberately January the 1st
 * so a wrong birthday is obvious rather than plausible.
 *
 * The handles it touches are printed for exactly that reason: a real account
 * among them should be corrected by hand, with `--set`.
 *
 * **Idempotent.** A document that already has `birthDate` is left alone, so a
 * re-run after a partial failure only finishes the job.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/migrate-birthdate.ts                  # dry run
 *   pnpm --filter @langx/api exec tsx scripts/migrate-birthdate.ts --apply
 *   pnpm --filter @langx/api exec tsx scripts/migrate-birthdate.ts --set ada=1994-03-07 --apply
 */
import { isCalendarDate } from '@langx/shared'
import type { Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'

interface WithBirth {
  _id: string
  handle?: string
  birthYear?: number
  birthDate?: string
}

/** `--set handle=YYYY-MM-DD`, repeatable. */
function parseOverrides(argv: string[]): Map<string, string> {
  const overrides = new Map<string, string>()
  argv.forEach((arg, index) => {
    if (arg !== '--set') return
    const [handle, date] = (argv[index + 1] ?? '').split('=')
    if (!handle || !date || !isCalendarDate(date)) {
      throw new Error(`--set expects handle=YYYY-MM-DD, got "${argv[index + 1] ?? ''}"`)
    }
    overrides.set(handle, date)
  })
  return overrides
}

async function migrate(
  db: Db,
  collection: string,
  apply: boolean,
  overrides: Map<string, string>,
): Promise<{ seen: number; converted: string[] }> {
  const docs = await db.collection<WithBirth>(collection).find({}).toArray()
  const converted: string[] = []

  for (const doc of docs) {
    const override = doc.handle ? overrides.get(doc.handle) : undefined
    // An override is applied even to a document that already migrated: that is
    // the whole point of it, correcting a placeholder someone was given.
    if (doc.birthDate !== undefined && !override) continue
    if (doc.birthYear === undefined && !override) continue

    const birthDate = override ?? `${doc.birthYear}-01-01`
    converted.push(`${doc.handle ?? doc._id} → ${birthDate}${override ? ' (--set)' : ''}`)
    if (apply) {
      await db
        .collection<WithBirth>(collection)
        .updateOne({ _id: doc._id }, { $set: { birthDate }, $unset: { birthYear: '' } })
    }
  }

  return { seen: docs.length, converted }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const overrides = parseOverrides(process.argv)
  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  console.log(`${apply ? 'Applying' : 'Dry run'} on ${env.MONGODB_DB}…`)
  for (const collection of [COLLECTIONS.profiles, COLLECTIONS.legacyProfiles]) {
    const { seen, converted } = await migrate(db, collection, apply, overrides)
    console.log(`\n${collection}: ${seen} seen, ${converted.length} birth dates`)
    for (const line of converted) console.log(`  ${line}`)
  }
  if (!apply) console.log('\n(dry run — re-run with --apply to write)')

  await close()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
