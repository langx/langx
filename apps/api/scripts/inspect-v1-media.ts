import { Client, Query, Storage } from 'node-appwrite'
import { loadEnv } from '../src/env'

const BUCKETS = [
  ['message', '655fedc46d24b615878a'],
  ['audio', '6563aa2ef2cd2964cf27'],
] as const
const PAGE_SIZE = 100

async function main(): Promise<void> {
  const env = loadEnv()
  const client = new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT!)
    .setProject(env.APPWRITE_PROJECT_ID!)
    .setKey(env.APPWRITE_API_KEY!)
  const storage = new Storage(client)

  for (const [name, bucketId] of BUCKETS) {
    const bucket = await storage.getBucket({ bucketId })
    console.log(
      `\n=== ${name} (encryption=${bucket.encryption}, fileSecurity=${bucket.fileSecurity}) ===`,
    )

    const byType = new Map<string, { count: number; bytes: number; max: number }>()
    let cursor: string | undefined
    let total = 0
    for (;;) {
      const queries = [Query.limit(PAGE_SIZE)]
      if (cursor) queries.push(Query.cursorAfter(cursor))
      const page = await storage.listFiles({ bucketId, queries })
      for (const file of page.files) {
        total++
        const row = byType.get(file.mimeType) ?? { count: 0, bytes: 0, max: 0 }
        row.count++
        row.bytes += file.sizeOriginal
        row.max = Math.max(row.max, file.sizeOriginal)
        byType.set(file.mimeType, row)
      }
      if (page.files.length < PAGE_SIZE) break
      cursor = page.files.at(-1)?.$id
    }

    console.log(`  ${total} files`)
    const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`
    for (const [type, row] of [...byType].sort((a, b) => b[1].count - a[1].count)) {
      console.log(
        `  ${type.padEnd(28)} ${String(row.count).padStart(5)}  total ${mb(row.bytes).padStart(9)}  largest ${mb(row.max)}`,
      )
    }
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
