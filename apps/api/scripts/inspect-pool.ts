/**
 * Read-only: what the daily pool actually paid, day by day.
 *
 * The pool is the one number in `TOKEN_RULES` whose effect cannot be read off
 * the config — a share depends on everyone else's day — so the only way to
 * know whether a change to `total` or `maxShareOfPool` did what it was meant
 * to is to look at the runs it produced. `jobRuns` holds what each pass
 * decided; the ledger holds what each person got, which is where the cap
 * shows up as a cluster of identical amounts.
 *
 *   cd apps/api && pnpm exec tsx --env-file=../../.env --env-file=../../.env.prod scripts/inspect-pool.ts
 */
import { TOKEN_RULES } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { JobRun } from '../src/modules/tokens/pool'
import { DAILY_POOL_JOB } from '../src/modules/tokens/pool'

/** `indexOf` returns -1 for a flag that is absent, and argv[0] is the node binary. */
function flag(name: string): string | undefined {
  const at = process.argv.indexOf(name)
  return at === -1 ? undefined : process.argv[at + 1]
}

const DAYS = Number(flag('--days')) || 10

const env = loadEnv()
const dbName = flag('--db') ?? env.MONGODB_DB
const handle = await connectToDatabase(env.MONGODB_URI, dbName)

const cap = Math.floor(TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool)
console.log(`db                  ${dbName}`)
console.log(`pool (this checkout) ${TOKEN_RULES.pool.total} a day, cap ${cap} per person`)
console.log('')

const runs = await handle.db
  .collection<JobRun>(COLLECTIONS.jobRuns)
  .find({ job: DAILY_POOL_JOB })
  .sort({ periodKey: -1 })
  .limit(DAYS)
  .toArray()

if (runs.length === 0) console.log('no dailyPool runs recorded')
console.log('day         active  paid  distributed  topScore%  atCap  top   ran')
for (const run of runs) {
  const rows = await handle.db
    .collection<{ amount: number }>(COLLECTIONS.tokenLedger)
    .find({ kind: 'dailyPool', refId: run.periodKey })
    .toArray()
  const amounts = rows.map((row) => row.amount).sort((a, b) => b - a)
  const top = amounts[0] ?? 0
  const atCap = amounts.filter((amount) => amount >= cap).length
  const result = run.result
  const share =
    result && result.distributed > 0 ? ((top / result.distributed) * 100).toFixed(1) : '-'
  console.log(
    [
      run.periodKey,
      String(result?.active ?? '-').padStart(6),
      String(result?.paid ?? amounts.length).padStart(5),
      String(result?.distributed ?? amounts.reduce((sum, a) => sum + a, 0)).padStart(12),
      share.padStart(10),
      String(atCap).padStart(6),
      String(top).padStart(5),
      run.finishedAt ? '  ok' : '  UNFINISHED LOCK',
    ].join(' '),
  )
}

await handle.client.close()
