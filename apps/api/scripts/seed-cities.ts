/**
 * Fills the `cities` collection from GeoNames.
 *
 * This work is based on data from GeoNames (https://www.geonames.org/),
 * licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
 * `docs/data-sources.md` carries the same note where a reader will find it,
 * and the app credits it in "Our Kitchen".
 *
 * `cities15000` is every place with more than fifteen thousand people — about
 * twenty-four thousand of them. Big enough that a language-exchange user is
 * near one; small enough to sit in a collection without thought.
 *
 * **Idempotent.** Every row is upserted by its own id, so a re-run after a
 * partial failure finishes the job and a re-run after a GeoNames update
 * refreshes what changed.
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
import type { City } from '../src/modules/cities/cities'

const SOURCE = 'https://download.geonames.org/export/dump/cities15000.zip'
/** Written in batches so a run holds one batch in memory, not the whole file. */
const BATCH = 2000

/**
 * The columns this needs, out of GeoNames' nineteen. Documented at
 * https://download.geonames.org/export/dump/readme.txt — positional, and
 * unchanged for as long as the export has existed.
 */
const COL = { id: 0, name: 1, ascii: 2, lat: 4, lng: 5, country: 8, admin1: 10, population: 14 }

function toCity(line: string): City | null {
  const parts = line.split('\t')
  const id = parts[COL.id]
  const name = parts[COL.name]
  const lat = Number(parts[COL.lat])
  const lng = Number(parts[COL.lng])
  const country = parts[COL.country]
  if (!id || !name || !country || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
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

async function seed(db: Db, file: string, apply: boolean): Promise<number> {
  const collection = db.collection<City>(COLLECTIONS.cities)
  let batch: City[] = []
  let written = 0

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
    batch.push(city)
    if (batch.length >= BATCH) await flush()
  }
  await flush()
  return written
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
    const count = await seed(handle.db, file, apply)
    console.log(`${apply ? 'Wrote' : 'Would write'} ${count} cities`)
    if (!apply) console.log('Dry run. Pass --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
