import type { Db, Filter } from 'mongodb'
import type { MediaTab, MessageType } from '@langx/shared'
import { COLLECTIONS } from '../../db/collections'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { assertConversationAccess } from './access'
import type { Message } from './conversations'
import { toMessageView, type MessageView } from './messageView'

/**
 * The visual tab's two types, as index bounds.
 *
 * `$in`, never `$ne`: the note on `posts.kind_needs_correction` in
 * `db/indexes.ts` records why — a `$ne` reads the same and cannot be bounded,
 * which would turn each tab into a scan of the whole thread.
 */
const VISUAL_TYPES = ['image', 'video'] as const satisfies readonly MessageType[]

export interface ConversationMediaPage {
  items: MessageView[]
  nextCursor: string | null
}

/**
 * One thread's attachments, on their own screen, newest first.
 *
 * `{ items, nextCursor }` and nothing else, unlike the `MessagePage` beside
 * it. The thread's window carries `participants`, `pinned` and
 * `mediaLockedFor` because the chat screen has no other way to ask for them;
 * a grid needs none of the three, and reusing that shape would tie a second
 * screen to a contract it never reads.
 *
 * `assertConversationAccess` is the gate, as on every conversation-scoped
 * read: a stranger gets the 404 that says nothing, and the block is
 * re-checked on this call rather than trusted from when the thread started.
 *
 * **Filters what the thread deliberately does not.** `listMessages` keeps a
 * withdrawn message and one hidden by the reader, because in a thread a
 * tombstone holds the place of what was said. In a grid the same row is a
 * blank square with nothing to say. And it cannot be left to the client: the
 * `limit + 1` keyset page mints `nextCursor` from the last row the *server*
 * kept, so dropping rows afterwards makes pages arrive short and, once a
 * whole page is dropped, makes the list stop with more behind it.
 */
export async function listConversationMedia(
  db: Db,
  userId: string,
  conversationId: string,
  query: { tab: MediaTab; cursor?: string | undefined; limit: number },
): Promise<ConversationMediaPage> {
  const conversation = await assertConversationAccess(db, conversationId, userId)

  const filter: Filter<Message> = {
    conversationId: conversation._id,
    type: query.tab === 'audio' ? 'audio' : { $in: [...VISUAL_TYPES] },
    deletedAt: { $exists: false },
    hiddenFor: { $ne: userId },
  }

  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    // Keyset, not skip: an attachment sent while the reader is paging shifts
    // an offset, which repeats or drops a tile.
    filter.$or = [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }]
  }

  // One over, so "is there another page" needs no second count.
  const rows = await db
    .collection<Message>(COLLECTIONS.messages)
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = rows.length > query.limit
  const page = hasMore ? rows.slice(0, query.limit) : rows
  const last = page.at(-1)

  return {
    items: page.map((message) => toMessageView(message, userId)),
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}
