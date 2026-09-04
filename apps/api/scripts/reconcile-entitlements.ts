/**
 * Finds v1 returners whose stored tier disagrees with the lifetime gift they
 * were granted, and — with `--apply` — re-reads each one from RevenueCat.
 *
 * Why this can happen: the gift is two promotional grants (`pro_plus`, then
 * `pro`), each of which RevenueCat reports as its own webhook event. Until
 * 4 September 2026 the handler wrote the tier from each event alone, so the
 * trailing `pro` event downgraded every Polyglot to Fluent. The webhook now
 * reconciles against the subscriber record; this script is the same
 * reconciliation for accounts that were downgraded before the fix and have
 * not touched the paywall since.
 *
 * Never writes the tier directly. `refreshEntitlement` is the one writer, and
 * RevenueCat the one authority — a tier set here by hand would be undone by
 * the next `/billing/refresh`, which is the whole lesson of the bug.
 *
 *   pnpm --filter @langx/api exec tsx scripts/reconcile-entitlements.ts            # report only
 *   pnpm --filter @langx/api exec tsx scripts/reconcile-entitlements.ts --apply    # repair
 *
 * Against production, add `--env-file=../../.env --env-file=../../.env.prod`
 * before the script path — the overlay is what makes touching production an
 * explicit extra flag.
 *
 * Also reports, without repairing, a rarer loss: restores whose grant threw
 * and was swallowed (`tryGrantLifetime` logs and returns `null`), detected as
 * a restored profile with no `lifetimeGranted` whose staged v1 balance clears
 * a rung. Re-granting those is a decision, not a flag.
 */
import { lifetimeGrantFor } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { createRevenueCatClientFromEnv } from '../src/modules/billing/createRevenueCatClient'
import { refreshEntitlement } from '../src/modules/billing/refresh'
import type { LegacyProfile } from '../src/modules/handles/legacyProfiles'
import type { Profile } from '../src/modules/profiles/profiles'

const apply = process.argv.includes('--apply')
const env = loadEnv()
const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

try {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const gifted = await profiles
    .find({ 'restoredFromV1.lifetimeGranted': { $in: ['pro', 'pro_plus'] } })
    .project<Pick<Profile, '_id' | 'handle' | 'entitlement' | 'restoredFromV1'>>({
      handle: 1,
      entitlement: 1,
      restoredFromV1: 1,
    })
    .toArray()

  const wrong = gifted.filter((p) => p.entitlement.tier !== p.restoredFromV1?.lifetimeGranted)

  console.log(`db                       ${env.MONGODB_DB}`)
  console.log(`gifted a lifetime tier   ${gifted.length}`)
  console.log(`stored tier disagrees    ${wrong.length}`)
  for (const p of wrong) {
    console.log(
      `  @${p.handle.padEnd(20)} granted ${p.restoredFromV1?.lifetimeGranted}  stored ${p.entitlement.tier}`,
    )
  }

  if (apply && wrong.length > 0) {
    const client = createRevenueCatClientFromEnv(env)
    let repaired = 0
    for (const p of wrong) {
      const next = await refreshEntitlement(db, client, p._id)
      console.log(`  @${p.handle.padEnd(20)} → ${next.tier}`)
      if (next.tier === p.restoredFromV1?.lifetimeGranted) repaired += 1
    }
    console.log(`repaired                 ${repaired} / ${wrong.length}`)
  } else if (wrong.length > 0) {
    console.log('\nRe-run with --apply to reconcile each one from RevenueCat.')
  }

  /*
   * The silent loss, reported only. A restore that earned a rung but holds no
   * `lifetimeGranted` means the primary grant threw and was swallowed; the
   * staged record still says what they earned.
   */
  const ungifted = await profiles
    .find({ restoredFromV1: { $exists: true }, 'restoredFromV1.lifetimeGranted': null })
    .project<Pick<Profile, '_id' | 'handle'>>({ handle: 1 })
    .toArray()
  const staged = db.collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
  const missed: string[] = []
  for (const p of ungifted) {
    const legacy = await staged.findOne(
      { restoredBy: p._id },
      { projection: { legacyTokenBalance: 1 } },
    )
    const rung = lifetimeGrantFor(legacy?.legacyTokenBalance)
    if (rung) missed.push(`  @${p.handle.padEnd(20)} earned ${rung.tier}, holds nothing`)
  }
  console.log(`\ngrant never landed       ${missed.length}`)
  for (const line of missed) console.log(line)
  if (missed.length > 0) {
    console.log('These need a decision, not this script: see LOYALTY_LIFETIME_GRANTS.')
  }
} finally {
  await close()
}
