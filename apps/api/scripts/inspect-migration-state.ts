/**
 * Which migration ETLs have actually run, from what they left behind.
 *
 * Read-only. The runbook lists three ETLs and a precreate step and nothing
 * records which of them ran against which database — the scripts print their
 * counters and forget them. With the v1 Appwrite server powered off, the
 * question "did the message ETL copy the attachments while it still could?"
 * has to be answered from the staged collections, and this prints the counts
 * that answer it: staged profiles and messages, precreated users, and what is
 * live beside them.
 *
 *   pnpm --filter @langx/api exec tsx scripts/inspect-migration-state.ts
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod scripts/inspect-migration-state.ts
 */
import { LANGUAGE_LEVELS } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'

const env = loadEnv()
const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

try {
  console.log(`db                     ${env.MONGODB_DB}`)
  const rows: [string, string][] = [
    ['legacy profiles', COLLECTIONS.legacyProfiles],
    ['legacy messages', COLLECTIONS.legacyMessages],
    ['handle reservations', COLLECTIONS.handleReservations],
    ['users', 'user'],
    ['profiles', COLLECTIONS.profiles],
    ['conversations', COLLECTIONS.conversations],
  ]
  for (const [label, name] of rows) {
    const count = await db.collection(name).estimatedDocumentCount()
    console.log(`${label.padEnd(22)} ${String(count).padStart(7)}`)
  }

  // Whether the level conversion ran: a staged record still carrying a CEFR
  // level fails validation the first time its owner edits it, and the
  // discovery `minLevel` filter never matches it — silently, both.
  for (const name of [COLLECTIONS.legacyProfiles, COLLECTIONS.profiles]) {
    const stale = await db
      .collection(name)
      .countDocuments({ 'learning.level': { $nin: [...LANGUAGE_LEVELS] } })
    console.log(`${`${name} not on the four-tier scale`.padEnd(40)} ${String(stale).padStart(5)}`)
  }
} finally {
  await close()
}
