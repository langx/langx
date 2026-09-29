/**
 * Folds the retired Polyglot tier (`pro_plus`) into Pro in stored documents,
 * and hands ex-Fluent subscribers the part of the Pro welcome pack they did not
 * get. See `docs/decisions.md` → "One plan: Pro".
 *
 * What it rewrites, `pro_plus` → `pro` in each:
 *
 * - `profiles.entitlement.tier` — the one every guard reads. The code already
 *   reads `pro_plus` as Pro (`normalizePlanTier`), so this is tidiness and the
 *   end of the two-spelling Mongo queries, not a fix anybody is waiting on.
 * - `profiles.churnedFrom.tier` — the plan-ended letter names it.
 * - `profiles.restoredFromV1.lifetimeGranted` — the v1 gift's record.
 * - `referrals.subscriptionTier` — the invite screen's audit.
 *
 * What it deliberately leaves alone: `profiles.welcomePackAt`. Both keys mean
 * "the pack was given" to `grantWelcomePack`, and rewriting `pro_plus` to
 * `pro` would change nothing there while losing which pack somebody had.
 *
 * The one grant: a live subscriber whose pack latch is `pro` only — who
 * subscribed to Fluent and so got its two frames — gets the rest of the single
 * pack (`welcomePackDelta`), cosmetics only. No streak freezes: they had those
 * with the first pack.
 *
 * Idempotent: a second run finds no `pro_plus` and nothing missing from anyone's
 * pack. Run it after the single-plan API is live on every machine — an old
 * machine's refresh would write `pro_plus` again — and re-run until it reports
 * zero.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/merge-pro-tiers.ts            # dry run
 *   pnpm --filter @langx/api exec tsx scripts/merge-pro-tiers.ts --apply
 *
 * Against production, per docs/self-host.md:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/merge-pro-tiers.ts
 */
import { welcomePackDelta } from '@langx/shared'
import type { AnyBulkWriteOperation, Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { Profile } from '../src/modules/profiles/profiles'
import type { Referral } from '../src/modules/referrals/referrals'

const RETIRED = 'pro_plus'

async function rewriteTiers(db: Db, apply: boolean): Promise<void> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const referrals = db.collection<Referral>(COLLECTIONS.referrals)

  const fields = [
    ['profiles', 'entitlement.tier'],
    ['profiles', 'churnedFrom.tier'],
    ['profiles', 'restoredFromV1.lifetimeGranted'],
    ['referrals', 'subscriptionTier'],
  ] as const

  for (const [collection, field] of fields) {
    const target = collection === 'profiles' ? profiles : referrals
    const filter = { [field]: RETIRED }
    const count = await target.countDocuments(filter)
    console.log(`${collection}.${field.padEnd(32)} ${RETIRED} ${String(count).padStart(6)}`)
    if (apply && count > 0) {
      const result = await target.updateMany(filter, { $set: { [field]: 'pro' } })
      console.log(`  rewrote ${result.modifiedCount}`)
    }
  }
}

async function topUpFluentPacks(db: Db, apply: boolean): Promise<void> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const now = new Date()

  const rows = await profiles
    .find(
      {
        deletedAt: { $exists: false },
        'entitlement.tier': { $in: ['pro', RETIRED] },
        $or: [
          { 'entitlement.expiresAt': { $exists: false } },
          { 'entitlement.expiresAt': { $gt: now } },
        ],
        'welcomePackAt.pro': { $exists: true },
        'welcomePackAt.pro_plus': { $exists: false },
      },
      { projection: { handle: 1, cosmetics: 1 } },
    )
    .toArray()

  const writes: AnyBulkWriteOperation<Profile>[] = []
  for (const row of rows) {
    const missing = welcomePackDelta('pro', row.cosmetics ?? [])
    if (missing.length === 0) continue
    console.log(`  @${row.handle.padEnd(20)} + ${missing.join(', ')}`)
    writes.push({
      updateOne: {
        filter: { _id: row._id },
        update: { $addToSet: { cosmetics: { $each: [...missing] } } },
      },
    })
  }

  console.log(`ex-Fluent subscribers ${rows.length}, missing part of the pack ${writes.length}`)
  if (apply && writes.length > 0) {
    // Unordered, so one profile that fails does not stop the rest.
    const result = await profiles.bulkWrite(writes, { ordered: false })
    console.log(`  topped up ${result.modifiedCount}`)
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  try {
    console.log(`db ${env.MONGODB_DB}`)
    // The pack first: its filter reads the latch, not the tier, so the order
    // does not matter for correctness — but a dry run reads better this way.
    await topUpFluentPacks(handle.db, apply)
    await rewriteTiers(handle.db, apply)
    if (!apply) console.log('Dry run. Pass --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
