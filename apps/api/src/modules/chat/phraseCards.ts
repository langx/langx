import type { Db, ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

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
