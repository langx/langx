/**
 * Clears the hand-typed city off every profile, and drops the index that
 * served it.
 *
 * The field used to be a text box in two forms. It is now worked out from the
 * coordinates a profile already stores, so what is there is a mixture of
 * whatever people typed, mostly blank, and about to be contradicted by a value
 * derived from somewhere else. Cleared rather than migrated: a typed string
 * cannot be matched to a canonical id with any confidence, and guessing would
 * put people in the wrong place.
 *
 * `ensureIndexes` only ever creates indexes, so `city_key` has to be dropped
 * here — nothing else will ever remove it.
 *
 * **Idempotent.** A second run finds nothing to unset and no index to drop.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/unset-city.ts            # dry run
 *   pnpm --filter @langx/api exec tsx scripts/unset-city.ts --apply
 */
import type { Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'

async function run(db: Db, apply: boolean): Promise<void> {
  const profiles = db.collection(COLLECTIONS.profiles)
  const withCity = await profiles.countDocuments({
    $or: [{ city: { $exists: true } }, { cityKey: { $exists: true } }],
  })
  console.log(`${apply ? 'Clearing' : 'Would clear'} city on ${withCity} profiles`)
  if (apply && withCity > 0) {
    await profiles.updateMany(
      { $or: [{ city: { $exists: true } }, { cityKey: { $exists: true } }] },
      { $unset: { city: '', cityKey: '' } },
    )
  }

  const indexes = await profiles.indexes()
  const stale = indexes.find((index) => index.name === 'city_key')
  console.log(stale ? `${apply ? 'Dropping' : 'Would drop'} index city_key` : 'No city_key index')
  if (apply && stale) await profiles.dropIndex('city_key')
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
