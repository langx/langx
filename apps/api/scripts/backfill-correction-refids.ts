/**
 * Re-keys existing `correction` ledger rows from the correction's id to the
 * post's, so that deleting a correction and writing a new one cannot be paid
 * twice.
 *
 * A correction used to be undeletable, so keying its award on the row was
 * safe. Now that it can be deleted, a fresh row means a fresh `refId` and a
 * second payment from the same post — unless the award is keyed on the post
 * instead, which is what `correctionRefId` now does. The ledger's existing
 * `{userId, kind, refId}` unique index then *is* the rule "paid once per post
 * per person", with no extra read.
 *
 * Every row written before that change still carries the old key. Until this
 * has run, one user deleting one pre-existing correction and rewriting it is
 * paid a second time. Bounded and one-time, but silent — nothing fails, the
 * ledger simply gains a row it should not have.
 *
 * **Idempotent.** A row already carrying a `postcorr:` key is skipped, so a
 * re-run after a partial failure only finishes the job.
 *
 * A row whose correction no longer exists is left alone and reported. It
 * cannot be re-keyed — there is nothing left to read the post id from — and it
 * cannot be double-paid either, because the correction it paid for is gone and
 * `post_author_unique` was released with it. That combination is only reachable
 * through the account purge, which deletes nothing here.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/backfill-correction-refids.ts          # dry run
 *   pnpm --filter @langx/api exec tsx scripts/backfill-correction-refids.ts --apply
 */
import { ObjectId, type Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { correctionRefId } from '../src/modules/feed/feed'

interface LedgerRow {
  _id: ObjectId
  userId: string
  refId?: string
}

async function backfill(
  db: Db,
  apply: boolean,
): Promise<{ seen: number; written: number; orphaned: number }> {
  const rows = await db
    .collection<LedgerRow>(COLLECTIONS.tokenLedger)
    .find({ kind: 'correction', refId: { $exists: true, $not: /^postcorr:/ } })
    .toArray()

  let written = 0
  let orphaned = 0

  for (const row of rows) {
    if (!row.refId || !ObjectId.isValid(row.refId)) {
      orphaned++
      continue
    }
    const correction = await db
      .collection<{ postId: ObjectId }>(COLLECTIONS.postCorrections)
      .findOne({ _id: new ObjectId(row.refId) }, { projection: { postId: 1 } })
    if (!correction) {
      orphaned++
      continue
    }

    written++
    if (apply) {
      await db
        .collection<LedgerRow>(COLLECTIONS.tokenLedger)
        .updateOne({ _id: row._id }, { $set: { refId: correctionRefId(correction.postId) } })
    }
  }

  return { seen: rows.length, written, orphaned }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv()
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    const { seen, written, orphaned } = await backfill(handle.db, apply)
    console.log(
      `tokenLedger: ${seen} correction rows on the old key, ${written} ${apply ? 'rewritten' : 'to rewrite'}, ${orphaned} left alone`,
    )
    if (!apply) console.log('\nDry run. Re-run with --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
