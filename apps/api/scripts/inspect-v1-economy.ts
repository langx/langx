/**
 * Read-only: what v1's token economy actually looks like.
 *
 * A 1:1 token→token conversion only makes sense if the two economies are on a
 * comparable scale. If v1 paid out far more generously, every returning user
 * lands permanently at the top of the all-time leaderboard and nobody new can
 * ever catch them — which would break the thing the leaderboard is for.
 *
 *   pnpm --filter @langx/api exec tsx scripts/inspect-v1-economy.ts
 */
import { Client, Databases, Query } from 'node-appwrite'
import { TOKEN_RULES } from '@langx/shared'
import { loadEnv } from '../src/env'

const DATABASE_ID = '650750f16cd0c482bb83'
const WALLET_COLLECTION = '66622b8a000b305b236c'
const STREAKS_COLLECTION = '65e73985ef5ac00c186b'

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[index] ?? 0
}

async function collect(
  databases: Databases,
  collectionId: string,
  field: string,
): Promise<number[]> {
  const values: number[] = []
  let cursor: string | undefined
  for (;;) {
    const queries = [Query.limit(100)]
    if (cursor) queries.push(Query.cursorAfter(cursor))
    const page = await databases.listDocuments({ databaseId: DATABASE_ID, collectionId, queries })
    for (const doc of page.documents) {
      const value = (doc as Record<string, unknown>)[field]
      if (typeof value === 'number') values.push(value)
    }
    if (page.documents.length < 100) break
    cursor = page.documents.at(-1)?.$id
  }
  return values
}

async function main(): Promise<void> {
  const env = loadEnv()
  const client = new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT!)
    .setProject(env.APPWRITE_PROJECT_ID!)
    .setKey(env.APPWRITE_API_KEY!)
  const databases = new Databases(client)

  for (const [label, collectionId, field] of [
    ['token balances', WALLET_COLLECTION, 'balance'],
    ['streaks (current)', STREAKS_COLLECTION, 'daystreak'],
  ] as const) {
    try {
      const values = (await collect(databases, collectionId, field)).sort((a, b) => a - b)
      const total = values.reduce((sum, v) => sum + v, 0)
      console.log(`\n=== ${label} — ${values.length} records ===`)
      if (values.length === 0) continue
      console.log(`  total   ${total.toLocaleString()}`)
      console.log(`  mean    ${Math.round(total / values.length).toLocaleString()}`)
      console.log(`  median  ${percentile(values, 50).toLocaleString()}`)
      console.log(`  p90     ${percentile(values, 90).toLocaleString()}`)
      console.log(`  p99     ${percentile(values, 99).toLocaleString()}`)
      console.log(`  max     ${values.at(-1)?.toLocaleString()}`)
      console.log(`  zero    ${values.filter((v) => v === 0).length}`)
    } catch (error) {
      console.log(`\n=== ${label} — unavailable: ${(error as Error).message}`)
    }
  }

  console.log('\n=== v2 for comparison ===')
  console.log(`  daily pool          ${TOKEN_RULES.pool.total.toLocaleString()} tokens/day, shared`)
  console.log(
    `  per-user daily cap  ${TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool} tokens from the pool`,
  )
  console.log(`  message award       ${TOKEN_RULES.award.message} token`)
  console.log(`  correction award    ${TOKEN_RULES.award.correction} token`)
  console.log(
    `  a very active day   ~${TOKEN_RULES.pool.total * TOKEN_RULES.pool.maxShareOfPool + 100 * TOKEN_RULES.award.message} token`,
  )
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
