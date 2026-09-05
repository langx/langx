/**
 * Split `profileViews` by day.
 *
 * The collection used to hold one row per (viewer, viewed) with a lifetime
 * counter, under a unique index on that pair. It now holds one row per
 * (viewer, viewed, UTC day). `ensureIndexes` only ever creates, so the old
 * unique has to go by hand, and it has to go *before* the new code is
 * deployed: with it still in place, the first person to look at a profile on
 * a second day is refused by the database.
 *
 * Idempotent: a row that already has `day` is left alone, an index that is
 * already gone is not an error, and the new index is created here as well so
 * a boot in between the two steps cannot find the collection unguarded.
 *
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env scripts/migrate-profile-views.ts
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod scripts/migrate-profile-views.ts
 */
import { utcDayKey } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { ProfileView } from '../src/modules/moderation/profileViews'

async function main(): Promise<void> {
  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  try {
    const views = db.collection<ProfileView>(COLLECTIONS.profileViews)

    let backfilled = 0
    const missing = views.find({ day: { $exists: false } })
    for await (const view of missing) {
      await views.updateOne({ _id: view._id }, { $set: { day: utcDayKey(view.lastViewedAt) } })
      backfilled++
    }
    console.log(`backfilled day on ${backfilled} rows`)

    const names = (await views.indexes()).map((index) => index.name)
    if (names.includes('viewer_viewed_unique')) {
      await views.dropIndex('viewer_viewed_unique')
      console.log('dropped viewer_viewed_unique')
    } else {
      console.log('viewer_viewed_unique already gone')
    }
    if (!names.includes('viewer_viewed_day_unique')) {
      await views.createIndex(
        { viewerId: 1, viewedId: 1, day: 1 },
        { name: 'viewer_viewed_day_unique', unique: true },
      )
      console.log('created viewer_viewed_day_unique')
    } else {
      console.log('viewer_viewed_day_unique already there')
    }
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
