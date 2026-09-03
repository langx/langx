/**
 * Read-only. Counts which of the three `settings.notifications` shapes are
 * actually out there, and finds the one cell that has to be checked by hand
 * before the channel axis ships.
 *
 * The retired `{push, email}` matrix and a preference written today are
 * byte-identical, so no query can tell them apart. That matters for exactly
 * one cell: a `promotions.email: true` written while no mail could be sent
 * recorded a consent against a sender that did not exist, and the new reader
 * takes it literally. Everything else is a service notification the account
 * opted into by installing the app.
 *
 * So this prints the handles carrying that cell. If any are real accounts
 * rather than testers, `--unset-promotions-email` clears it and those people
 * are asked again in the new UI. Consent is given, not inherited.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/inspect-notification-prefs.ts
 *   pnpm --filter @langx/api exec tsx scripts/inspect-notification-prefs.ts --unset-promotions-email --apply
 */
import { NOTIFICATION_TYPES } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'

interface WithPrefs {
  _id: string
  handle?: string
  settings?: { notifications?: unknown }
}

async function main(): Promise<void> {
  const unsetPromotions = process.argv.includes('--unset-promotions-email')
  const apply = process.argv.includes('--apply')
  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  const docs = await db
    .collection<WithPrefs>(COLLECTIONS.profiles)
    .find({}, { projection: { handle: 1, settings: 1 } })
    .toArray()

  const shapes = { absent: 0, v1Boolean: 0, booleanPerKind: 0, objectPerKind: 0, mixed: 0 }
  const promotionsEmail: string[] = []

  for (const doc of docs) {
    const prefs = doc.settings?.notifications
    if (prefs === undefined || prefs === null) {
      shapes.absent++
      continue
    }
    if (typeof prefs === 'boolean') {
      shapes.v1Boolean++
      continue
    }
    const stored = prefs as Record<string, unknown>
    const kinds = NOTIFICATION_TYPES.map((type) => stored[type])
    const objects = kinds.filter((v) => v !== null && typeof v === 'object').length
    const booleans = kinds.filter((v) => typeof v === 'boolean').length
    if (objects > 0 && booleans > 0) shapes.mixed++
    else if (objects > 0) shapes.objectPerKind++
    else shapes.booleanPerKind++

    const promotions = stored.promotions
    if (promotions && typeof promotions === 'object') {
      if ((promotions as { email?: unknown }).email === true) {
        promotionsEmail.push(doc.handle ?? doc._id)
      }
    }
  }

  console.log(`${env.MONGODB_DB}: ${docs.length} profiles`)
  for (const [shape, count] of Object.entries(shapes)) console.log(`  ${shape}: ${count}`)
  console.log(`\npromotions.email already true: ${promotionsEmail.length}`)
  for (const handle of promotionsEmail) console.log(`  ${handle}`)

  if (unsetPromotions && promotionsEmail.length > 0) {
    if (!apply) {
      console.log('\n(dry run — re-run with --apply to unset promotions.email on those profiles)')
    } else {
      const result = await db
        .collection<WithPrefs>(COLLECTIONS.profiles)
        .updateMany(
          { 'settings.notifications.promotions.email': true },
          { $unset: { 'settings.notifications.promotions.email': '' } },
        )
      console.log(`\nunset on ${result.modifiedCount} profiles`)
    }
  }

  await close()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
