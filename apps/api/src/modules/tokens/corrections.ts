import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * How much teaching this user has ever done: a correction in a thread, a
 * correction on a post, or a recording left on a pronunciation request.
 *
 * The recordings were missing from this number for a long time, and the reason
 * was real — they are paid under their own ledger kind so that a badge named
 * after corrections keeps counting corrections. But the effect on the person
 * was worse than the imprecision it avoided: somebody who mostly answers
 * pronunciation requests spends exactly the same evening on exactly the same
 * strangers, is paid exactly the same ten tokens for it, and had a profile
 * saying they had helped nobody. Reading a sentence out loud for someone who
 * cannot say it is teaching. The number says so now.
 *
 * The ledger keeps both kinds apart, which is still right — `refId`, the daily
 * pool and every report need to tell the two acts apart. This is one number
 * built from three sources, not a merge of the acts themselves.
 *
 * Note what this does *not* change: the daily pool. Answers do not call
 * `recordActivity` (see `pronunciation.ts`), because the pool's weights are a
 * published formula. So the lifetime number here counts recordings while the
 * weekly chart beside it does not — deliberate, and the smaller of two wrongs
 * until the pool is rebalanced on purpose.
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
  const [posts, chat, recordings] = await Promise.all([
    // `author_recent`. `post_author_unique` is `{postId, authorId}` — the wrong
    // prefix for "everything this person has corrected".
    db.collection(COLLECTIONS.postCorrections).countDocuments({ authorId: userId }),
    // `sender_type`. `sender_created` carries no `type`, so counting through it
    // would scan every message a heavy user ever sent.
    db.collection(COLLECTIONS.messages).countDocuments({ senderId: userId, type: 'correction' }),
    // `author_recent` again, on the answers. One answer per person per request
    // is enforced by `post_author_unique`, so this cannot double-count a
    // request somebody recorded twice.
    db.collection(COLLECTIONS.pronunciationAnswers).countDocuments({ authorId: userId }),
  ])
  return posts + chat + recordings
}
