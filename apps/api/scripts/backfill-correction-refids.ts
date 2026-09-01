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
 * **Most rows this query returns are not post corrections at all.** A chat
 * correction pays under the same `correction` kind, with the message's `_id` as
 * its `refId` — on production that is 34 of the 35 rows. They are left alone,
 * correctly: a chat correction has no post, cannot be deleted and rewritten for
 * a second payment, and re-keying one would be meaningless.
 *
 * The same branch also covers a post correction whose row is genuinely gone. It
 * cannot be re-keyed — there is nothing left to read the post id from — and it
 * cannot be double-paid either, because `post_author_unique` was released with
 * it. Both are counted as `skipped`: the script cannot tell them apart and does
 * not need to, because the action is the same.
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
): Promise<{ seen: number; written: number; skipped: number }> {
  const rows = await db
    .collection<LedgerRow>(COLLECTIONS.tokenLedger)
    .find({ kind: 'correction', refId: { $exists: true, $not: /^postcorr:/ } })
    .toArray()

  let written = 0
  let skipped = 0

  for (const row of rows) {
    if (!row.refId || !ObjectId.isValid(row.refId)) {
      skipped++
      continue
    }
    // Not found: a chat correction, or a post correction since deleted.
    const correction = await db
      .collection<{ postId: ObjectId }>(COLLECTIONS.postCorrections)
      .findOne({ _id: new ObjectId(row.refId) }, { projection: { postId: 1 } })
    if (!correction) {
      skipped++
      continue
    }

    written++
    if (apply) {
      await db
        .collection<LedgerRow>(COLLECTIONS.tokenLedger)
        .updateOne({ _id: row._id }, { $set: { refId: correctionRefId(correction.postId) } })
    }
  }

  return { seen: rows.length, written, skipped }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv()
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    const { seen, written, skipped } = await backfill(handle.db, apply)
    console.log(
      `tokenLedger: ${seen} correction rows on the old key, ${written} ${apply ? 'rewritten' : 'to rewrite'}, ${skipped} not post corrections`,
    )
    if (!apply) console.log('\nDry run. Re-run with --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
