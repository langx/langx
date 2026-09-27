import { FEED_RANK_VERSION } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import { ApiError } from './ApiError'
import { decodeFeedCursor, encodeFeedCursor } from './feedCursor'
import { decodeTimelineCursor, encodeTimelineCursor, type TimelineCursor } from './timelineCursor'

const at = (iso: string) => new Date(iso)
const id = (n: number) => new ObjectId(n.toString(16).padStart(24, '0'))

function reason(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (error) {
    if (error instanceof ApiError) return error.reason ?? error.code
    throw error
  }
  return 'no error'
}

describe('the timeline cursor', () => {
  const window = (tier: 0 | 1, score: number): TimelineCursor => ({
    segment: 'window',
    now: at('2026-09-27T12:00:00.123Z'),
    anchor: { date: at('2026-09-27T11:59:00.001Z'), id: id(900) },
    floor: { date: at('2026-09-20T08:00:00.000Z'), id: id(1) },
    last: { tier, score, date: at('2026-09-26T10:00:00.456Z'), id: id(42) },
  })

  it('round-trips a window cursor in either tier, the boundary included', () => {
    for (const cursor of [window(0, 0), window(1, 0), window(1, 4_999_999)]) {
      expect(decodeTimelineCursor(encodeTimelineCursor(cursor))).toEqual(cursor)
    }
  })

  it('round-trips a tail cursor', () => {
    const tail: TimelineCursor = {
      segment: 'tail',
      last: { date: at('2026-09-01T00:00:00.000Z'), id: id(7) },
    }
    expect(decodeTimelineCursor(encodeTimelineCursor(tail))).toEqual(tail)
  })

  it('carries its version in the prefix', () => {
    expect(encodeTimelineCursor(window(1, 5))).toMatch(new RegExp(`^tl${FEED_RANK_VERSION}\\.w\\.`))
  })

  /*
   * The two families must never be mistaken for each other: a section cursor
   * handed to the timeline, or the other way round, is refused rather than
   * read as a place in the wrong order.
   */
  it('refuses the section feed’s shapes, and the section feed refuses its own', () => {
    const section = encodeFeedCursor(at('2026-09-27T10:00:00.000Z'), id(3), 2, true)
    const plain = encodeFeedCursor(at('2026-09-27T10:00:00.000Z'), id(3), 0, false)
    for (const old of [section, plain, '40', '3.2026-09-27T10:00:00.000Z|abc']) {
      expect(reason(() => decodeTimelineCursor(old))).toBe('VALIDATION_FAILED')
    }
    expect(() => decodeFeedCursor(encodeTimelineCursor(window(1, 5)))).toThrow(ApiError)
  })

  it('refuses a cursor from another ranking version as stale, not as malformed', () => {
    const other = encodeTimelineCursor(window(1, 5)).replace(/^tl\d+/, `tl${FEED_RANK_VERSION + 1}`)
    expect(reason(() => decodeTimelineCursor(other))).toBe('stale_cursor')
  })

  it('refuses malformed input', () => {
    const good = encodeTimelineCursor(window(1, 5))
    for (const bad of [
      'tl',
      `tl${FEED_RANK_VERSION}.`,
      `tl${FEED_RANK_VERSION}.x.1-${id(1).toHexString()}`,
      `tl${FEED_RANK_VERSION}.t.notanumber-${id(1).toHexString()}`,
      `tl${FEED_RANK_VERSION}.t.1-nothex`,
      good.replace('.w.', '.t.'),
      good.replace(/\.1\.5\./, '.2.5.'),
      `${good}.extra`,
    ]) {
      expect(
        reason(() => decodeTimelineCursor(bad)),
        bad,
      ).toBe('VALIDATION_FAILED')
    }
  })
})
