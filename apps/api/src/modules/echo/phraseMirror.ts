import { newCardSrs, sourceKeyOf, type EchoSource } from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { EchoCardDoc } from './documents'

export interface PhraseMirrorInput {
  phraseCardId: ObjectId
  conversationId: ObjectId
  authorId: string
  phrase: { term: string; meaning: string; example?: string; lang: string }
}

/**
 * The Echo card for a phrase somebody saved.
 *
 * Phrase cards are not replaced by Echo and are not moved into it. A phrase
 * card is a *message*: both people see it, it was written on purpose, with a
 * meaning and an example typed by hand. That is a social act and it keeps its
 * place in the composer and in the deck. What changes is that its author now
 * also gets to review it.
 *
 * Nothing is translated and no quota is spent: the author typed both sides,
 * so there is nothing to bill and nothing to meter.
 *
 * **Never throws.** Saving a phrase is the thing the person asked for, and a
 * failure to mirror it must not turn a successful send into an error. The
 * duplicate-key case is not even a failure — it is the same word saved twice,
 * which the index is there to make a no-op.
 */
export async function mirrorPhraseToEcho(db: Db, input: PhraseMirrorInput): Promise<void> {
  const source: EchoSource = {
    kind: 'phrase',
    phraseCardId: input.phraseCardId.toHexString(),
    conversationId: input.conversationId.toHexString(),
  }
  const now = new Date()

  try {
    await db.collection<EchoCardDoc>(COLLECTIONS.echoCards).insertOne({
      _id: new ObjectId(),
      userId: input.authorId,
      lang: input.phrase.lang,
      front: input.phrase.term,
      back: input.phrase.meaning,
      ...(input.phrase.example ? { example: input.phrase.example } : {}),
      source,
      sourceKey: sourceKeyOf(source),
      srs: newCardSrs(now),
      createdAt: now,
    })
  } catch (caught) {
    if (caught instanceof MongoServerError && caught.code === 11000) return
    // Anything else is worth knowing about but not worth failing a send over.
    console.error('[echo] phrase mirror failed', { authorId: input.authorId, error: caught })
  }
}
