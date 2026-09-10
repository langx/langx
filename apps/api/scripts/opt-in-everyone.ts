/**
 * Puts every live profile that has never touched its notification settings
 * onto the mailing list.
 *
 * The one-off half of the reversal `DEFAULT_NOTIFICATION_PREFS` describes:
 * the default now opts new accounts in, and this is what does the same for
 * the accounts that already existed.
 *
 * **An explicit refusal stays a refusal.** `notificationsUntouched` knows
 * every shape this codebase has ever written on somebody's behalf, and only
 * those are changed — a profile whose owner opened Settings and left
 * promotions off has already answered, and re-adding them is the one thing
 * worse than never having asked. So is a suppressed address: somebody who
 * pressed an unsubscribe link is skipped whatever their profile says.
 *
 * `promotionsConsent` records where the yes came from, the way
 * `adopt-v1-consent.ts` does, so a row can still answer "who decided this"
 * a year from now.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/opt-in-everyone.ts [--limit 50] [--confirm]
 *
 * Without `--confirm` it counts and prints and writes nothing.
 */
import { notificationsUntouched, resolveNotificationPrefs } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { suppressedAmong } from '../src/modules/notifications/suppressions'
import { emailFor } from '../src/modules/profiles/emailFor'
import type { Profile } from '../src/modules/profiles/profiles'

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function main(): Promise<void> {
  const limit = flag('limit') ? Number(flag('limit')) : undefined
  const confirm = process.argv.includes('--confirm')

  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    const profiles = await db
      .collection<Profile>(COLLECTIONS.profiles)
      .find({ deletedAt: { $exists: false }, guest: { $exists: false } })
      .toArray()

    const counts = { touched: 0, alreadyOn: 0, suppressed: 0, noEmail: 0, wouldOptIn: 0 }
    const targets: string[] = []

    // One query rather than one per profile: the list is small, and this is
    // the only lookup that is not already in memory.
    const addresses = new Map<string, string>()
    for (const profile of profiles) {
      const address = await emailFor(db, profile._id)
      if (address) addresses.set(profile._id, address.email)
    }
    const suppressed = await suppressedAmong(db, [...addresses.values()])

    for (const profile of profiles) {
      const prefs = profile.settings?.notifications
      if (resolveNotificationPrefs(prefs).promotions.email) {
        counts.alreadyOn++
        continue
      }
      if (!notificationsUntouched(prefs)) {
        counts.touched++
        continue
      }
      const email = addresses.get(profile._id)
      if (!email) {
        counts.noEmail++
        continue
      }
      if (suppressed.has(email.toLowerCase())) {
        counts.suppressed++
        continue
      }
      counts.wouldOptIn++
      targets.push(profile._id)
      if (limit && targets.length >= limit) break
    }

    console.log(`opt-in on ${env.MONGODB_DB}`)
    console.log(`  live profiles: ${profiles.length}`)
    console.log(`  would opt in: ${counts.wouldOptIn}`)
    console.log(`  skipped: ${JSON.stringify(counts)}`)

    if (!confirm) {
      console.log('\n(dry run — re-run with --confirm to write)')
      return
    }

    const now = new Date()
    let written = 0
    for (const userId of targets) {
      const profile = profiles.find((candidate) => candidate._id === userId)
      if (!profile) continue
      const resolved = resolveNotificationPrefs(profile.settings?.notifications)
      await db.collection<Profile>(COLLECTIONS.profiles).updateOne(
        { _id: userId },
        {
          $set: {
            // Whole, for the reason `setEmailNotifications` writes whole: a
            // dotted path one level deeper cannot enter the bare boolean the
            // oldest profiles still carry.
            'settings.notifications.promotions': { ...resolved.promotions, email: true },
            promotionsConsent: { source: 'default-optin', at: now },
            updatedAt: now,
          },
        },
      )
      written++
    }
    console.log(`\nopted in ${written}`)
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
