import type { EchoCard, EchoGrade, EchoSummary } from '@langx/shared'

/**
 * What Echo keeps on the device so a session works with no network.
 *
 * Deliberately **not** a database. `docs/echo.md` assumed offline review meant
 * `expo-sqlite` and therefore a store build; it does not. A due queue is ten
 * cards and a summary is four numbers — a few kilobytes of JSON, which
 * `expo-file-system` has been in the binary to write since long before Echo
 * existed. SQLite would be a native module, a migration story and a new
 * failure mode, bought to hold less data than a single chat thread.
 *
 * The rules live here, apart from the writing, because `src/lib` is the only
 * directory vitest can load: anything that imports `expo-file-system` or
 * `Platform` cannot be tested at all.
 */

export const ECHO_SNAPSHOT_VERSION = 1

/** A grade given while the session was open, waiting to reach the server. */
export interface PendingReview {
  reviewId: string
  cardId: string
  grade: EchoGrade
  durationMs: number
  /** When it was given, so a stale queue can be dropped and these cannot. */
  at: string
}

export interface EchoSnapshot {
  version: number
  /** The queue as the server last gave it. Null until a session has been opened online. */
  cards: EchoCard[]
  summary: EchoSummary | null
  pending: PendingReview[]
  /** When the cards and summary were taken. */
  savedAt: string
}

export function emptySnapshot(now: Date): EchoSnapshot {
  return {
    version: ECHO_SNAPSHOT_VERSION,
    cards: [],
    summary: null,
    pending: [],
    savedAt: now.toISOString(),
  }
}

/**
 * How stale a saved queue may be before it is not worth showing.
 *
 * Three days. The schedule is the whole point of the module, and a queue from
 * last month would put a card in front of somebody that the server thinks is
 * not due for a fortnight — worse than showing nothing, because it quietly
 * teaches the wrong thing about when cards come back. Pending **grades** are
 * never dropped on age; they are work somebody did.
 */
export const ECHO_SNAPSHOT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

/** Whether a saved queue is still worth putting in front of somebody. */
export function snapshotIsFresh(snapshot: EchoSnapshot, now: Date): boolean {
  const savedAt = Date.parse(snapshot.savedAt)
  if (Number.isNaN(savedAt)) return false
  return now.getTime() - savedAt <= ECHO_SNAPSHOT_MAX_AGE_MS
}

/**
 * Anything readable, turned into a snapshot or into null.
 *
 * Defensive on purpose: this parses a file the app wrote, and a half-written
 * one after a kill is the ordinary case rather than the exotic one. A shape
 * that cannot be trusted is thrown away and the app carries on online.
 */
export function parseSnapshot(raw: unknown): EchoSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null
  const value = raw as Partial<EchoSnapshot>
  if (value.version !== ECHO_SNAPSHOT_VERSION) return null
  if (!Array.isArray(value.cards) || !Array.isArray(value.pending)) return null
  if (typeof value.savedAt !== 'string') return null
  return {
    version: ECHO_SNAPSHOT_VERSION,
    cards: value.cards,
    summary: value.summary ?? null,
    pending: value.pending.filter(
      (item) =>
        typeof item?.reviewId === 'string' &&
        typeof item?.cardId === 'string' &&
        typeof item?.grade === 'string',
    ),
    savedAt: value.savedAt,
  }
}

/**
 * Adds grades to whatever is already waiting, keeping one per `reviewId`.
 *
 * The id is minted once, when the grade is given, so a duplicate here means
 * the same answer arriving twice — a retry that raced a write — and the first
 * copy is the one with the honest timestamp. The server's unique index would
 * refuse the second anyway; deduping here keeps the file from growing every
 * time a flush fails.
 */
export function withPending(
  snapshot: EchoSnapshot,
  reviews: readonly PendingReview[],
): EchoSnapshot {
  const byId = new Map(snapshot.pending.map((item) => [item.reviewId, item]))
  for (const review of reviews) {
    if (!byId.has(review.reviewId)) byId.set(review.reviewId, review)
  }
  return { ...snapshot, pending: [...byId.values()] }
}

/** Drops the grades the server has now accepted, by id. */
export function withoutPending(snapshot: EchoSnapshot, reviewIds: readonly string[]): EchoSnapshot {
  const done = new Set(reviewIds)
  return { ...snapshot, pending: snapshot.pending.filter((item) => !done.has(item.reviewId)) }
}

/**
 * The queue to draw a session from when the network is not there.
 *
 * Cards already answered offline are removed: they are waiting in `pending`
 * and putting one back in front of somebody would ask them to grade the same
 * card twice in one sitting, which the ledger would then refuse — so the
 * second answer would be silently thrown away.
 */
export function offlineQueue(snapshot: EchoSnapshot, now: Date): EchoCard[] {
  if (!snapshotIsFresh(snapshot, now)) return []
  const answered = new Set(snapshot.pending.map((item) => item.cardId))
  return snapshot.cards.filter((card) => !answered.has(card._id))
}
