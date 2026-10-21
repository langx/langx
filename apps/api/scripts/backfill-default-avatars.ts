/**
 * Gives every photoless profile that has none a stored v3 drawn face — see
 * `backfillDefaultAvatars` for how each is chosen.
 *
 * Optional: a profile without one wears the hash of its id, so nothing is
 * blank before this runs. What it buys is an even spread over the profiles
 * that existed before faces were assigned at sign-up.
 *
 * **Dry run by default.** Prints how many profiles it would fill and how the
 * faces would spread over each pool; writes only with `--apply`. Idempotent:
 * a second `--apply` finds nothing to do.
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx --env-file=../../.env scripts/backfill-default-avatars.ts
 *   cd apps/api && pnpm exec tsx --env-file=../../.env scripts/backfill-default-avatars.ts --apply
 *
 * Production per docs/self-host.md, run by a person and never by an agent.
 */
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { backfillDefaultAvatars } from '../src/modules/profiles/defaultAvatarBackfill'

function describe(counts: number[]): string {
  const used = counts.filter((count) => count > 0)
  if (used.length === 0) return 'none'
  return `${counts.reduce((a, b) => a + b, 0)} over ${used.length} faces, ${Math.min(...counts)}–${Math.max(...counts)} each`
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  try {
    const report = await backfillDefaultAvatars(handle.db, { apply })
    console.log(`${report.scanned} live profiles, ${report.missing} without a photo or a face`)
    for (const pool of ['W', 'M', 'N'] as const) {
      console.log(`  ${pool}: ${describe(report.spread[pool])}`)
    }
    if (apply) console.log(`Wrote ${report.written}`)
    else console.log('Dry run. Pass --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
