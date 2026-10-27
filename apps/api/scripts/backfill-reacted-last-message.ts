/**
 * Marks `lastMessage.reacted` on the threads where somebody answered the other
 * person's newest message with an emoji before that counted as an answer.
 *
 * `reactToMessage` writes the field at the moment of the reaction, and only
 * then. A reaction left before the API carrying that write was running never
 * set it, so its thread still says "Your turn" to someone who already
 * answered — and goes on saying it until somebody writes again. The rule
 * merged at 15:36 UTC on 25 October 2026, but API deploys were failing that
 * afternoon and it was live only from about 18:15, which is a gap of hours on
 * top of everything reacted to before the merge.
 *
 * It reads what `reactToMessage` reads: a reaction from someone other than the
 * message's writer — in a two-person thread, the person it was written to —
 * on the message the conversation's `lastMessage` still points at, by the
 * `createdAt` and `senderId` pair an edit uses as well.
 *
 * **Idempotent, and safe against a live thread.** A thread already marked is
 * skipped, and each write carries the same pair as its filter, so a message
 * that lands between the read and the write makes it match nothing — the
 * newer message is somebody's turn of its own.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/backfill-reacted-last-message.ts          # dry run
 *   pnpm --filter @langx/api exec tsx scripts/backfill-reacted-last-message.ts --apply
 *
 * Against production, per docs/self-host.md:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/backfill-reacted-last-message.ts
 */
import type { AnyBulkWriteOperation, Db } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { Conversation, Message } from '../src/modules/chat/conversations'

async function run(db: Db, apply: boolean): Promise<void> {
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)

  /*
   * From the reacted messages rather than from the threads: they are a sliver
   * of the collection, so this is one scan on the server instead of a round
   * trip per conversation from wherever the script is run. `{}` is what a
   * message is left with once its last reaction comes off.
   */
  const reacted = await db
    .collection<Message>(COLLECTIONS.messages)
    .find(
      { reactions: { $exists: true, $ne: {} } },
      { projection: { conversationId: 1, senderId: 1, createdAt: 1, reactions: 1 } },
    )
    .toArray()
  // A reaction to your own message answers nobody.
  const answers = reacted.filter((message) =>
    Object.values(message.reactions ?? {}).some((users) =>
      users.some((userId) => userId !== message.senderId),
    ),
  )

  const threads = await conversations
    .find(
      { _id: { $in: answers.map((message) => message.conversationId) } },
      { projection: { lastMessage: 1 } },
    )
    .toArray()
  const lastOf = new Map(threads.map((thread) => [thread._id.toHexString(), thread.lastMessage]))

  const writes: AnyBulkWriteOperation<Conversation>[] = []
  for (const message of answers) {
    const last = lastOf.get(message.conversationId.toHexString())
    if (
      !last ||
      last.reacted ||
      last.senderId !== message.senderId ||
      last.createdAt.getTime() !== message.createdAt.getTime()
    ) {
      continue
    }
    writes.push({
      updateOne: {
        filter: {
          _id: message.conversationId,
          'lastMessage.createdAt': message.createdAt,
          'lastMessage.senderId': message.senderId,
        },
        update: { $set: { 'lastMessage.reacted': true } },
      },
    })
  }

  console.log(
    `${reacted.length} messages with reactions, ${answers.length} reacted to by the other person, ` +
      `${writes.length} still the newest in a thread that is waiting on them`,
  )
  if (writes.length === 0) return

  const sample = writes.slice(0, 10).map((write) => {
    const { filter } = (write as { updateOne: { filter: { _id: Conversation['_id'] } } }).updateOne
    return `  ${filter._id.toHexString()}`
  })
  console.log(sample.join('\n'))

  if (apply) {
    // Unordered, so one thread that fails does not stop the rest.
    const result = await conversations.bulkWrite(writes, { ordered: false })
    console.log(`Wrote ${result.modifiedCount}`)
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  try {
    await run(handle.db, apply)
    if (!apply) console.log('Dry run. Pass --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
