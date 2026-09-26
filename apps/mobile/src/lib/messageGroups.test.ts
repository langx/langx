import { describe, expect, it } from 'vitest'
import type { MessageDto } from '../api/queries'
import { createTranslate } from '../i18n/runtime'
import { dayLabel, messageRows, type UnreadMark } from './messageGroups'

const ME = 'me'
const THEM = 'them'

/** Local time on purpose: the grouping is the reader's day, not UTC's. */
function at(day: string, clock: string): string {
  return new Date(`${day}T${clock}:00`).toISOString()
}

function message(id: string, senderId: string, createdAt: string, type = 'text'): MessageDto {
  return {
    _id: id,
    conversationId: 'c1',
    senderId,
    type: type as MessageDto['type'],
    body: id,
    createdAt,
  }
}

/** Newest first, the order the inverted list reads. */
function rows(...items: MessageDto[]) {
  return rowsWith(undefined, ...items)
}

function rowsWith(unread: UnreadMark | undefined, ...items: MessageDto[]) {
  return messageRows(items, unread).map((row) =>
    row.kind === 'day'
      ? `day:${row.day}`
      : row.kind === 'unread'
        ? 'NEW'
        : `${row.key}${row.endsGroup ? '*' : ''}`,
  )
}

describe('messageRows', () => {
  it('is empty for an empty thread', () => {
    expect(messageRows([])).toEqual([])
  })

  /**
   * Emitted after the oldest message of the day, because the list is inverted:
   * getting this backwards labels every day with the date of the one before.
   */
  it('puts a heading below the oldest message of each day', () => {
    expect(
      rows(
        message('c', ME, at('2026-08-29', '09:00')),
        message('b', ME, at('2026-08-28', '18:00')),
        message('a', ME, at('2026-08-28', '08:00')),
      ),
    ).toEqual(['c*', 'day:2026-08-29', 'b*', 'a', 'day:2026-08-28'])
  })

  it('gives the tail to the newest message of a run', () => {
    expect(
      rows(
        message('c', ME, at('2026-08-29', '09:02')),
        message('b', ME, at('2026-08-29', '09:01')),
        message('a', ME, at('2026-08-29', '09:00')),
      ),
    ).toEqual(['c*', 'b', 'a', 'day:2026-08-29'])
  })

  it('breaks a run when the sender changes', () => {
    expect(
      rows(
        message('c', THEM, at('2026-08-29', '09:02')),
        message('b', ME, at('2026-08-29', '09:01')),
        message('a', ME, at('2026-08-29', '09:00')),
      ),
    ).toEqual(['c*', 'b*', 'a', 'day:2026-08-29'])
  })

  /** Same sender, but a heading lands between them. */
  it('breaks a run across a day boundary', () => {
    expect(
      rows(
        message('b', ME, at('2026-08-29', '00:30')),
        message('a', ME, at('2026-08-28', '23:50')),
      ),
    ).toEqual(['b*', 'day:2026-08-29', 'a*', 'day:2026-08-28'])
  })

  /** A full-width card neither joins a run nor lets one continue through it. */
  it('never groups a correction', () => {
    expect(
      rows(
        message('c', ME, at('2026-08-29', '09:02')),
        message('b', ME, at('2026-08-29', '09:01'), 'correction'),
        message('a', ME, at('2026-08-29', '09:00')),
      ),
    ).toEqual(['c*', 'b*', 'a*', 'day:2026-08-29'])
  })
})

