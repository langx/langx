import {
  aggregateId,
  completedEchoSessions,
  echoSessionRefId,
  periodKeys,
  schedule,
  SRS_RULES,
  TOKEN_RULES,
  type EchoAward,
  type PeriodType,
  type StreakAward,
  type SubmitEchoReviewsInput,
  type SubmitEchoReviewsResult,
  utcDayKey,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { awardTokens } from '../tokens/ledger'
import { recordQualifyingAction } from '../tokens/streak'
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

  const award = await settleSessions(db, userId, now, inserted)
  return { results, award }
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
 * Counted and keyed on the **UTC** day, both of them, by `echoSessionsToday`.
 * They used to differ — counted over a rolling twenty-four hours, keyed on
 * the local day — and just after local midnight last evening's sessions were
 * still in the count while the keys were new, so the first batch of the day
 * was paid once more for each of them, up to the cap. One day for both closes
 * that, and UTC is the day every other payout key uses: a local key could be
 * re-earned by changing the profile's timezone. Only the streak square stays
 * local, and `recordQualifyingAction` takes that day for itself.
 *
 * Nothing here calls `recordActivity`. Echo is outside the daily pool on
 * purpose: the pool is zero-sum and scores acts done with another person, so
 * a solitary repeatable one would dilute the people it exists to reward.
 *
 * Returns what it paid, for the response of the batch to say. Counted from the
 * same `paid` results that decide the streak, so the number the person is shown
 * and the rows the ledger holds cannot disagree: a resent batch finds every
 * session already paid and reports nothing.
 */
async function settleSessions(
  db: Db,
  userId: string,
  now: Date,
  inserted: number,
): Promise<EchoAward> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) return { tokens: 0, streak: null }

  let tokens = 0
  let streak: StreakAward | null = null

  const { day, sessions, reviewed } = await echoSessionsToday(db, userId, now)
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
    tokens += paid.amount
    if (paid.awarded) {
      const credit = await recordQualifyingAction(db, profile, now)
      // The streak's own bonus is token this batch earned, the way a message's
      // is in `awardForSend`. The first credit is the one that did the work:
      // a second session paid by the same batch reads the same profile, finds
      // today claimed, and reports `advanced: false` with nothing to add.
      tokens += credit.milestoneXp
      streak ??= credit
    }
  }
  /*
   * A session past the UTC day's cap still fills the local square. The cap
   * resets at UTC midnight and the square at local midnight, so west of UTC
   * five evening sessions after UTC midnight would otherwise leave the whole
   * next local day with no Echo session able to count for the streak. Only a
   * batch whose own rows completed a session does this — a resent batch
   * inserts nothing — and the response names the streak only if this call
   * moved it or paid its milestone, since the session itself paid nothing.
   */
  if (!streak && inserted > 0) {
    const size = SRS_RULES.sessionSize
    if (Math.floor(reviewed / size) > Math.floor((reviewed - inserted) / size)) {
      const credit = await recordQualifyingAction(db, profile, now)
      tokens += credit.milestoneXp
      if (credit.advanced || credit.milestoneXp > 0) streak = credit
    }
  }
  return { tokens, streak }
}

/**
 * The day sessions are paid on and how many it has completed — the one count
 * `settleSessions` pays by and the summary's `sessionsToday` reports, so the
 * done screen's "Session X of N" and the ledger cannot disagree.
 *
 * Reviews since UTC midnight, through `completedEchoSessions`, so capped.
 * `owner_recent` serves the count.
 */
export async function echoSessionsToday(
  db: Db,
  userId: string,
  now: Date,
): Promise<{ day: string; sessions: number; reviewed: number }> {
  const day = utcDayKey(now)
  const start = new Date(`${day}T00:00:00.000Z`)
  // Bounded above as well: a batch stamped 23:59:59 that counts after one
  // stamped 00:00:01 has landed must not count that batch's rows as its own
  // day's, or the same reviews would pay a session on both days.
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const reviewed = await db
    .collection<EchoReviewDoc>(COLLECTIONS.echoReviews)
    .countDocuments({ userId, at: { $gte: start, $lt: end } })
  return { day, sessions: completedEchoSessions(reviewed), reviewed }
}
