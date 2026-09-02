import { ERROR_CODES } from '@langx/shared'
import type { ObjectId } from 'mongodb'
import { ApiError } from './ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from './dateIdCursor'

/**
 * The feed's cursor, which carries its sort's own keys and which half of the
 * feed it stopped in.
 *
 * The queue sorts `(count, createdAt, _id)`, and paging that with a
 * `createdAt`-only cursor would silently skip every post whose count differs —
 * which is most of them. The correction section is also two queries stitched
 * end to end — the people you follow, then everybody else — so the cursor
 * says which one it came from, or page two would start the first half again.
 *
 * Pure, and deliberately out of the repository: a cursor bug is cheapest to
 * prove fixed where there is no database to stand up.
 */

/** `<count>.<dateIdCursor>`, with `f.` in front while still inside the people you follow. */
export function encodeFeedCursor(
  date: Date,
  id: ObjectId,
  count: number,
  followed: boolean,
): string {
  return `${followed ? 'f.' : ''}${count}.${encodeDateIdCursor(date, id)}`
}

export function decodeFeedCursor(cursor: string): {
  date: Date
  id: ObjectId
  count: number
  followed: boolean
} {
  /*
   * Recognised by *shape*, not by position. The payload after the separator is
   * an ISO timestamp, which carries a dot of its own before the `Z` — so an
   * earlier decoder that split on the first dot found the milliseconds
   * instead, and every page-two request on a countless cursor was a 400.
   * `^\d+\.` cannot match an ISO timestamp, whose fifth character is `-`.
   */
  const match = /^(f\.)?(\d+)\./.exec(cursor)
  if (!match) throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed cursor')
  return {
    ...decodeDateIdCursor(cursor.slice(match[0].length)),
    count: Number(match[2]),
    followed: match[1] !== undefined,
  }
}
