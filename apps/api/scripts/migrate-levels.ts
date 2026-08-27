/**
 * One-off: rewrites stored CEFR levels to v2's four-tier scale.
 *
 * `profiles.learning[].level` and `legacyProfiles.learning[].level` hold values
 * written before the switch — `A1`…`C2`. Nothing else converts them: the schema
 * now rejects those strings, so an untouched profile fails validation the first
 * time its owner edits it, and the discovery `minLevel` filter silently matches
 * nothing for them.
 *
 * The mapping under-claims on purpose (`CEFR_TO_LANGUAGE_LEVEL`): six bands
 * collapse to four, `C1` and `C2` both land on `fluent` because there is
 * nothing above it, and nobody is promoted by a migration they did not ask for.
 *
 * **Idempotent.** A document whose levels are already valid is left alone, so a
 * re-run after a partial failure only touches what is left.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/migrate-levels.ts            # dry run
 *   pnpm --filter @langx/api exec tsx scripts/migrate-levels.ts --apply
 */
import { CEFR_TO_LANGUAGE_LEVEL, LANGUAGE_LEVELS, type LanguageLevel } from '@langx/shared'
import type { Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'

const VALID = new Set<string>(LANGUAGE_LEVELS)

interface WithLearning {
  _id: string
  learning?: { code: string; level: string; priority?: number }[]
}

function convert(
  learning: WithLearning['learning'],
): { code: string; level: LanguageLevel }[] | null {
  if (!Array.isArray(learning) || learning.length === 0) return null
  let changed = false
  const next = learning.map((entry) => {
    if (VALID.has(entry.level)) return entry
    changed = true
    // An unrecognised value is not evidence of fluency — floor it.
    const level = CEFR_TO_LANGUAGE_LEVEL[entry.level] ?? 'absoluteBeginner'
    return { ...entry, level }
  })
  return changed ? (next as { code: string; level: LanguageLevel }[]) : null
}

async function migrate(db: Db, collection: string, apply: boolean): Promise<[number, number]> {
  const docs = await db.collection<WithLearning>(collection).find({}).toArray()
  let converted = 0
  for (const doc of docs) {
    const learning = convert(doc.learning)
    if (!learning) continue
    converted++
    if (apply) {
      await db
        .collection<WithLearning>(collection)
        .updateOne({ _id: doc._id }, { $set: { learning } })
    }
  }
  return [docs.length, converted]
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  console.log(apply ? 'Applying…' : 'Dry run — no writes…')
  for (const collection of [COLLECTIONS.profiles, COLLECTIONS.legacyProfiles]) {
    const [seen, converted] = await migrate(db, collection, apply)
    console.log(`${collection}: ${seen} seen, ${converted} needing conversion`)
  }
  if (!apply) console.log('\n(dry run — re-run with --apply to write)')

  await close()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
