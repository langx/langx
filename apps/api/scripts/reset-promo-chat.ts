/**
 * Removes the conversation between two fixture accounts, so a promo capture
 * can record somebody sending a first message more than once.
 *
 * `tools/promo-video/capture.mjs` ends by sending a message, which is a real
 * write through the real endpoint — that is the point of recording the app
 * rather than a mock. What it means is that the second run opens a chat with
 * the first run's message already in it, and the third opens on two copies of
 * the same sentence. This puts the pair back where it started.
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx --env-file=../../.env \
 *     scripts/reset-promo-chat.ts --db langx_dev test_george test_katya
 *
 * Only ever fixture accounts: both handles must belong to `test.langx.invalid`
 * addresses, and `resolveDbName` refuses any database not ending in `_dev`.
 */
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../src/db/collections'
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { EMAIL_DOMAIN, emailFor, resolveDbName } from './testAccounts'

async function fixtureUserId(db: Db, handle: string): Promise<string> {
  const user = await db.collection(COLLECTIONS.user).findOne({ email: emailFor(handle) })
  if (!user) throw new Error(`no fixture account for @${handle} (${emailFor(handle)})`)
  return String(user._id)
}

async function reset(db: Db, handles: string[]): Promise<void> {
  const ids = await Promise.all(handles.map((handle) => fixtureUserId(db, handle)))

  const conversations = await db
    .collection(COLLECTIONS.conversations)
    .find({ participants: { $all: ids } }, { projection: { _id: 1 } })
    .toArray()

  if (conversations.length === 0) {
    console.log(`no conversation between @${handles[0]} and @${handles[1]} — nothing to do`)
    return
  }

  const conversationIds = conversations.map((conversation) => conversation._id)
  // `messages.conversationId` holds the ObjectId itself, not its string form.
  const messages = await db
    .collection(COLLECTIONS.messages)
    .deleteMany({ conversationId: { $in: conversationIds } })
  await db.collection(COLLECTIONS.conversations).deleteMany({ _id: { $in: conversationIds } })

  console.log(
    `removed ${conversations.length} conversation(s) and ${messages.deletedCount} message(s) ` +
      `between @${handles[0]} and @${handles[1]}`,
  )
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const handles = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--db')
  if (handles.length !== 2) {
    throw new Error('pass exactly two fixture handles, e.g. test_george test_katya')
  }

  const env = loadEnv()
  const dbName = resolveDbName(args, env.MONGODB_DB)
  const { db, close } = await connectToDatabase(env.MONGODB_URI, dbName)
  console.log(`database: ${dbName} (fixtures only: @${EMAIL_DOMAIN})`)

  try {
    await reset(db, handles)
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
