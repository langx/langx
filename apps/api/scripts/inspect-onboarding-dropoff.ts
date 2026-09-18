/**
 * Who signed up and never finished the wizard, and how long the gap usually is.
 *
 * Read-only, and written down rather than retyped: the numbers this prints —
 * the median gap from `user` row to profile, the share who never arrive — are
 * what `onboardingReminder.ts` sets its age floor from, and what the admin
 * bot's new-member alert sets its wait from. A guess that came from a query
 * somebody ran once and threw away is a guess again the next time it matters.
 *
 * `--emails` prints the addresses in full; without it they are masked, because
 * this is usually run to read a shape and a shape needs no mailbox in it.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/inspect-onboarding-dropoff.ts [--emails] [--min-age-hours 24]
 */
import type { ObjectId } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { authId } from '../src/lib/authId'
import { reminderCohort } from '../src/modules/notifications/onboardingReminder'

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function mask(email: string): string {
  const [user = '', domain = ''] = email.split('@')
  return `${user.slice(0, 2)}***@${domain}`
}

function percentile(sorted: number[], p: number): number | undefined {
  if (sorted.length === 0) return undefined
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
}

async function main(): Promise<void> {
  const showEmails = process.argv.includes('--emails')
  const minAgeHours = flag('min-age-hours') ? Number(flag('min-age-hours')) : 24

  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    /*
     * The gap, measured over everybody who *did* arrive. Driven from `profiles`
     * because that is the side that has both dates — `createdAt` there is the
     * moment the wizard finished, and the `user` row it points at carries the
     * moment they signed in.
     *
     * v1 rows are dropped from the sample rather than counted: their
     * `user.createdAt` is when `precreate-v1-users.ts` ran, not when a person
     * signed up, so each one contributes a gap of however long the migration
     * has been sitting there. Two of them were enough to move p90 from seven
     * minutes to an hour — a number that would then have been read back as
     * "people take an hour", and used to set a wait nobody needed.
     */
    const profiles = await db
      .collection<{ _id: string; createdAt?: Date; guest?: unknown }>(COLLECTIONS.profiles)
      .find(
        { guest: { $exists: false }, deletedAt: { $exists: false } },
        { projection: { createdAt: 1 } },
      )
      .toArray()
    const users = await db
      .collection<{ _id: ObjectId; createdAt?: Date }>(COLLECTIONS.user)
      .find(
        { _id: { $in: profiles.map((p) => authId(p._id)) }, precreatedFromV1: { $exists: false } },
        { projection: { createdAt: 1 } },
      )
      .toArray()
    const signedUpAt = new Map(users.map((u) => [String(u._id), u.createdAt]))

    const gaps = profiles
      .map((profile) => {
        const start = signedUpAt.get(profile._id)
        if (!start || !profile.createdAt) return undefined
        return (profile.createdAt.getTime() - start.getTime()) / 1000
      })
      .filter((gap): gap is number => gap !== undefined && gap >= 0)
      .sort((a, b) => a - b)

    const stalled = await reminderCohort(db, { minAgeHours })

    console.log(`onboarding drop-off on ${env.MONGODB_DB}`)
    console.log(`  finished the wizard: ${profiles.length}`)
    console.log(`  never finished (older than ${minAgeHours}h): ${stalled.length}`)
    if (profiles.length + stalled.length > 0) {
      const share = (stalled.length / (profiles.length + stalled.length)) * 100
      console.log(`  drop-off share: ${share.toFixed(1)}%`)
    }

    if (gaps.length > 0) {
      const seconds = (value: number | undefined): string =>
        value === undefined
          ? '—'
          : value < 120
            ? `${value.toFixed(0)}s`
            : `${(value / 60).toFixed(1)}m`
      console.log('\n  gap from signup to profile:')
      console.log(
        `    min ${seconds(gaps[0])}  median ${seconds(percentile(gaps, 0.5))}` +
          `  p90 ${seconds(percentile(gaps, 0.9))}  max ${seconds(gaps.at(-1))}`,
      )
    }

    console.log(`\n  the stalled, oldest first:`)
    for (const person of stalled) {
      const age = (Date.now() - person.signedUpAt.getTime()) / 3600_000
      console.log(
        `    ${person.signedUpAt.toISOString().slice(0, 16).replace('T', ' ')}` +
          `  ${age < 48 ? `${age.toFixed(0)}h` : `${(age / 24).toFixed(0)}d`} ago` +
          `  ${person.variant.padEnd(8)}` +
          `  ${showEmails ? person.email : mask(person.email)}`,
      )
    }
    if (stalled.length === 0) console.log('    (nobody)')
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
