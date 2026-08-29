import { describe, expect, it } from 'vitest'
import type { MessageDto } from '../api/queries'
import { createTranslate } from '../i18n/runtime'
import { dayLabel, messageRows } from './messageGroups'

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
  return messageRows(items).map((row) =>
    row.kind === 'day' ? `day:${row.day}` : `${row.key}${row.endsGroup ? '*' : ''}`,
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
