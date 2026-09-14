import { schedule, type SubmitEchoReviewsInput, type SubmitEchoReviewsResult } from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { toEchoSrs, type EchoCardDoc, type EchoReviewDoc } from './documents'

function isDuplicate(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000
}

/**
 * Applies a session's grades, once, however many times it is sent.
 *
 * **The ledger row is written before the card moves**, and that order is the
 * whole design. `user_review_unique` then decides, for the entire cluster at
 * once, whether this grade has already been applied — a session the app
 * retried after a dropped socket cannot advance a card twice, and no handler
 * has to remember to check.
 *
 * The accepted failure is the other way round: a crash between the insert and
 * the update leaves a card that never moved and a retry that reports
 * `duplicate`. That is the right side to fail on. A card reviewed zero times
 * is still due and corrects itself the next time the queue is opened; a card
 * reviewed twice has silently skipped a week. There are no transactions
 * anywhere in this codebase, and a window this narrow is not where to
 * introduce the first one.
 *
 * One `now` for the whole batch, and the items are applied in order rather
 * than in parallel: two grades on the same card inside one session have to
 * compose, and `Promise.all` would race them.
 */
export async function submitReviews(
  db: Db,
  userId: string,
  input: SubmitEchoReviewsInput,
  now: Date = new Date(),
): Promise<SubmitEchoReviewsResult> {
  const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
  const reviews = db.collection<EchoReviewDoc>(COLLECTIONS.echoReviews)
  const results: SubmitEchoReviewsResult['results'] = []

  for (const item of input.reviews) {
    // A malformed id is `missing`, not a 400. One bad entry in a batch of ten
    // must not throw away nine grades somebody actually gave.
    if (!ObjectId.isValid(item.cardId)) {
      results.push({ reviewId: item.reviewId, cardId: item.cardId, status: 'missing', srs: null })
      continue
    }
    const cardId = new ObjectId(item.cardId)

    try {
      await reviews.insertOne({
        _id: new ObjectId(),
        userId,
        reviewId: item.reviewId,
        cardId,
        grade: item.grade,
        at: now,
        durationMs: item.durationMs,
      })
    } catch (caught) {
      if (!isDuplicate(caught)) throw caught
      // Already applied. Hand back what the card actually says, so a client
      // that retried converges on the server rather than keeping the guess it
      // drew on the button.
      const current = await cards.findOne({ _id: cardId, userId })
      results.push({
        reviewId: item.reviewId,
        cardId: item.cardId,
        status: 'duplicate',
        srs: current ? toEchoSrs(current.srs) : null,
      })
      continue
    }

    const card = await cards.findOne({ _id: cardId, userId })
    if (!card) {
      // Removed while the session was open, or never theirs. The ledger row
      // stays: it records what the client claimed, and deleting it would let
      // the retry apply instead of repeat.
      results.push({ reviewId: item.reviewId, cardId: item.cardId, status: 'missing', srs: null })
      continue
    }

    const next = schedule(card, item.grade, now)
    await cards.updateOne({ _id: cardId, userId }, { $set: { srs: next } })
    results.push({
      reviewId: item.reviewId,
      cardId: item.cardId,
      status: 'applied',
      srs: toEchoSrs(next),
    })
  }

  return { results }
}
