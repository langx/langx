import { ERROR_CODES, FEED_RANK_VERSION } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { ApiError } from './ApiError'

/**
 * The timeline's cursor: everything the next page needs to rebuild the same
 * order and find its place in it.
 *
 * Two shapes, both starting with `tl<version>.`:
 *
 * - **window** — `tl1.w.<now>.<anchor>.<floor>.<tier>.<score>.<last>`, where
 *   `anchor` and `floor` are the newest and oldest `(createdAt, _id)` page one
 *   read, `now` is the clock the scores were decayed against, and the last
 *   three fields are the key of the last post served. Pinning `now`, `anchor`
 *   and `floor` is what makes every page rank the same rows the same way: a
 *   post written since is newer than `anchor` and cannot enter, and a delete
 *   or hide inside the range only removes itself.
 * - **tail** — `tl1.t.<last>`, once the window is spent and the feed carries
 *   on in plain recency below `floor`.
 *
 * A key, not an offset: when counts change between pages an offset shifts
 * every later card, while a keyset moves only the card that changed.
 *
 * `tl` can never be mistaken for the section feed's `[f.]<count>.<iso>|<id>`
 * (it starts with a digit or `f.`), nor that for this — each decoder refuses
 * the other's shape, so a cursor can never cross endpoints.
 *
 * Pure, for the reason `feedCursor.ts` is.
 */

export interface TimelinePoint {
  date: Date
  id: ObjectId
}

export type TimelineCursor =
  | {
      segment: 'window'
      now: Date
      anchor: TimelinePoint
      floor: TimelinePoint
      last: { tier: 0 | 1; score: number; date: Date; id: ObjectId }
    }
  | { segment: 'tail'; last: TimelinePoint }

function point({ date, id }: TimelinePoint): string {
  return `${date.getTime()}-${id.toHexString()}`
}

export function encodeTimelineCursor(cursor: TimelineCursor): string {
  const prefix = `tl${FEED_RANK_VERSION}`
  if (cursor.segment === 'tail') return `${prefix}.t.${point(cursor.last)}`
  const { now, anchor, floor, last } = cursor
  return [
    prefix,
    'w',
    now.getTime(),
    point(anchor),
    point(floor),
    last.tier,
    last.score,
    point({ date: last.date, id: last.id }),
  ].join('.')
}

const malformed = () => new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed cursor')

const POINT = /^(\d+)-([0-9a-f]{24})$/

function parsePoint(value: string | undefined): TimelinePoint {
  const match = value === undefined ? null : POINT.exec(value)
  if (!match?.[1] || !match[2]) throw malformed()
  return { date: new Date(Number(match[1])), id: new ObjectId(match[2]) }
}

function parseInteger(value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) throw malformed()
  return Number(value)
}

export function decodeTimelineCursor(cursor: string): TimelineCursor {
  const version = /^tl(\d+)\./.exec(cursor)
  if (!version?.[1]) throw malformed()
  /*
   * Another version is a cursor into an order that no longer exists — the
   * weights or the formula changed under a scroll, or a persisted page from
   * an older build asked for its page two. Refused with a reason, because the
   * right answer is not "try again" but "start from page one".
   */
  if (Number(version[1]) !== FEED_RANK_VERSION) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'This feed has been reordered', {
      reason: 'stale_cursor',
    })
  }

  const parts = cursor.slice(version[0].length).split('.')
  if (parts[0] === 't' && parts.length === 2) {
    return { segment: 'tail', last: parsePoint(parts[1]) }
  }
  if (parts[0] === 'w' && parts.length === 7) {
    const tier = parseInteger(parts[4])
    if (tier !== 0 && tier !== 1) throw malformed()
    const last = parsePoint(parts[6])
    return {
      segment: 'window',
      now: new Date(parseInteger(parts[1])),
      anchor: parsePoint(parts[2]),
      floor: parsePoint(parts[3]),
      last: { tier, score: parseInteger(parts[5]), date: last.date, id: last.id },
    }
  }
  throw malformed()
}
