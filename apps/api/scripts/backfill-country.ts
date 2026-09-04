/**
 * Fills in `country` on profiles that never got one.
 *
 * `countryFromHeaders` reads Cloudflare's `CF-IPCountry`, and until 4 September
 * 2026 `api.langx.io` was a DNS-only record — the request never passed through
 * the edge, so the header never arrived and the call returned `undefined` on
 * every sign-up. The onboarding country question had already been removed in
 * favour of it, so there was no fallback: every account created between those
 * two changes has no country at all. Discovery's country filter is a plain
 * equality match, so those people are silently absent from any filtered search.
 *
 * The header is fixed going forward. This is for the accounts already on file,
 * and it uses only evidence those accounts already carry:
 *
 *  1. `cityCountryCode` — derived by `setLocation` from coordinates the user
 *     chose to share. The strongest of the three: a device fix, reverse
 *     geocoded by us.
 *  2. `legacyProfiles.countryCode` — what the same person told v1. Second
 *     because it is self-declared and may be years old, but it is still their
 *     own answer rather than a guess.
 *
 * There is deliberately no third source. Timezone and device locale were both
 * considered and both say where a phone is *configured*, not where it is —
 * and a wrong country here is worse than an absent one, because the age and
 * country filters treat it as fact.
 *
 * Profiles left without a country are reported rather than guessed at.
 *
 * **Idempotent.** Only ever writes where `country` is missing, so a second run
 * finds less to do and changes nothing it already did.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/backfill-country.ts            # dry run
 *   pnpm --filter @langx/api exec tsx scripts/backfill-country.ts --apply
 *
 * Against production, per docs/self-host.md:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/backfill-country.ts
 */
import { getCountry } from '@langx/shared'
import type { Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { LegacyProfile } from '../src/modules/handles/legacyProfiles'
import type { Profile } from '../src/modules/profiles/profiles'

type Source = 'location' | 'v1'

/** A code we would store, or nothing. Same table the picker and the filter use. */
function usable(code: string | undefined): string | undefined {
  if (!code) return undefined
  const upper = code.trim().toUpperCase()
  return getCountry(upper) ? upper : undefined
}

async function run(db: Db, apply: boolean): Promise<void> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)

  const missing = await profiles
    .find(
      {
        deletedAt: { $exists: false },
        $or: [{ country: { $exists: false } }, { country: '' }],
      },
      { projection: { cityCountryCode: 1 } },
    )
    .toArray()

  const total = await profiles.countDocuments({ deletedAt: { $exists: false } })
  console.log(`${total} live profiles, ${missing.length} without a country`)
  if (missing.length === 0) return

  /*
   * One query for the v1 records rather than one per profile.
   *
   * `restoredBy` is the link: it is stamped with the user id when a returning
   * person claims their staged record, so it is exactly the set of profiles
   * that have a v1 answer to inherit. A staged record nobody has claimed
   * belongs to nobody yet and must not be read from.
   */
  const legacy = new Map(
    (
      await db
        .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
        .find(
          { restoredBy: { $in: missing.map((profile) => profile._id) } },
          { projection: { restoredBy: 1, countryCode: 1 } },
        )
        .toArray()
    ).map((record) => [record.restoredBy, record.countryCode]),
  )

  const counts: Record<Source, number> = { location: 0, v1: 0 }
  let unresolved = 0

  for (const profile of missing) {
    const fromLocation = usable(profile.cityCountryCode)
    const fromV1 = usable(legacy.get(profile._id))
    const code = fromLocation ?? fromV1
    if (!code) {
      unresolved++
      continue
    }
    counts[fromLocation ? 'location' : 'v1']++
    if (apply) {
      // Guarded on the field still being absent, so a sign-up that lands
      // mid-run keeps the country its own request worked out.
      await profiles.updateOne(
        { _id: profile._id, $or: [{ country: { $exists: false } }, { country: '' }] },
        { $set: { country: code } },
      )
    }
  }

  const verb = apply ? 'Set' : 'Would set'
  console.log(`${verb} ${counts.location} from a shared location`)
  console.log(`${verb} ${counts.v1} from the v1 record`)
  console.log(`${unresolved} left without one — nothing on file says where they are`)
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
