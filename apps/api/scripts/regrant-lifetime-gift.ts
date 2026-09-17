/**
 * Re-grants the v1 loyalty gift to one account, and reads it back.
 *
 * `reconcile-entitlements.ts` lists the returners whose gift never landed
 * (`tryGrantLifetime` failed and was swallowed, so RevenueCat holds nothing
 * and every `/billing/refresh` since has written `free`) and stops there,
 * because re-granting is a decision. This is that decision, taken for one
 * handle: it shows everything the decision needs, and with `--apply` makes
 * the same promotional grants the restore would have, then runs the same
 * refresh — so the tier lands the way every other tier does, from RevenueCat,
 * and the next refresh keeps it rather than erasing it.
 *
 *   pnpm --filter @langx/api exec tsx scripts/regrant-lifetime-gift.ts --handle <h>            # report only
 *   pnpm --filter @langx/api exec tsx scripts/regrant-lifetime-gift.ts --handle <h> --apply    # grant + refresh
 *
 * Against production, add `--env-file=../../.env --env-file=../../.env.prod`
 * before the script path — the overlay is what makes touching production an
 * explicit extra flag.
 *
 * The rung comes from the staged v1 balance, as it did at restore. `--tier
 * pro_plus` (or `pro`) grants that rung instead, for the case where the
 * staged record is missing or the balance is not the whole story.
 */
import { LOYALTY_LIFETIME_GRANTS, lifetimeGrantFor, type PaidPlanTier } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { createRevenueCatClientFromEnv } from '../src/modules/billing/createRevenueCatClient'
import { refreshEntitlement } from '../src/modules/billing/refresh'
import type { SubscriptionRecord } from '../src/modules/billing/webhook'
import type { LegacyProfile } from '../src/modules/handles/legacyProfiles'
import type { Profile } from '../src/modules/profiles/profiles'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const handle = arg('handle')
if (!handle) throw new Error('usage: --handle <handle> [--tier pro_plus|pro] [--apply]')
const apply = process.argv.includes('--apply')
const tierOverride = arg('tier')
if (tierOverride && !LOYALTY_LIFETIME_GRANTS.some((r) => r.tier === tierOverride)) {
  throw new Error(`--tier must be one of ${LOYALTY_LIFETIME_GRANTS.map((r) => r.tier).join(', ')}`)
}

const env = loadEnv()
const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

try {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  // `previousHandle` too: the name a person reports is often the one they
  // just left, and the old one still resolves everywhere else.
  const profile = await profiles.findOne({ $or: [{ handle }, { previousHandle: handle }] })
  if (!profile) throw new Error(`no profile holds @${handle}`)

  const legacy = await db
    .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
    .findOne({ restoredBy: profile._id }, { projection: { legacyTokenBalance: 1 } })
  const earned = lifetimeGrantFor(legacy?.legacyTokenBalance)
  const rung = tierOverride
    ? LOYALTY_LIFETIME_GRANTS.find((r) => r.tier === (tierOverride as PaidPlanTier))
    : earned

  const events = await db
    .collection<SubscriptionRecord>(COLLECTIONS.subscriptions)
    .find({ userId: profile._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray()

  const client = createRevenueCatClientFromEnv(env)
  const held = await client.getEntitlement(profile._id)

  console.log(`db                     ${env.MONGODB_DB}`)
  console.log(`profile                @${profile.handle}  (${profile._id})`)
  if (profile.previousHandle) {
    console.log(
      `previous handle        @${profile.previousHandle}  changed ${profile.handleChangedAt?.toISOString() ?? '?'}`,
    )
  }
  console.log(`stored entitlement     ${JSON.stringify(profile.entitlement)}`)
  if (profile.churnedFrom)
    console.log(`churned from           ${JSON.stringify(profile.churnedFrom)}`)
  console.log(`restoredFromV1         ${JSON.stringify(profile.restoredFromV1 ?? null)}`)
  console.log(`staged v1 balance      ${legacy?.legacyTokenBalance ?? 'no staged record'}`)
  console.log(`rung earned            ${earned?.tier ?? 'none'}`)
  console.log(
    `revenuecat holds now   ${held ? `${held.tier} (${held.productId}, ${held.store})` : 'nothing'}`,
  )
  console.log(`webhook events         ${events.length === 0 ? 'none' : ''}`)
  for (const e of events) {
    console.log(
      `  ${e.createdAt.toISOString()}  ${e.type.padEnd(20)} ${e.store.padEnd(12)} ${e.productId}`,
    )
  }

  if (!rung) {
    console.log('\nNothing to grant: no rung earned and no --tier given.')
  } else if (!apply) {
    console.log(`\nRe-run with --apply to grant ${rung.tier} for life and refresh the stored tier.`)
  } else {
    // The same order as `tryGrantLifetime`: the primary entitlement decides
    // the tier, the rest mirror what the products grant (Pro+ also holds
    // `pro`). A promotional grant is an upsert on RevenueCat's side, so this
    // is safe to run against an account that already holds one.
    for (const entitlement of rung.entitlements) {
      await client.grantLifetimeEntitlement(profile._id, entitlement)
      console.log(`granted                ${entitlement} (lifetime)`)
    }
    const next = await refreshEntitlement(db, client, profile._id)
    console.log(`stored tier now        ${next.tier}`)
    // What the welcome-back screen and `reconcile-entitlements.ts` read; only
    // where a restore wrote the parent, since a profile that never came back
    // from v1 has no such record to correct.
    if (profile.restoredFromV1) {
      await profiles.updateOne(
        { _id: profile._id },
        { $set: { 'restoredFromV1.lifetimeGranted': rung.tier } },
      )
    }
  }
} finally {
  await close()
}
