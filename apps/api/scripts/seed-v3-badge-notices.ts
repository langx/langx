/**
 * Marks the v3 badges everybody has already earned as announced, before the
 * evening round-up starts announcing v3 badges at all.
 *
 * The six kinds added with the v3 shelf are counted back through what people
 * had already done — a hundred Echo reviews last spring is a Ripple today. The
 * round-up announces whatever is earned and missing from
 * `stats.notifiedBadgeIds`, so the first evening after
 * `BADGE_ROUND_UP_CATALOGUE` moves to `v3` would push, mail and write a bell
 * row for every one of those at once, to everybody. This adds them to
 * `notifiedBadgeIds` first, so that evening announces only what is earned
 * from then on. The shelf still shows them as New: that mark is the device's,
 * not this list's (see `badgeSeen.ts` in the app).
 *
 * Writes nothing a badge depends on — badges are derived, never stored — and
 * grants nothing: no badge pays.
 *
 * **Idempotent.** It adds with `$addToSet` and only ids not already there, so
 * a second run finds nothing to do. A profile the round-up has never seeded
 * (no `notifiedBadgeIds` at all) is left alone; its first pass seeds every
 * earned badge silently anyway.
 *
 * **Not run yet.** Run it once, right before `BADGE_ROUND_UP_CATALOGUE`
 * becomes `v3`.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/seed-v3-badge-notices.ts            # dry run
 *   pnpm --filter @langx/api exec tsx scripts/seed-v3-badge-notices.ts --apply
 *
 * Against production, per docs/self-host.md:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/seed-v3-badge-notices.ts
 */
import { isV3BadgeKind } from '@langx/shared'
import type { Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { Profile } from '../src/modules/profiles/profiles'
import { getBadgeSummary } from '../src/modules/tokens/badges'

async function run(db: Db, apply: boolean): Promise<void> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const cursor = profiles.find(
    { deletedAt: { $exists: false }, 'stats.notifiedBadgeIds': { $exists: true } },
    { projection: { _id: 1, 'stats.notifiedBadgeIds': 1 } },
  )

  let seen = 0
  let touched = 0
  let ids = 0
  const examples: string[] = []
  for await (const profile of cursor) {
    seen++
    let summary
    try {
      summary = await getBadgeSummary(db, profile._id, new Date(), 'v3')
    } catch {
      // A profile without enough of itself to summarise is the round-up's
      // problem too, and it skips them the same way.
      continue
    }
    const known = new Set(profile.stats?.notifiedBadgeIds ?? [])
    const add = summary.badges
      .filter((badge) => badge.earned && isV3BadgeKind(badge.kind) && !known.has(badge.id))
      .map((badge) => badge.id)
    if (add.length === 0) continue
    touched++
    ids += add.length
    if (examples.length < 5) examples.push(`  ${profile._id}: + ${add.join(', ')}`)
    if (apply) {
      await profiles.updateOne(
        { _id: profile._id },
        { $addToSet: { 'stats.notifiedBadgeIds': { $each: add } } },
      )
    }
  }

  console.log(`${seen} profiles read, ${touched} with v3 badges to mark, ${ids} ids in all`)
  for (const line of examples) console.log(line)
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  try {
    await run(handle.db, apply)
    if (!apply) console.log('Dry run. Pass --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
