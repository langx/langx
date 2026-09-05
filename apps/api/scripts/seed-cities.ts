/**
 * Fills the `cities` collection from GeoNames.
 *
 * This work is based on data from GeoNames (https://www.geonames.org/),
 * licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
 * `docs/data-sources.md` carries the same note where a reader will find it,
 * and the app credits it in "Our Kitchen".
 *
 * `cities15000` is every place with more than fifteen thousand people — about
 * thirty-two thousand of them once `SKIPPED_FEATURES` is applied. Big enough
 * that a language-exchange user is near one; small enough to sit in a
 * collection without thought.
 *
 * **Idempotent.** Every row is upserted by its own id, so a re-run after a
 * partial failure finishes the job and a re-run after a GeoNames update
 * refreshes what changed. Rows the export no longer has are deleted, and the
 * profiles that pointed at them get their city worked out again.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/seed-cities.ts                 # dry run
 *   pnpm --filter @langx/api exec tsx scripts/seed-cities.ts --apply
 *   pnpm --filter @langx/api exec tsx scripts/seed-cities.ts --file ./cities15000.txt --apply
 */
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'
import type { Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { nearestCity, type City } from '../src/modules/cities/cities'
import type { Profile } from '../src/modules/profiles/profiles'

const SOURCE = 'https://download.geonames.org/export/dump/cities15000.zip'
/** Written in batches so a run holds one batch in memory, not the whole file. */
const BATCH = 2000

/**
 * The columns this needs, out of GeoNames' nineteen. Documented at
 * https://download.geonames.org/export/dump/readme.txt — positional, and
 * unchanged for as long as the export has existed.
 */
const COL = {
  id: 0,
  name: 1,
  ascii: 2,
  lat: 4,
  lng: 5,
  feature: 7,
  country: 8,
  admin1: 10,
  population: 14,
}

/**
 * Feature codes the export carries that nobody names as where they live.
 *
 * `PPLX` is a "section of populated place" — a neighbourhood, and there are
 * two and a half thousand of them over fifteen thousand people. Left in, the
 * nearest dozen places to a Toronto waterfront are all Toronto districts, the
 * city itself is not among them, and the profile reads "Waterfront
 * Communities-The Island". The rest are places that no longer exist as such:
 * historical, abandoned, destroyed, and a former capital's historical entry.
 */
const SKIPPED_FEATURES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH'])

function toCity(line: string): City | null {
  const parts = line.split('\t')
  const id = parts[COL.id]
  const name = parts[COL.name]
  const lat = Number(parts[COL.lat])
  const lng = Number(parts[COL.lng])
  const country = parts[COL.country]
  if (!id || !name || !country || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (SKIPPED_FEATURES.has(parts[COL.feature] ?? '')) return null
  const admin1 = parts[COL.admin1]
  return {
    _id: `geonames:${id}`,
    name,
    asciiName: parts[COL.ascii] || name,
    countryCode: country,
    ...(admin1 ? { admin1 } : {}),
    population: Number(parts[COL.population]) || 0,
    // GeoJSON is longitude first. The one thing in this file worth checking
    // twice: reversed, every city ends up somewhere plausible and wrong.
    location: { type: 'Point', coordinates: [lng, lat] },
  }
}

/**
 * Reads the unpacked export. `--file` is required rather than convenient:
 * GeoNames publishes a zip, and Node has no zip reader in its standard
 * library, so downloading here would mean a dependency for a script that is
 * run about once a year.
 */
async function* lines(file: string): AsyncGenerator<string> {
  const stream = file.endsWith('.gz')
    ? createReadStream(file).pipe(createGunzip())
    : createReadStream(file)
  yield* createInterface({ input: stream, crlfDelay: Infinity })
}

interface Outcome {
  written: number
  pruned: number
  /** Profiles whose city was worked out again because theirs was pruned. */
  rehomed: number
}

async function seed(db: Db, file: string, apply: boolean): Promise<Outcome> {
  const collection = db.collection<City>(COLLECTIONS.cities)
  let batch: City[] = []
  let written = 0
  const seen = new Set<string>()

  async function flush(): Promise<void> {
    if (batch.length === 0) return
    if (apply) {
      await collection.bulkWrite(
        batch.map((city) => ({
          replaceOne: { filter: { _id: city._id }, replacement: city, upsert: true },
        })),
        { ordered: false },
      )
    }
    written += batch.length
    batch = []
  }

  for await (const line of lines(file)) {
    const city = toCity(line)
    if (!city) continue
    seen.add(city._id)
    batch.push(city)
    if (batch.length >= BATCH) await flush()
  }
  await flush()

  /*
   * What the export no longer has, or what the seed now skips, goes. Upserts
   * alone would have left every neighbourhood from an earlier run in place,
   * still winning `nearestCity`. The set of ids is small enough to send as a
   * single `$nin` — this runs about once a year, from a laptop.
   */
  const stale = await collection
    .find({ _id: { $nin: [...seen] } }, { projection: { _id: 1 } })
    .map((row) => row._id)
    .toArray()
  // `rehome` does the delete, in the order it needs.
  const rehomed = await rehome(db, stale, apply)
  return { written, pruned: stale.length, rehomed }
}

/**
 * Works the city out again for every profile that pointed at a pruned row.
 *
 * `setLocation` would do the same on the next fix, but "the next fix" can be
 * weeks away, and until then the profile keeps naming a place the list no
 * longer has. Same write shape as `setLocation`, and deliberately not
 * `setLocation` itself: that also stamps `locationUpdatedAt`, and the person
 * did not move. Runs before the delete, while the old rows are still there to
 * lose to their real city.
 */
async function rehome(db: Db, staleIds: string[], apply: boolean): Promise<number> {
  if (staleIds.length === 0) return 0
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const affected = await profiles
    .find({ cityId: { $in: staleIds } }, { projection: { _id: 1, location: 1 } })
    .toArray()
  if (!apply) return affected.length

  // The pruned rows must not win again, so they are excluded from the lookup
  // by removing them first — `nearestCity` has no exclusion list, and giving
  // it one for a once-a-year script is the wrong trade.
  await db.collection<City>(COLLECTIONS.cities).deleteMany({ _id: { $in: staleIds } })
  for (const profile of affected) {
    const city = profile.location ? await nearestCity(db, profile.location.coordinates) : null
    await profiles.updateOne(
      { _id: profile._id },
      city
        ? {
            $set: {
              cityId: city._id,
              cityName: city.name,
              cityCountryCode: city.countryCode,
              country: city.countryCode,
            },
          }
        : { $unset: { cityId: '', cityName: '', cityCountryCode: '' } },
    )
  }
  return affected.length
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const fileIndex = process.argv.indexOf('--file')
  const file = fileIndex === -1 ? undefined : process.argv[fileIndex + 1]
  if (!file) {
    throw new Error(
      `Pass --file <path>. Download ${SOURCE}, unzip it, and point at cities15000.txt.`,
    )
  }

  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  try {
    const { written, pruned, rehomed } = await seed(handle.db, file, apply)
    console.log(
      `${apply ? 'Wrote' : 'Would write'} ${written} cities, ${apply ? 'pruned' : 'would prune'} ${pruned}`,
    )
    if (rehomed > 0) {
      console.log(`${apply ? 'Rehomed' : 'Would rehome'} ${rehomed} profiles off pruned cities`)
    }
    if (!apply) console.log('Dry run. Pass --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
