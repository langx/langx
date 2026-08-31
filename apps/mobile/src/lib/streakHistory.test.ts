import { describe, expect, it } from 'vitest'
import { streakHistory } from './streakHistory'

const day = (
  d: string,
  over: Partial<{ actions: number; source: 'activity' | 'purchase'; firstAt: string }> = {},
) => ({
  day: d,
  actions: over.actions ?? 1,
  source: over.source ?? ('activity' as const),
  ...(over.firstAt ? { firstAt: over.firstAt } : {}),
})

describe('streakHistory', () => {
  it('is newest first', () => {
    const rows = streakHistory({
      today: '2026-08-31',
      from: '2026-08-01',
      days: [day('2026-08-29'), day('2026-08-31')],
    })
    expect(rows[0]?.day).toBe('2026-08-31')
    expect(rows.at(-1)?.day).toBe('2026-08-29')
  })

  /** The gaps are the point; a list of only the good days is a trophy cabinet. */
  it('includes the days nothing happened', () => {
    const rows = streakHistory({
      today: '2026-08-31',
      from: '2026-08-01',
      days: [day('2026-08-29'), day('2026-08-31')],
    })
    expect(rows.map((r) => r.kind)).toEqual(['checkedIn', 'missed', 'checkedIn'])
  })

  /**
   * An account made yesterday has not *missed* the fifty-nine days before it
   * existed, and saying so would be both wrong and discouraging.
   */
  it('stops at the oldest day on record rather than filling the window', () => {
    const rows = streakHistory({
      today: '2026-08-31',
      from: '2026-01-01',
      days: [day('2026-08-30')],
    })
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.day)).toEqual(['2026-08-31', '2026-08-30'])
  })

  it('is empty when there is nothing on record', () => {
    expect(streakHistory({ today: '2026-08-31', from: '2026-08-01', days: [] })).toEqual([])
  })

  it('marks a bought day as bought and carries no check-in time for it', () => {
    const rows = streakHistory({
      today: '2026-08-31',
      from: '2026-08-30',
      days: [day('2026-08-31', { source: 'purchase', actions: 0 })],
    })
    expect(rows[0]).toEqual({ day: '2026-08-31', kind: 'bought', actions: 0 })
  })

  it('carries the check-in time when there is one', () => {
    const rows = streakHistory({
      today: '2026-08-31',
      from: '2026-08-31',
      days: [day('2026-08-31', { firstAt: '2026-08-31T07:15:00Z', actions: 4 })],
    })
    expect(rows[0]).toMatchObject({
      kind: 'checkedIn',
      actions: 4,
      firstAt: '2026-08-31T07:15:00Z',
    })
  })

  /** Older rows than the caller asked for must not widen the list. */
  it('never goes further back than the requested window', () => {
    const rows = streakHistory({
      today: '2026-08-31',
      from: '2026-08-30',
      days: [day('2026-01-01'), day('2026-08-31')],
    })
    expect(rows.map((r) => r.day)).toEqual(['2026-08-31', '2026-08-30'])
  })
})
