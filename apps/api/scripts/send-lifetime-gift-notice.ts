/**
 * Tells the people who were already given the v1 loyalty lifetime tier that
 * they have it — the backfill behind `modules/handles/lifetimeGiftNotice.ts`,
 * which from now on says it as the grant lands.
 *
 * Everybody granted one before that existed got it in silence: the tier was
 * written, the welcome pack handed over, and the only place it was ever said
 * was the welcome-back screen they tapped through during onboarding.
 *
 * Safe to re-run. `notifyLifetimeGift` claims `lifetimeGift:<userId>:once` in
 * `notificationLedger` before it sends anything, so a second pass — or a live
 * restore racing this — sends nothing twice. The dry run prints the three
 * numbers each letter would quote, which is the check worth doing: they come
 * from three different places and a wrong one is a lie about somebody's
 * wallet.
 *
 *   pnpm --filter @langx/api exec tsx scripts/send-lifetime-gift-notice.ts           # report only
 *   pnpm --filter @langx/api exec tsx scripts/send-lifetime-gift-notice.ts --apply   # send
 *
 * Against production, add `--env-file=../../.env --env-file=../../.env.prod`
 * before the script path — the overlay is what makes touching production an
 * explicit extra flag.
 */
import { TIER_NAMES, type PaidPlanTier } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { createEmailSender } from '../src/email/sender'
import { loadEnv, publicApiUrl } from '../src/env'
import type { LegacyProfile } from '../src/modules/handles/legacyProfiles'
import { notifyLifetimeGift } from '../src/modules/handles/lifetimeGiftNotice'
import { alreadyClaimed } from '../src/modules/notifications/ledger'
import { ensureOfficialAccounts } from '../src/modules/official/accounts'
import type { Profile } from '../src/modules/profiles/profiles'
import { ExpoPushSender } from '../src/modules/push/devices'
import { readAggregates } from '../src/modules/tokens/ledger'
import { walletOf } from '../src/modules/tokens/wallet'

const apply = process.argv.includes('--apply')
const env = loadEnv()
const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

try {
  // Fills the id cache `deliverOfficialMessage` reads. The API does this at
  // boot; a script is its own process and has had no boot.
  const accounts = await ensureOfficialAccounts(db, publicApiUrl(env))
  if (accounts.find((account) => account.handle === 'langx')?.outcome === 'conflict') {
    throw new Error('@langx is held by a real account — nothing to send from')
  }

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const gifted = await profiles
    .find({
      'restoredFromV1.lifetimeGranted': { $in: ['pro', 'pro_plus'] },
      // The @langx account itself holds a grant, from the v1 account it was
      // adopted from, and its address is a placeholder that goes nowhere.
      official: { $exists: false },
      deletedAt: { $exists: false },
    })
    .toArray()

  console.log(`db                       ${env.MONGODB_DB}`)
  console.log(`granted a lifetime tier  ${gifted.length}`)

  const pending: { profile: Profile; tier: PaidPlanTier }[] = []
  for (const profile of gifted) {
    const tier = profile.restoredFromV1?.lifetimeGranted
    if (!tier) continue
    if (await alreadyClaimed(db, 'lifetimeGift', profile._id, 'once')) {
      console.log(`  @${profile.handle.padEnd(20)} already told`)
      continue
    }

    const legacy = await db
      .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
      .findOne({ restoredBy: profile._id }, { projection: { legacyTokenBalance: 1 } })
    const balance = walletOf(profile, (await readAggregates(db, profile._id)).all).balance
    console.log(
      `  @${profile.handle.padEnd(20)} ${TIER_NAMES[tier].padEnd(9)} v1 ${String(
        legacy?.legacyTokenBalance ?? '—',
      ).padStart(7)}  carried ${String(profile.restoredFromV1?.tokensCredited ?? 0).padStart(
        5,
      )}  wallet ${String(balance).padStart(6)}`,
    )
    pending.push({ profile, tier })
  }

  console.log(`\nto tell                  ${pending.length}`)
  if (!apply) {
    if (pending.length > 0) console.log('\nRe-run with --apply to send.')
  } else {
    const senders = {
      email: createEmailSender(env, console),
      push: new ExpoPushSender(env.EXPO_ACCESS_TOKEN, console),
    }
    let sent = 0
    for (const { profile, tier } of pending) {
      await notifyLifetimeGift(db, senders, { userId: profile._id, tier }, (error, message) =>
        console.error(`  @${profile.handle} ${message}`, error),
      )
      sent += 1
      console.log(`  @${profile.handle.padEnd(20)} told`)
    }
    console.log(`sent                     ${sent}`)
  }
} finally {
  await close()
}
