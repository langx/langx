/**
 * Read-only reconnaissance against the live v1 Appwrite instance.
 *
 * Faz 11 has to map v1's profile document onto v2's `Profile`, and guessing
 * the field names from the v1 source would be a guess about what is actually
 * *stored* — legacy collections accumulate fields that no longer exist in the
 * code and lose fields the code still writes. This prints the real shape.
 *
 *   pnpm --filter @langx/api exec tsx scripts/inspect-v1.ts
 */
import { Client, Databases, Query, Storage } from 'node-appwrite'
import { loadEnv } from '../src/env'

const DATABASE_ID = '650750f16cd0c482bb83'
const USERS_COLLECTION = '65103e2d3a6b4d9494c8'

async function main(): Promise<void> {
  const env = loadEnv()
  if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_PROJECT_ID || !env.APPWRITE_API_KEY) {
    throw new Error('APPWRITE_* env vars are required')
  }

  const client = new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT)
    .setProject(env.APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY)

  const databases = new Databases(client)
  const storage = new Storage(client)

  const page = await databases.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: USERS_COLLECTION,
    queries: [Query.limit(5)],
  })

  console.log(`=== profile documents: ${page.total} total ===\n`)

  // Union of keys across a few documents, not just the first — a field that
  // is only set for some users would be invisible in a single sample.
  const keys = new Map<string, string>()
  for (const doc of page.documents) {
    for (const [key, value] of Object.entries(doc)) {
      if (value === null || value === undefined) {
        if (!keys.has(key)) keys.set(key, 'null/undefined (in this sample)')
        continue
      }
      const preview = Array.isArray(value)
        ? `Array(${value.length}) ${JSON.stringify(value).slice(0, 100)}`
        : typeof value === 'object'
          ? `object ${JSON.stringify(value).slice(0, 100)}`
          : `${typeof value} ${String(value).slice(0, 100)}`
      keys.set(key, preview)
    }
  }
  for (const [key, preview] of [...keys].sort()) {
    console.log(`  ${key.padEnd(26)} ${preview}`)
  }

  // The `languages` array is the only place a language *code* is stored;
  // `motherLanguages`/`studyLanguages`/`languageArray` are denormalized name
  // lists. Its `level` is a number, and v2 speaks CEFR — so the mapping has to
  // be built from what the numbers actually are, not from what they look like.
  console.log('\n=== languages[].level distribution (500 docs) ===')
  const levels = new Map<string, number>()
  const genders = new Map<string, number>()
  let withPic = 0
  let withOtherPics = 0
  let scanned = 0
  let cursor: string | undefined
  for (let page = 0; page < 5; page++) {
    const queries = [Query.limit(100)]
    if (cursor) queries.push(Query.cursorAfter(cursor))
    const batch = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: USERS_COLLECTION,
      queries,
    })
    for (const doc of batch.documents) {
      scanned++
      for (const lang of (doc.languages ?? []) as { level?: unknown; motherLanguage?: unknown }[]) {
        const key = `level=${String(lang.level)} mother=${String(lang.motherLanguage)}`
        levels.set(key, (levels.get(key) ?? 0) + 1)
      }
      const gender = String(doc.gender ?? 'null')
      genders.set(gender, (genders.get(gender) ?? 0) + 1)
      if (doc.profilePic) withPic++
      if (Array.isArray(doc.otherPics) && doc.otherPics.length > 0) withOtherPics++
    }
    if (batch.documents.length < 100) break
    cursor = batch.documents.at(-1)?.$id
  }
  for (const [key, count] of [...levels].sort()) console.log(`  ${key.padEnd(34)} ${count}`)
  console.log(`\n=== gender values (${scanned} docs) ===`)
  for (const [key, count] of [...genders].sort()) console.log(`  ${key.padEnd(20)} ${count}`)
  console.log(`\n  has profilePic:  ${withPic}/${scanned}`)
  console.log(`  has otherPics:   ${withOtherPics}/${scanned}`)

  console.log('\n=== storage buckets ===')
  try {
    const buckets = await storage.listBuckets()
    for (const bucket of buckets.buckets) {
      const files = await storage.listFiles({ bucketId: bucket.$id, queries: [Query.limit(1)] })
      console.log(`  ${bucket.$id}  "${bucket.name}"  files: ${files.total}`)
    }
  } catch (error) {
    console.log(`  could not list: ${(error as Error).message}`)
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
