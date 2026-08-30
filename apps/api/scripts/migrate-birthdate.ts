/**
 * One-off, two shapes: `birthYear: 1995` → `birthDate: '1995-01-01'`, and
 * `settings.notifications` → one boolean per kind.
 *
 * v2 stores the whole calendar day now — for the age gate, which is unchanged,
 * and for birthdays, which are the point. Documents written before the switch
 * only have the year, and the day and month of somebody's birth cannot be
 * derived from anything: **the date this writes is a placeholder**. It keeps
 * the year, so nobody's age changes and no profile is left unreadable by a
 * schema that now requires the field, and it is deliberately January the 1st
 * so a wrong birthday is obvious rather than plausible.
 *
 * The handles it touches are printed for exactly that reason: a real account
 * among them should be corrected by hand, with `--set`.
 *
 * **Idempotent.** A document that already has `birthDate` is left alone, so a
 * re-run after a partial failure only finishes the job.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/migrate-birthdate.ts                  # dry run
 *   pnpm --filter @langx/api exec tsx scripts/migrate-birthdate.ts --apply
 *   pnpm --filter @langx/api exec tsx scripts/migrate-birthdate.ts --set ada=1994-03-07 --apply
 */
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_TYPES, isCalendarDate } from '@langx/shared'
import type { Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'

interface WithBirth {
  _id: string
  handle?: string
  birthYear?: number
  birthDate?: string
  settings?: { notifications?: unknown }
}

/** `--set handle=YYYY-MM-DD`, repeatable. */
function parseOverrides(argv: string[]): Map<string, string> {
  const overrides = new Map<string, string>()
  argv.forEach((arg, index) => {
    if (arg !== '--set') return
    const [handle, date] = (argv[index + 1] ?? '').split('=')
    if (!handle || !date || !isCalendarDate(date)) {
      throw new Error(`--set expects handle=YYYY-MM-DD, got "${argv[index + 1] ?? ''}"`)
    }
    overrides.set(handle, date)
  })
  return overrides
}

async function migrate(
  db: Db,
  collection: string,
  apply: boolean,
  overrides: Map<string, string>,
): Promise<{ seen: number; converted: string[]; notifications: number }> {
  const docs = await db.collection<WithBirth>(collection).find({}).toArray()
  const converted: string[] = []

  for (const doc of docs) {
    const override = doc.handle ? overrides.get(doc.handle) : undefined
    // An override is applied even to a document that already migrated: that is
    // the whole point of it, correcting a placeholder someone was given.
    if (doc.birthDate !== undefined && !override) continue
    if (doc.birthYear === undefined && !override) continue

    const birthDate = override ?? `${doc.birthYear}-01-01`
    converted.push(`${doc.handle ?? doc._id} → ${birthDate}${override ? ' (--set)' : ''}`)
    if (apply) {
      await db
        .collection<WithBirth>(collection)
        .updateOne({ _id: doc._id }, { $set: { birthDate }, $unset: { birthYear: '' } })
    }
  }

  /**
   * The other half, in the same pass over the same documents: whatever shape
   * `settings.notifications` is in becomes one boolean per kind.
   *
   * Two shapes arrive here. A bare boolean is a v1 account, one switch for
   * everything: `false` is preserved as silence for every kind — reading it as
   * "unset" would start pushing to everyone who had opted out — and `true`
   * becomes the defaults, which is what it always meant.
   *
   * A `{push, email}` object is an account written while the channel matrix
   * existed, and it collapses to its `push` half. `email` never had a sender,
   * so it never recorded a real decision; taking `push || email` would switch
   * push back on for somebody who turned it off and left the dead email box
   * ticked.
   *
   * **Idempotent**: a kind already stored as a boolean per kind is skipped, so
   * a document this has already converted is left alone.
   */
  let notifications = 0
  for (const doc of docs) {
    const current = doc.settings?.notifications
    if (current === undefined || current === null) continue

    const prefs: Record<string, boolean> = {}
    if (typeof current === 'boolean') {
      for (const type of NOTIFICATION_TYPES) {
        prefs[type] = current ? DEFAULT_NOTIFICATION_PREFS[type] : false
      }
    } else if (typeof current === 'object') {
      const stored = current as Record<string, unknown>
      let sawMatrix = false
      for (const type of NOTIFICATION_TYPES) {
        const value = stored[type]
        if (typeof value === 'boolean') {
          prefs[type] = value
          continue
        }
        if (value && typeof value === 'object') {
          sawMatrix = true
          const push = (value as { push?: unknown }).push
          prefs[type] = typeof push === 'boolean' ? push : DEFAULT_NOTIFICATION_PREFS[type]
          continue
        }
        prefs[type] = DEFAULT_NOTIFICATION_PREFS[type]
      }
      // Already one boolean per kind, with nothing missing: nothing to do.
      if (!sawMatrix && NOTIFICATION_TYPES.every((type) => typeof stored[type] === 'boolean')) {
        continue
      }
    } else {
      continue
    }

    notifications++
    if (apply) {
      await db
        .collection<WithBirth>(collection)
        .updateOne({ _id: doc._id }, { $set: { 'settings.notifications': prefs } })
    }
  }

  return { seen: docs.length, converted, notifications }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const overrides = parseOverrides(process.argv)
  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  console.log(`${apply ? 'Applying' : 'Dry run'} on ${env.MONGODB_DB}…`)
  for (const collection of [COLLECTIONS.profiles, COLLECTIONS.legacyProfiles]) {
    const { seen, converted, notifications } = await migrate(db, collection, apply, overrides)
    console.log(
      `\n${collection}: ${seen} seen, ${converted.length} birth dates, ${notifications} notification settings`,
    )
    for (const line of converted) console.log(`  ${line}`)
  }
  if (!apply) console.log('\n(dry run — re-run with --apply to write)')

  await close()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
