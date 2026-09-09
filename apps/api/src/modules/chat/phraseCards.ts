import type { Db, ObjectId } from 'mongodb'
import { PHRASE_SOURCE_CONVERSATION_LIMIT, type PhraseScope } from '@langx/shared'
import { COLLECTIONS } from '../../db/collections'
import { blockedUserIds } from '../moderation/blocks'
import type { Conversation } from './conversations'

export interface PhraseCard {
  _id: ObjectId
  conversationId: ObjectId
  messageId: ObjectId
  authorId: string
  term: string
  meaning: string
  example?: string
  lang: string
  createdAt: Date
}

export interface PhraseCardView {
  _id: string
  messageId: string
  authorId: string
  term: string
  meaning: string
  example?: string
  lang: string
  createdAt: string
}

/**
 * A conversation's deck, newest first.
 *
 * Unpaged on purpose. `conversation_term_unique` caps a deck at one row per
 * distinct phrase, and a pair who have saved more words than one screen can
 * hold have a deck worth scrolling rather than paging — the list is short
 * enough that a cursor would be ceremony. If that stops being true, the index
 * it reads is already sorted for one.
 */
export async function listPhraseCards(db: Db, conversationId: ObjectId): Promise<PhraseCardView[]> {
  const rows = await db
    .collection<PhraseCard>(COLLECTIONS.phraseCards)
    .find({ conversationId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(200)
    .toArray()

  return rows.map((row) => ({
    _id: row._id.toHexString(),
    messageId: row.messageId.toHexString(),
    authorId: row.authorId,
    term: row.term,
    meaning: row.meaning,
    lang: row.lang,
    ...(row.example ? { example: row.example } : {}),
    createdAt: row.createdAt.toISOString(),
  }))
}

/** A card, plus which thread it came out of. */
export interface CrossConversationPhraseCard extends PhraseCardView {
  conversationId: string
  /**
   * The other side of the thread it was saved in, as an **id**. The name is
   * what `/profiles/:id` and the client's profile cache already answer;
   * reading it here would be a second, uncached copy of that lookup on every
   * page. `listCorrectionsWritten` attaches `recipientId` the same way.
   *
   * Absent only if the conversation is gone, which the row tolerates by
   * showing the card alone.
   */
  partnerId?: string
}

/**
 * Every phrase one person can reach, across every thread, newest first.
 *
 * **The gate is in here, not in the route** — the one difference from
 * `listPhraseCards` above, which takes no `userId` at all because
 * `conversations.ts` puts `assertConversationAccess` in front of it. There is
 * no single conversation to put in front of this one, so this function is the
 * only place the check can live, and CLAUDE.md's rule is that access control
 * lives with the read.
 *
 * A plain `find({ participants: userId })` for the conversation ids would be
 * an authorization hole, not a shortcut. `assertConversationAccess` re-checks
 * blocks on every call precisely because a block placed after the conversation
 * exists has to cut off both REST and realtime access immediately; collecting
 * ids with a raw `find` walks around that door and serves the cards of people
 * who have blocked you. `blockedUserIds` is the two-sided list every other
 * listing filters through, and `feed.ts` does the same thing for the same
 * reason.
 *
 * **The block filter applies to `'mine'` too**, which is the one place this
 * goes further than "your own rows are yours". A card's `example` is very
 * often the *other* person's sentence — saving an incoming message as an
 * example is now the ordinary way one gets written — so a card authored by
 * the viewer can still be a quotation of somebody who has since blocked them.
 * One filter for both scopes is also one place for the check to be right.
 *
 * A thread the viewer has deleted for themselves still contributes cards:
 * `/conversations/:id/phrases` returns them too, and having only the aggregate
 * view disagree would be the inconsistency.
 */
export async function listAllPhraseCards(
  db: Db,
  userId: string,
  scope: PhraseScope,
  limit: number,
): Promise<CrossConversationPhraseCard[]> {
  const [hidden, conversations] = await Promise.all([
    blockedUserIds(db, userId),
    /*
     * Sorted and capped, so the truncation means "your most recent threads"
     * rather than whichever rows the storage engine offered — and
     * `participants_recent` already backs this exact order. The same
     * `{ participants: userId }` five other places in this codebase write
     * inline; no one-use helper for a sixth.
     */
    db
      .collection<Conversation>(COLLECTIONS.conversations)
      .find({ participants: userId }, { projection: { participants: 1 } })
      .sort({ 'lastMessage.createdAt': -1 })
      .limit(PHRASE_SOURCE_CONVERSATION_LIMIT)
      .toArray(),
  ])

  const allowed = conversations.filter(
    (conversation) => !conversation.participants.some((id) => id !== userId && hidden.includes(id)),
  )
  const partnerOf = new Map(
    allowed.map((conversation) => [
      conversation._id.toHexString(),
      conversation.participants.find((id) => id !== userId),
    ]),
  )
  const conversationIds = allowed.map((conversation) => conversation._id)

  const rows = await db
    .collection<PhraseCard>(COLLECTIONS.phraseCards)
    .find(
      scope === 'mine'
        ? { authorId: userId, conversationId: { $in: conversationIds } }
        : { conversationId: { $in: conversationIds } },
    )
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .toArray()

  return rows.map((row) => {
    const conversationId = row.conversationId.toHexString()
    const partnerId = partnerOf.get(conversationId)
    return {
      _id: row._id.toHexString(),
      conversationId,
      messageId: row.messageId.toHexString(),
      authorId: row.authorId,
      term: row.term,
      meaning: row.meaning,
      lang: row.lang,
      ...(row.example ? { example: row.example } : {}),
      ...(partnerId ? { partnerId } : {}),
      createdAt: row.createdAt.toISOString(),
    }
  })
}
