/**
 * Rebuilds the week, month and year rows of `tokenAggregates` for everybody
 * who has ever been paid a reward.
 *
 * The hourly gift, bounties, report rewards and the referral payouts were
 * grant kinds until `TOKEN_GRANT_KINDS` shrank to the three account-lifecycle
 * credits, so every one paid before then was credited to all-time and to
 * nothing else. `awardTokens` only writes forwards; this is what puts the old
 * rows on the leaderboard, and after that it is a repair for the crash window
 * between the ledger insert and the `$inc`.
 *
 * It recomputes from the ledger rather than adding the old rewards on: the
 * ledger is the source of truth and every row already carries its period
 * keys, so a sum is the honest answer and a second run finds nothing to do.
 * All-time is left alone — grants and rewards both reached it all along.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/backfill-reward-periods.ts            # dry run
 *   pnpm --filter @langx/api exec tsx scripts/backfill-reward-periods.ts --apply
 *
 * Against production, per docs/self-host.md:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/backfill-reward-periods.ts
 */
import { TOKEN_GRANT_KINDS, aggregateId, type PeriodType, type TokenKind } from '@langx/shared'
import type { AnyBulkWriteOperation, Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { TokenAggregate, TokenLedgerEntry } from '../src/modules/tokens/ledger'

const FORMERLY_GRANTED: readonly TokenKind[] = [
  'gift',
  'bounty',
  'reportReward',
  'referral',
  'referralSubscription',
  'referralWelcome',
]

/** Grants credit all-time only and a spend credits nothing; everything else lands in every period. */
const RANKED_KINDS_EXCLUDED: readonly TokenKind[] = [...TOKEN_GRANT_KINDS, 'spend']

const RANKED_PERIODS = ['week', 'month', 'year'] as const satisfies readonly PeriodType[]

interface Counter {
  userId: string
  periodType: PeriodType
  periodKey: string
  tokens: number
}

async function run(db: Db, apply: boolean): Promise<void> {
  const ledger = db.collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
  const aggregates = db.collection<TokenAggregate>(COLLECTIONS.tokenAggregates)

  const userIds = await ledger.distinct('userId', { kind: { $in: [...FORMERLY_GRANTED] } })
  console.log(`${userIds.length} people have been paid a reward`)
  if (userIds.length === 0) return

  // Every ranked row of theirs, tallied into the period keys it was written
  // with — not recomputed from `createdAt`, so a row lands where its award did.
  const wanted = new Map<string, Counter>()
  const cursor = ledger.find(
    { userId: { $in: userIds }, kind: { $nin: [...RANKED_KINDS_EXCLUDED] } },
    { projection: { userId: 1, amount: 1, week: 1, month: 1, year: 1 } },
  )
  for await (const row of cursor) {
    for (const periodType of RANKED_PERIODS) {
      const periodKey = row[periodType]
      const id = aggregateId(row.userId, periodType, periodKey)
      const counter = wanted.get(id)
      if (counter) counter.tokens += row.amount
      else wanted.set(id, { userId: row.userId, periodType, periodKey, tokens: row.amount })
    }
  }

  const stored = new Map(
    (
      await aggregates
        .find({ userId: { $in: userIds }, periodType: { $in: [...RANKED_PERIODS] } })
        .toArray()
    ).map((row) => [row._id, row.tokens]),
  )

  const now = new Date()
  const writes: AnyBulkWriteOperation<TokenAggregate>[] = []
  for (const [id, counter] of wanted) {
    if (stored.get(id) === counter.tokens) continue
    writes.push({
      updateOne: {
        filter: { _id: id },
        update: {
          $set: { tokens: counter.tokens, updatedAt: now },
          $setOnInsert: {
            userId: counter.userId,
            periodType: counter.periodType,
            periodKey: counter.periodKey,
          },
        },
        upsert: true,
      },
    })
  }

  console.log(`${wanted.size} rows derived, ${writes.length} wrong or missing`)
  if (writes.length === 0) return

  for (const [id, counter] of [...wanted]
    .filter(([id]) => stored.get(id) !== wanted.get(id)?.tokens)
    .slice(0, 5)) {
    console.log(`  ${id}: ${stored.get(id) ?? 'absent'} → ${counter.tokens}`)
  }

  if (apply) {
    // Unordered, so one row that fails does not stop the rest.
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
