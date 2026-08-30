/**
 * Fills `cityKey` on profiles that already have a `city`.
 *
 * `city` predates the filter that reads it: it has been in the schema since
 * the start, and `cityKey` is derived on write from now on. Without this pass
 * every profile written before today is invisible to the city filter — not an
 * error, just an empty result, which is the failure that looks like nobody
 * lives there.
 *
 * **Idempotent.** A profile whose stored key already matches what `cityKey`
 * would produce is skipped, so a re-run after a partial failure only finishes
 * the job — and a later change to the folding rules re-runs cleanly over
 * everyone.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/backfill-city-key.ts            # dry run
 *   pnpm --filter @langx/api exec tsx scripts/backfill-city-key.ts --apply
 */
import { cityKey } from '@langx/shared'
import type { Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'

interface WithCity {
  _id: string
  handle?: string
  city?: string
  cityKey?: string
}

async function backfill(
  db: Db,
  collection: string,
  apply: boolean,
): Promise<{ seen: number; written: number; blank: string[] }> {
  const docs = await db
    .collection<WithCity>(collection)
    .find({ city: { $exists: true, $ne: '' } })
    .toArray()

  let written = 0
  const blank: string[] = []

  for (const doc of docs) {
    if (!doc.city) continue
    const key = cityKey(doc.city)
    if (key === '') {
      // Punctuation only, or whitespace that survived the schema's `.trim()`.
      // Worth naming rather than silently writing an empty key that would
      // match every other unfillable city.
      blank.push(`${doc.handle ?? doc._id}: ${JSON.stringify(doc.city)}`)
      continue
    }
    if (doc.cityKey === key) continue
    written++
    if (apply) {
      await db
        .collection<WithCity>(collection)
        .updateOne({ _id: doc._id }, { $set: { cityKey: key } })
    }
  }

  return { seen: docs.length, written, blank }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv()
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    for (const collection of [COLLECTIONS.profiles, COLLECTIONS.legacyProfiles]) {
      const { seen, written, blank } = await backfill(handle.db, collection, apply)
      console.log(
        `${collection}: ${seen} with a city, ${written} ${apply ? 'written' : 'to write'}`,
      )
      for (const line of blank) console.log(`  unmatchable city — ${line}`)
    }
    if (!apply) console.log('\nDry run. Re-run with --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
