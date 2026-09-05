/**
 * Who the v1 loyalty gift will actually reach, from the staged records.
 *
 * Read-only. `LOYALTY_LIFETIME_GRANTS` cuts at two absolute balances that were
 * *derived* from v1's percentiles on a 1403-wallet snapshot, and the "roughly
 * 14 / roughly 140" beside them is what those cuts selected that day, not
 * something the code recomputes. This prints what they select from the
 * records that were actually staged, per rung and split by whether the owner
 * has already come back — so "is it ten people or ninety?" is a number rather
 * than a memory. It also prints the balance ladder at the top, without
 * names, so a rank-based rule can be compared with the threshold one.
 *
 *   pnpm --filter @langx/api exec tsx scripts/inspect-lifetime-cohort.ts
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod scripts/inspect-lifetime-cohort.ts
 */
import { LOYALTY_LIFETIME_GRANTS, lifetimeGrantFor } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { LegacyProfile } from '../src/modules/handles/legacyProfiles'
import type { Profile } from '../src/modules/profiles/profiles'

const env = loadEnv()
const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

const LADDER = 20

try {
  const balances: number[] = []
  const perRung = new Map<string, { staged: number; restored: number }>()
  for (const rung of LOYALTY_LIFETIME_GRANTS) perRung.set(rung.tier, { staged: 0, restored: 0 })
  let withBalance = 0
  let total = 0

  const cursor = db
    .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
    .find({}, { projection: { legacyTokenBalance: 1, restoredBy: 1 } })
  for await (const record of cursor) {
    total += 1
    if (typeof record.legacyTokenBalance !== 'number') continue
    withBalance += 1
    balances.push(record.legacyTokenBalance)
    const rung = lifetimeGrantFor(record.legacyTokenBalance)
    if (!rung) continue
    const bucket = perRung.get(rung.tier)!
    if (record.restoredBy) bucket.restored += 1
    else bucket.staged += 1
  }
  balances.sort((a, b) => b - a)

  // What the restore path actually recorded, which is the other half of the
  // answer: a rung the owner cleared but never received is the case
  // `reconcile-entitlements.ts` reports as "grant never landed".
  const granted = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .aggregate<{ _id: string | null; n: number }>([
      { $match: { 'restoredFromV1.lifetimeGranted': { $in: ['pro', 'pro_plus'] } } },
      { $group: { _id: '$restoredFromV1.lifetimeGranted', n: { $sum: 1 } } },
    ])
    .toArray()

  console.log(`db                     ${env.MONGODB_DB}`)
  console.log(`legacy profiles        ${total}, ${withBalance} with a balance`)
  console.log('\nrung                       min balance   staged  restored')
  for (const rung of LOYALTY_LIFETIME_GRANTS) {
    const b = perRung.get(rung.tier)!
    console.log(
      `  ${rung.tier.padEnd(24)} ${String(rung.minLegacyTokenBalance).padStart(11)}  ${String(b.staged).padStart(6)}  ${String(b.restored).padStart(8)}`,
    )
  }
  console.log('\ngranted on restore (profiles.restoredFromV1.lifetimeGranted)')
  for (const row of granted) console.log(`  ${String(row._id).padEnd(24)} ${row.n}`)
  if (granted.length === 0) console.log('  none')

  console.log(`\ntop ${LADDER} balances`)
  balances.slice(0, LADDER).forEach((balance, index) => {
    const rung = lifetimeGrantFor(balance)
    console.log(
      `  #${String(index + 1).padEnd(3)} ${String(balance).padStart(10)}  ${rung?.tier ?? '—'}`,
    )
  })
} finally {
  await close()
}
