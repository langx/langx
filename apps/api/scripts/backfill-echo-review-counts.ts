/**
 * Rebuilds `echoAggregates` from the rows in `echoReviews`.
 *
 * The counters are what the review board sorts by, and they are written
 * forwards by `submitReviews` — so every card answered before the collection
 * existed counts for nothing until this has run once. After that it is a
 * repair: the counters are `$inc`'d after the review rows are written, and a
 * crash in that window leaves one low.
 *
 * **Idempotent.** It counts every row into its four periods and writes only
 * the counters that disagree, so a second run finds nothing to do.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/backfill-echo-review-counts.ts            # dry run
 *   pnpm --filter @langx/api exec tsx scripts/backfill-echo-review-counts.ts --apply
 *
 * Against production, per docs/self-host.md:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/backfill-echo-review-counts.ts
 */
import { aggregateId, periodKeys, type PeriodType } from '@langx/shared'
import type { AnyBulkWriteOperation, Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { EchoAggregate, EchoReviewDoc } from '../src/modules/echo/documents'

interface Counter {
  userId: string
  periodType: PeriodType
  periodKey: string
  reviews: number
}

async function run(db: Db, apply: boolean): Promise<void> {
  const aggregates = db.collection<EchoAggregate>(COLLECTIONS.echoAggregates)

  /*
   * Every row, tallied in memory into the four periods its own `at` belongs
   * to. This is the scan the counters exist to keep off the read path — here
   * it runs once, by hand, rather than every time somebody opens the board.
   *
   * In memory rather than in an aggregation pipeline because the week key is
   * ISO-8601 week-numbering: `periodKeys` already knows it, and `$isoWeekYear`
   * plus a `$concat` is the same rule written twice, in a second language,
   * where it can drift.
   */
  const wanted = new Map<string, Counter>()
  const cursor = db
    .collection<EchoReviewDoc>(COLLECTIONS.echoReviews)
    .find({}, { projection: { userId: 1, at: 1 } })
  for await (const row of cursor) {
    const keys = periodKeys(row.at)
    for (const periodType of Object.keys(keys) as PeriodType[]) {
      const periodKey = keys[periodType]
      const id = aggregateId(row.userId, periodType, periodKey)
      const counter = wanted.get(id)
      if (counter) counter.reviews += 1
      else wanted.set(id, { userId: row.userId, periodType, periodKey, reviews: 1 })
    }
  }

  const stored = new Map((await aggregates.find({}).toArray()).map((row) => [row._id, row.reviews]))

  const now = new Date()
  const writes: AnyBulkWriteOperation<EchoAggregate>[] = []
  for (const [id, counter] of wanted) {
    if (stored.get(id) === counter.reviews) continue
    writes.push({
      updateOne: {
        filter: { _id: id },
        update: {
          $set: {
            userId: counter.userId,
            periodType: counter.periodType,
            periodKey: counter.periodKey,
            reviews: counter.reviews,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    })
  }

  console.log(`${wanted.size} counters derived, ${writes.length} wrong or missing`)
  if (writes.length === 0) return

  for (const [id, counter] of [...wanted].slice(0, 5)) {
    console.log(`  ${id}: ${stored.get(id) ?? 'absent'} → ${counter.reviews}`)
  }

  if (apply) {
    // Unordered, so one counter that fails does not stop the rest.
    const result = await aggregates.bulkWrite(writes, { ordered: false })
    console.log(`Wrote ${result.modifiedCount + result.upsertedCount}`)
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
