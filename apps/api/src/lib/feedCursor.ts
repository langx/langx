import type { ObjectId } from 'mongodb'
import { decodeDateIdCursor, encodeDateIdCursor } from './dateIdCursor'

/**
 * The feed's cursor, which carries its sort's own keys.
 *
 * `needsCorrection` sorts `(correctionCount, createdAt, _id)`, and paging that
 * with a `createdAt`-only cursor would silently skip every post whose count
 * differs — which is most of them. `following` sorts by recency alone and needs
 * no count, so the count is optional and the two encodings have to be told
 * apart on the way back in.
 *
 * Pure, and deliberately out of the repository: a cursor bug is cheapest to
 * prove fixed where there is no database to stand up.
 */

/** `<dateIdCursor>` for the recency sort, `<count>.<dateIdCursor>` for the queue. */
export function encodeFeedCursor(date: Date, id: ObjectId, count: number | null): string {
  const base = encodeDateIdCursor(date, id)
  return count === null ? base : `${count}.${base}`
}

export function decodeFeedCursor(cursor: string): {
  date: Date
  id: ObjectId
  count: number | null
} {
  /*
   * Recognised by *shape*, not by position. The payload after the separator is
   * an ISO timestamp, which carries a dot of its own before the `Z` — so
   * splitting on the first dot found the milliseconds instead, the countless
   * branch became unreachable, and every `following` page-two request was a
   * 400. `needsCorrection` only ever worked because a leading `"3."` happens to
   * put a dot at index 1.
   *
   * `^\d+\.` cannot match an ISO timestamp, whose fifth character is `-`, so
   * cursors already in a client's hand still decode.
   */
  const match = /^(\d+)\./.exec(cursor)
  if (!match) return { ...decodeDateIdCursor(cursor), count: null }
  return { ...decodeDateIdCursor(cursor.slice(match[0].length)), count: Number(match[1]) }
}
