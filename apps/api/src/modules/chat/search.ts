import {
  CONVERSATION_SEARCH_PAGE_SIZE,
  ERROR_CODES,
  type ConversationSearchQuery,
} from '@langx/shared'
import { MongoServerError, type Db, type Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { assertConversationAccess } from './access'
import type { Message } from './conversations'
import { toMessageView, type MessageView } from './messageView'

/**
 * How long one page of a search may run before the server gives up on it.
 *
 * The pattern is unanchored and case-insensitive, so no index can answer it:
 * the scan is bounded to one thread by `conversation_created_id` and the
 * regex is then tested against every body in it, newest first, until a page
 * is full. A term that matches often fills the page in a few rows; a term that
 * matches nothing walks the whole thread. That walk is what this caps.
 *
 * A time budget rather than a row budget because the cost that matters is the
 * server's, and a row budget would hand the client pages that are empty but
 * "have more" — a list that has to explain itself. The tradeoff is that a
 * search with no match in a thread of a great many messages can fail rather
 * than answer "nothing"; at the size of real conversations the walk finishes
 * well inside this.
 */
const SEARCH_MAX_TIME_MS = 3000

/** Mongo's `MaxTimeMSExpired`. */
const MAX_TIME_EXPIRED = 50

/** Somebody's search term, as a pattern that matches only itself. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface ConversationSearchPage {
  items: MessageView[]
  nextCursor: string | null
}

/**
 * The messages in one thread whose words contain `q`, newest first.
 *
 * `assertConversationAccess` is the gate, as on every conversation-scoped
 * read: a stranger gets the 404 that says nothing, and a block placed since
 * the thread started is re-checked here.
 *
 * **Filters what the thread keeps**, for the reason `listConversationMedia`
 * does: a withdrawn message is a tombstone whose body is gone, and one the
 * reader deleted for themselves must not come back by being searched for.
 * Both are in the query rather than dropped afterwards, because the keyset
 * cursor is minted from the last row the server kept.
 *
 * Only `body`. A correction's body already *is* the corrected sentence, and a
 * caption is the body of its attachment, so the text somebody remembers
 * writing is all there. A stored translation is another language's wording of
 * somebody else's sentence, and a hit on it could not be highlighted in the
 * bubble it jumps to.
 */
export async function searchConversation(
  db: Db,
  userId: string,
  conversationId: string,
  query: ConversationSearchQuery,
): Promise<ConversationSearchPage> {
  const conversation = await assertConversationAccess(db, conversationId, userId)

  const filter: Filter<Message> = {
    conversationId: conversation._id,
    deletedAt: { $exists: false },
    hiddenFor: { $ne: userId },
    // Escaped, always: an unescaped term is somebody else's pattern running
    // on our server, and a nested quantifier is a request it can spend its
    // whole time budget failing to match.
    body: { $regex: escapeRegex(query.q), $options: 'i' },
  }
  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    filter.$or = [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }]
  }

  let rows: Message[]
  try {
    rows = await db
      .collection<Message>(COLLECTIONS.messages)
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(CONVERSATION_SEARCH_PAGE_SIZE + 1)
      .maxTimeMS(SEARCH_MAX_TIME_MS)
      .toArray()
  } catch (error) {
    if (error instanceof MongoServerError && error.code === MAX_TIME_EXPIRED) {
      throw new ApiError(ERROR_CODES.INTERNAL, 'The search ran out of time')
    }
    throw error
  }

  const hasMore = rows.length > CONVERSATION_SEARCH_PAGE_SIZE
  const page = hasMore ? rows.slice(0, CONVERSATION_SEARCH_PAGE_SIZE) : rows
  const last = page.at(-1)

  return {
    items: page.map((message) => toMessageView(message, userId)),
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}
