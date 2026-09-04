/**
 * How complete the v1 profile migration actually is, from the staged records.
 *
 * Read-only. The ETL prints per-run counters and forgets them; nothing else
 * ever said how many staged profiles carry an avatar, a gallery or a bio —
 * so the question "is this returning user unusual?" had to be answered by
 * reading code. This answers it in one command, split by whether the record
 * has already been restored (a restored record is out of the ETL's reach, so
 * a media backfill would have to write to `profiles` as well).
 *
 *   pnpm --filter @langx/api exec tsx scripts/inspect-legacy-coverage.ts
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod scripts/inspect-legacy-coverage.ts
 */
import { BIO_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { LegacyProfile } from '../src/modules/handles/legacyProfiles'

const env = loadEnv()
const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

interface Bucket {
  total: number
  avatar: number
  photos: number
  bio: number
  bioTooLong: number
  nameTooLong: number
}

function empty(): Bucket {
  return { total: 0, avatar: 0, photos: 0, bio: 0, bioTooLong: 0, nameTooLong: 0 }
}

try {
  const buckets = { restored: empty(), staged: empty() }
  const cursor = db
    .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
    .find({}, { projection: { avatarUrl: 1, photos: 1, bio: 1, displayName: 1, restoredBy: 1 } })
  for await (const record of cursor) {
    const bucket = record.restoredBy ? buckets.restored : buckets.staged
    bucket.total += 1
    if (record.avatarUrl) bucket.avatar += 1
    if (record.photos.length > 0) bucket.photos += 1
    if (record.bio) bucket.bio += 1
    if (record.bio && record.bio.length > BIO_MAX_LENGTH) bucket.bioTooLong += 1
    if (record.displayName && record.displayName.length > DISPLAY_NAME_MAX_LENGTH) {
      bucket.nameTooLong += 1
    }
  }

  const pct = (n: number, of: number): string => (of === 0 ? '—' : `${Math.round((100 * n) / of)}%`)
  console.log(`db                     ${env.MONGODB_DB}`)
  for (const [name, b] of Object.entries(buckets)) {
    console.log(`\n${name.padEnd(10)} ${b.total}`)
    console.log(`  with avatar          ${String(b.avatar).padStart(5)}  ${pct(b.avatar, b.total)}`)
    console.log(`  with gallery         ${String(b.photos).padStart(5)}  ${pct(b.photos, b.total)}`)
    console.log(`  with bio             ${String(b.bio).padStart(5)}  ${pct(b.bio, b.total)}`)
    console.log(`  bio over ${BIO_MAX_LENGTH}         ${String(b.bioTooLong).padStart(5)}`)
    console.log(
      `  name over ${DISPLAY_NAME_MAX_LENGTH}          ${String(b.nameTooLong).padStart(5)}`,
    )
  }
} finally {
  await close()
}
