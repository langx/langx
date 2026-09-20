import {
  aggregateId,
  completedEchoSessions,
  echoSessionRefId,
  periodKeys,
  schedule,
  TOKEN_RULES,
  type PeriodType,
  type SubmitEchoReviewsInput,
  type SubmitEchoReviewsResult,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { awardTokens } from '../tokens/ledger'
import { recordQualifyingAction, streakDay } from '../tokens/streak'
import { toEchoSrs, type EchoAggregate, type EchoCardDoc, type EchoReviewDoc } from './documents'

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
  /** Rows this batch actually wrote — what the board's counter is moved by. */
  let inserted = 0

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
    inserted += 1

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

  /*
   * The board's counters, moved by what this batch wrote and not by what it
   * was asked to write — a resubmitted session reports `duplicate` for every
   * card and adds nothing here, the same rule the ledger applies next door.
   *
   * Four period rows at once, the same shape and the same `periodKeys` as
   * `awardTokens`: "this week" has to mean the same UTC week on both boards,
   * or the two tables under the same three tabs would disagree about when the
   * week ended.
   *
   * One write for the batch rather than one per card, and deliberately after
   * the loop rather than inside its try: the accepted failure is a crash
   * between an insert and this line, which leaves a counter low. That is the
   * right side to fail on — a number on a ranking table is worth less than a
   * card that moved — and `scripts/backfill-echo-review-counts.ts` rebuilds
   * the counters from the rows.
   */
  if (inserted > 0) {
    const keys = periodKeys(now)
    await db.collection<EchoAggregate>(COLLECTIONS.echoAggregates).bulkWrite(
      (Object.keys(keys) as PeriodType[]).map((periodType) => ({
        updateOne: {
          filter: { _id: aggregateId(userId, periodType, keys[periodType]) },
          update: {
            $inc: { reviews: inserted },
            $setOnInsert: { userId, periodType, periodKey: keys[periodType] },
            $set: { updatedAt: now },
          },
          upsert: true,
        },
      })),
    )
  }

  await settleSessions(db, userId, now)
  return { results }
}

/**
 * Pays for whatever sessions the day's reviews now add up to, and fills the
 * streak square if any of them is new.
 *
 * Recomputed from the ledger on every batch rather than tracked: a session is
 * not a row anywhere — there are only graded cards — so "the third session of
 * the 14th" is the honest identity, and `user_kind_ref_unique` makes paying it
 * twice impossible. That is what lets this run unconditionally after a
 * resubmitted batch and cost nothing.
 *
 * Counted on the **local** day, like the streak it feeds. The message caps are
 * UTC for a reason written down beside them; this one is a person's own
 * evening, and a UTC boundary here would disagree with the square it fills.
 *
 * Nothing here calls `recordActivity`. Echo is outside the daily pool on
 * purpose: the pool is zero-sum and scores acts done with another person, so
 * a solitary repeatable one would dilute the people it exists to reward.
 */
async function settleSessions(db: Db, userId: string, now: Date): Promise<void> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) return

  const day = streakDay(profile, now)
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const reviewedToday = await db
    .collection<EchoReviewDoc>(COLLECTIONS.echoReviews)
    .countDocuments({ userId, at: { $gte: since } })

  const sessions = completedEchoSessions(reviewedToday)
  for (let session = 1; session <= sessions; session += 1) {
    const paid = await awardTokens(db, {
      userId,
      kind: 'echo',
      amount: TOKEN_RULES.award.echoSession,
      refId: echoSessionRefId(day, session),
      at: now,
    })
    /*
     * Only a session that had not been paid before advances the streak, and a
     * single card never does — that would be "open the app and tap once"
     * under another name. A resubmitted batch reports `duplicate` here and
     * leaves the square exactly as it found it.
     */
    if (paid.awarded) await recordQualifyingAction(db, profile, now)
  }
}