describe('messageRows with an unread mark', () => {
  const DAY = '2026-08-29'
  /** Counted up to the newest message at the moment of the read. */
  function mark(count: number, until = at(DAY, '09:05')): UnreadMark {
    return { count, until, viewerId: ME }
  }

  /** Inverted, "after" is above: the line reads above the oldest unread message. */
  it('sits above the oldest of the unread messages', () => {
    expect(
      rowsWith(
        mark(2),
        message('d', THEM, at(DAY, '09:05')),
        message('c', THEM, at(DAY, '09:04')),
        message('b', ME, at(DAY, '09:01')),
        message('a', THEM, at(DAY, '09:00')),
      ),
    ).toEqual(['d*', 'c', 'NEW', 'b*', 'a*', `day:${DAY}`])
  })

  it('draws nothing for a count of zero, or for no mark at all', () => {
    const items = [message('b', THEM, at(DAY, '09:05')), message('a', THEM, at(DAY, '09:00'))]
    expect(rowsWith(mark(0), ...items)).not.toContain('NEW')
    expect(rowsWith(undefined, ...items)).not.toContain('NEW')
  })

  /** The count is theirs; mine interleaved with it are read by definition. */
  it('counts only the other person, stepping over my own messages', () => {
    expect(
      rowsWith(
        mark(2),
        message('d', THEM, at(DAY, '09:05')),
        message('c', ME, at(DAY, '09:04')),
        message('b', THEM, at(DAY, '09:03')),
        message('a', ME, at(DAY, '09:00')),
      ),
    ).toEqual(['d*', 'c*', 'b*', 'NEW', 'a*', `day:${DAY}`])
  })

  /** More unread than loaded: the first of them is on a page not fetched yet. */
  it('draws nothing while the first unread message is further back than what is loaded', () => {
    expect(
      rowsWith(mark(3), message('b', THEM, at(DAY, '09:05')), message('a', THEM, at(DAY, '09:00'))),
    ).not.toContain('NEW')
  })

  it('draws it above the oldest loaded message once that page has arrived', () => {
    expect(
      rowsWith(
        mark(3),
        message('c', THEM, at(DAY, '09:05')),
        message('b', THEM, at(DAY, '09:00')),
        message('a', THEM, at(DAY, '08:00')),
      ),
    ).toEqual(['c*', 'b', 'a', 'NEW', `day:${DAY}`])
  })

  /** The heading stays above the line: the date, then "new", then the messages. */
  it('goes between a day heading and the first message under it', () => {
    expect(
      rowsWith(
        mark(1, at('2026-08-29', '00:30')),
        message('b', THEM, at('2026-08-29', '00:30')),
        message('a', THEM, at('2026-08-28', '23:50')),
      ),
    ).toEqual(['b*', 'NEW', 'day:2026-08-29', 'a*', 'day:2026-08-28'])
  })

  /**
   * Read as they land, so they are not unread — and counting from the newest
   * row instead of from `until` would walk the line down one row for each.
   */
  it('stays put when messages arrive while the thread is open', () => {
    expect(
      rowsWith(
        mark(1),
        message('d', THEM, at(DAY, '09:30')),
        message('c', ME, at(DAY, '09:20')),
        message('b', THEM, at(DAY, '09:05')),
        message('a', THEM, at(DAY, '09:00')),
      ),
    ).toEqual(['d*', 'c*', 'b*', 'NEW', 'a*', `day:${DAY}`])
  })

  /** Like a day heading: the bubble above the line keeps its tail. */
  it('breaks a run of one sender at the line', () => {
    expect(
      rowsWith(mark(1), message('b', THEM, at(DAY, '09:05')), message('a', THEM, at(DAY, '09:00'))),
    ).toEqual(['b*', 'NEW', 'a*', `day:${DAY}`])
  })

  /** A cache from before the read, which a cold start from a push restores. */
  it('draws nothing until the thread holds the newest message the count was taken at', () => {
    expect(
      rowsWith(mark(1), message('b', THEM, at(DAY, '08:59')), message('a', THEM, at(DAY, '08:00'))),
    ).not.toContain('NEW')
  })

  /** Withdrawn while unread, which took it off the count; the tombstone stays. */
  it('does not count a message withdrawn before it was read', () => {
    const withdrawn = { ...message('b', THEM, at(DAY, '09:04')), deleted: true }
    expect(
      rowsWith(
        mark(1),
        message('c', THEM, at(DAY, '09:05')),
        withdrawn,
        message('a', THEM, at(DAY, '09:00')),
      ),
    ).toEqual(['c*', 'NEW', 'b*', 'a', `day:${DAY}`])
  })
})

describe('dayLabel', () => {
  const now = new Date('2026-08-29T12:00:00')
  const en = { t: createTranslate('en'), locale: 'en', now } as const
  const tr = { t: createTranslate('tr'), locale: 'tr', now } as const

  it('names today and yesterday', () => {
    expect(dayLabel('2026-08-29', en)).toBe('Today')
    expect(dayLabel('2026-08-28', en)).toBe('Yesterday')
  })

  it("names them in the reader's language, not the device's", () => {
    expect(dayLabel('2026-08-29', tr)).toBe('Bugün')
    expect(dayLabel('2026-08-28', tr)).toBe('Dün')
  })

  it("formats the date in the reader's language too", () => {
    // The month name is the visible half of this; asserting on it rather than
    // on the numerals is what catches a date built with the wrong locale.
    expect(dayLabel('2026-03-04', tr)).toContain('Mart')
    expect(dayLabel('2026-03-04', en)).toContain('March')
  })

  it('drops the year within the current year and keeps it outside', () => {
    expect(dayLabel('2026-03-04', en)).not.toMatch(/2026/)
    expect(dayLabel('2025-03-04', en)).toMatch(/2025/)
  })

  it('falls back to the key it was given rather than printing an invalid date', () => {
    expect(dayLabel('', en)).toBe('')
  })
})
