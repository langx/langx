import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * How many corrections this user has ever written — in a thread or on a post.
 *
 * This used to count `correction` rows in the token ledger, which reads as the
 * same number and is not. `awardTokens` writes nothing at all when the amount
 * is zero, and a user whose tokens are frozen is awarded zero — so a frozen
 * user's correction tile and their correction badges sat at 0 no matter how
 * much teaching they did. Freezing "stops the payout only" (see `blocks.ts`),
 * and a badge is not a payout.
 *
 * The old comment justified counting awards with "a correction past the daily
 * cap is still a correction but was never paid for". There is no such cap:
 * `PLAN_LIMITS.correctionsPer24h` is `null` on every tier, deliberately. With
 * the cap gone the only divergence between awards and acts was the freeze, so
 * this changes the number for frozen users and for nobody else.
 *
 * Retracted corrections still count. A "delete for everyone" tombstone never
 * claws back the award it earned, so excluding them here would move the number
 * for people the freeze never touched — which is the one thing this fix must
 * not do.
 */
export async function countCorrectionsWritten(db: Db, userId: string): Promise<number> {
  const [posts, chat] = await Promise.all([
    // `author_recent`. `post_author_unique` is `{postId, authorId}` — the wrong
    // prefix for "everything this person has corrected".
    db.collection(COLLECTIONS.postCorrections).countDocuments({ authorId: userId }),
    // `sender_type`. `sender_created` carries no `type`, so counting through it
    // would scan every message a heavy user ever sent.
    db.collection(COLLECTIONS.messages).countDocuments({ senderId: userId, type: 'correction' }),
  ])
  return posts + chat
}
