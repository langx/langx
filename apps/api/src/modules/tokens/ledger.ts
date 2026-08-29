import {
  aggregateId,
  isGrantKind,
  periodKeys,
  utcDayKey,
  type PeriodType,
  type TokenKind,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * Append-only. Nothing in the system ever updates or deletes a row here — a
 * correction to someone's balance is a new `adjustment` row, so the history
 * stays auditable and every aggregate is recomputable from scratch.
 */
export interface TokenLedgerEntry {
  _id: ObjectId
  userId: string
  kind: TokenKind
  amount: number
  /**
   * What this award is *for*: a message id, a conversation id, a day key.
   * Combined with `{userId, kind}` it is unique (see `user_kind_ref_unique`),
   * and that index — not any check in this file — is what makes double
   * awarding physically impossible.
   */
  refId?: string
  day: string
  week: string
  month: string
  year: string
  createdAt: Date
}

export interface TokenAggregate {
  /** `<userId>:<periodType>:<periodKey>` — see `aggregateId`. */
  _id: string
  userId: string
  periodType: PeriodType
  periodKey: string
  tokens: number
  updatedAt: Date
}

export interface AwardTokensInput {
  userId: string
  kind: TokenKind
  amount: number
  refId?: string
  at?: Date
}

export type AwardTokensResult =
  { awarded: true; amount: number } | { awarded: false; amount: 0; reason: 'duplicate' | 'zero' }

function isDuplicateKeyError(error: unknown, indexName: string): boolean {
  return (
    error instanceof MongoServerError && error.code === 11000 && error.message.includes(indexName)
  )
}

/**
 * The single way token enters the system. Two writes, in this order and never the
 * other way round:
 *
 * 1. insert the ledger row — the unique `{userId, kind, refId}` index decides,
 *    atomically and for the whole cluster, whether this award has already been
 *    paid. A duplicate key here is not an error, it is the answer "yes".
 * 2. `$inc` the four period aggregates.
 *
 * A crash between the two under-counts an aggregate rather than paying twice,
 * and the append-only ledger is enough to recompute it. The reverse order
 * would make a crash pay out again on retry, which is unrecoverable.
 *
 * `amount <= 0` writes nothing at all: a message that hit its daily cap should
 * leave no trace, not a row worth zero.
 *
 * **Grants are the exception to step 2.** A signup bonus, a welcome-back bonus
 * and a converted v1 balance credit the all-time total only — see
 * `TOKEN_GRANT_KINDS`. All-time is where a spendable balance comes from, so
 * they stay spendable; the week, month and year buckets are what the
 * leaderboard ranks, and nobody did anything this week to deserve them.
 * Counting them would put whoever signed up most recently above whoever
 * actually talked to someone, and on launch week a returning user would top
 * the weekly table with tokens earned in 2023. The ledger row still carries
 * every period key, so a recompute can always tell where the award landed.
 */
export async function awardTokens(db: Db, input: AwardTokensInput): Promise<AwardTokensResult> {
  if (input.amount <= 0) return { awarded: false, amount: 0, reason: 'zero' }

  const at = input.at ?? new Date()
  const keys = periodKeys(at)

  const entry: TokenLedgerEntry = {
    _id: new ObjectId(),
    userId: input.userId,
    kind: input.kind,
    amount: input.amount,
    day: utcDayKey(at),
    week: keys.week,
    month: keys.month,
    year: keys.year,
    createdAt: at,
  }
  if (input.refId !== undefined) entry.refId = input.refId

  try {
    await db.collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger).insertOne(entry)
  } catch (error) {
    if (isDuplicateKeyError(error, 'user_kind_ref_unique')) {
      return { awarded: false, amount: 0, reason: 'duplicate' }
    }
    throw error
  }

  const credited: PeriodType[] = isGrantKind(input.kind)
    ? ['all']
    : (Object.keys(keys) as PeriodType[])

  await db.collection<TokenAggregate>(COLLECTIONS.tokenAggregates).bulkWrite(
    credited.map((periodType) => ({
      updateOne: {
        filter: { _id: aggregateId(input.userId, periodType, keys[periodType]) },
        update: {
          $inc: { tokens: input.amount },
          $setOnInsert: { userId: input.userId, periodType, periodKey: keys[periodType] },
          $set: { updatedAt: at },
        },
        upsert: true,
      },
    })),
  )

  return { awarded: true, amount: input.amount }
}

/** Totals for one user across all four leaderboard periods. */
export async function readAggregates(
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<Record<PeriodType, number>> {
  const keys = periodKeys(at)
  const types = Object.keys(keys) as PeriodType[]
  const docs = await db
    .collection<TokenAggregate>(COLLECTIONS.tokenAggregates)
    .find({ _id: { $in: types.map((t) => aggregateId(userId, t, keys[t])) } })
    .toArray()

  const byId = new Map(docs.map((d) => [d._id, d.tokens]))
  return {
    all: byId.get(aggregateId(userId, 'all', keys.all)) ?? 0,
    year: byId.get(aggregateId(userId, 'year', keys.year)) ?? 0,
    month: byId.get(aggregateId(userId, 'month', keys.month)) ?? 0,
    week: byId.get(aggregateId(userId, 'week', keys.week)) ?? 0,
  }
}
