import type { Db, ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { EchoCardDoc } from './documents'

/**
 * Which of these messages the viewer already keeps a card for.
 *
 * One query for a whole page, never one per message — the feed's
 * `readLikeSummary` makes the same argument for the same reason. Equality on
 * `userId` plus an `$in` on `sourceKey` rides `card_source_unique` end to end,
 * and because that index is unique it reads at most one row per message id by
 * definition.
 *
 * Its own file, rather than a function in `cards.ts`: `chat/messages.ts` calls
 * this, and `cards.ts` calls `chat/access.ts`. Keeping the two apart is what
 * stops the pair becoming a cycle.
 */
async function readEchoedIds(
  db: Db,
  userId: string,
  prefix: 'msg:' | 'post:',
  ids: readonly ObjectId[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set()

  const rows = await db
    .collection<EchoCardDoc>(COLLECTIONS.echoCards)
    .find({ userId, sourceKey: { $in: ids.map((id) => `${prefix}${id.toHexString()}`) } })
    .project<{ sourceKey: string }>({ sourceKey: 1 })
    .toArray()

  return new Set(rows.map((row) => row.sourceKey.slice(prefix.length)))
}

export async function readEchoedMessageIds(
  db: Db,
  userId: string,
  messageIds: readonly ObjectId[],
): Promise<Set<string>> {
  return await readEchoedIds(db, userId, 'msg:', messageIds)
}

/** The same, for a page of the feed. */
export async function readEchoedPostIds(
  db: Db,
  userId: string,
  postIds: readonly ObjectId[],
): Promise<Set<string>> {
  return await readEchoedIds(db, userId, 'post:', postIds)
}
