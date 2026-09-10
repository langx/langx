/**
 * Records the devices people are **already** signed in on, so switching the
 * security notices on does not tell a hundred people their own phone is new.
 *
 * `knownDevices` starts empty. Without this, the first sign-in after the
 * deploy is, by the only definition the code has, a sign-in from a device
 * that has never been seen — and everybody who signs in that week gets a
 * "new sign-in to your account" letter about the laptop they are reading it
 * on. Which is the exact mail people learn to ignore, on the exact feature
 * that has to be believed.
 *
 * `session` is the source: Better Auth stores the user agent on every row,
 * and a live session *is* a device somebody is using. The rows expire in a
 * week, so this covers the people who have signed in recently — which is the
 * same set that would otherwise have been mailed. Anybody older gets one
 * notice on their next sign-in, correctly.
 *
 * Idempotent: `claimNewDevice` upserts on `<userId>:<fingerprint>`, so
 * running it twice writes nothing the second time. Run it **before**
 * `fly deploy`, or in the same minute — the window between the deploy and
 * this is the window the burst happens in.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/backfill-known-devices.ts [--confirm]
 */
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { deviceIdentity } from '../src/modules/security/deviceLabel'
import { claimNewDevice } from '../src/modules/security/knownDevices'

interface SessionRow {
  userId: unknown
  userAgent?: string
  createdAt?: Date
}

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm')
  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    const sessions = await db
      .collection<SessionRow>(COLLECTIONS.session)
      .find({}, { projection: { userId: 1, userAgent: 1, createdAt: 1 } })
      .toArray()

    // One row per person per device family, oldest first, so `firstSeenAt`
    // ends up as close to the truth as the sessions can say.
    const pairs = new Map<string, { userId: string; fingerprint: string; at: Date }>()
    let noAgent = 0
    for (const session of sessions) {
      if (!session.userAgent) {
        noAgent++
        continue
      }
      const userId = String(session.userId)
      const { fingerprint } = deviceIdentity(session.userAgent)
      const key = `${userId}:${fingerprint}`
      const at = session.createdAt ?? new Date()
      const existing = pairs.get(key)
      if (!existing || at < existing.at) pairs.set(key, { userId, fingerprint, at })
    }

    const byFingerprint = new Map<string, number>()
    for (const { fingerprint } of pairs.values()) {
      byFingerprint.set(fingerprint, (byFingerprint.get(fingerprint) ?? 0) + 1)
    }

    console.log(`known devices from ${sessions.length} sessions on ${env.MONGODB_DB}`)
    console.log(`  device rows to write: ${pairs.size}`)
    console.log(`  people covered: ${new Set([...pairs.values()].map((p) => p.userId)).size}`)
    console.log(`  sessions with no user agent: ${noAgent}`)
    for (const [fingerprint, count] of [...byFingerprint].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${fingerprint}: ${count}`)
    }

    if (!confirm) {
      console.log('\n(dry run — re-run with --confirm to write)')
      return
    }

    let written = 0
    for (const { userId, fingerprint, at } of pairs.values()) {
      if (await claimNewDevice(db, userId, fingerprint, { at })) written++
    }
    console.log(`\nwrote ${written} (the rest were already recorded)`)
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
