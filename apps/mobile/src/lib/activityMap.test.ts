import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_CELL_GAP,
  ACTIVITY_CELL_MAX,
  ACTIVITY_CELL_MIN,
  activityCellSize,
  activityGrid,
  repairEffect,
  type ActivityCell,
} from './activityMap'

// A Saturday, so the "today is not the end of the column" case is the default.
const TODAY = '2026-08-29'

const grid = (overrides: Partial<Parameters<typeof activityGrid>[0]> = {}) =>
  activityGrid({ today: TODAY, weeks: 4, days: new Map(), maxAgeDays: 14, ...overrides })

const flat = (columns: ReturnType<typeof activityGrid>) => columns.flat()
const cell = (columns: ReturnType<typeof activityGrid>, day: string) =>
  flat(columns).find((c) => c.day === day)

describe('activityGrid', () => {
  it('is seven rows by as many weeks as asked for', () => {
    const columns = grid({ weeks: 26 })
    expect(columns).toHaveLength(26)
    expect(columns.every((column) => column.length === 7)).toBe(true)
  })

  /** Monday at the top: every column has to start on the same weekday. */
  it('starts every column on a Monday', () => {
    for (const column of grid()) {
      expect(new Date(`${column[0]!.day}T00:00:00`).getDay()).toBe(1)
    }
  })

  it('includes today, in the last column', () => {
    const columns = grid()
    expect(columns.at(-1)?.some((c) => c.day === TODAY)).toBe(true)
  })

  it('marks the rest of this week as future rather than empty', () => {
    const columns = grid()
    expect(cell(columns, '2026-08-30')?.state).toBe('future')
    expect(cell(columns, TODAY)?.state).not.toBe('future')
  })

  it('shades a filled day by how busy it was', () => {
    const columns = grid({
      days: new Map([
        ['2026-08-28', 1],
        ['2026-08-27', 5],
        ['2026-08-26', 12],
        ['2026-08-25', 40],
      ]),
    })
    expect(cell(columns, '2026-08-28')?.intensity).toBe(1)
    expect(cell(columns, '2026-08-27')?.intensity).toBe(2)
    expect(cell(columns, '2026-08-26')?.intensity).toBe(3)
    expect(cell(columns, '2026-08-25')?.intensity).toBe(4)
  })

  /** A bought day is present with no actions, and still reads as filled. */
  it('treats a day with zero actions as filled, not empty', () => {
    const columns = grid({ days: new Map([['2026-08-28', 0]]) })
    expect(cell(columns, '2026-08-28')?.state).toBe('filled')
    expect(cell(columns, '2026-08-28')?.intensity).toBe(1)
  })

  it('offers only the empty days inside the window', () => {
    const columns = grid({ weeks: 6 })
    expect(cell(columns, '2026-08-28')?.state).toBe('repairable')
    expect(cell(columns, '2026-08-15')?.state).toBe('repairable')
    expect(cell(columns, '2026-08-14')?.state).toBe('empty')
  })

  /** Today is earned, not bought — even though it is empty and in the window. */
  it('never offers today', () => {
    expect(cell(grid(), TODAY)?.state).toBe('empty')
  })
})

describe('repairEffect', () => {
  const filled = new Set(['2026-08-29', '2026-08-28', '2026-08-26', '2026-08-25'])

  it('reports the streak the purchase would join', () => {
    const effect = repairEffect({
      day: '2026-08-27',
      today: TODAY,
      filled,
      price: 300,
      balance: 500,
    })
    expect(effect.streakBefore).toBe(2)
    expect(effect.streakAfter).toBe(5)
    expect(effect.changesStreak).toBe(true)
    expect(effect.balanceAfter).toBe(200)
  })

  /**
   * The honest case. A square in the middle of a fortnight nobody was active in
   * fills and changes nothing, and the confirmation has to say so rather than
   * letting the price imply otherwise.
   */
  it('says plainly when a square joins nothing', () => {
    const effect = repairEffect({
      day: '2026-08-10',
      today: TODAY,
      filled,
      price: 300,
      balance: 500,
    })
    expect(effect.changesStreak).toBe(false)
    expect(effect.streakAfter).toBe(effect.streakBefore)
  })

  it('knows when it cannot be afforded', () => {
    const effect = repairEffect({
      day: '2026-08-27',
      today: TODAY,
      filled,
      price: 300,
      balance: 250,
    })
    expect(effect.affordable).toBe(false)
    expect(effect.balanceAfter).toBe(-50)
  })
})

describe('activityGrid and a streak the collection cannot account for', () => {
  const BASE = { today: '2026-08-30', weeks: 2, maxAgeDays: 7 }
  const cellsFor = (grid: ActivityCell[][]): Map<string, ActivityCell> =>
    new Map(grid.flat().map((cell) => [cell.day, cell]))

  it('fills the run behind a streak that has no rows of its own', () => {
    const grid = activityGrid({
      ...BASE,
      days: new Map(),
      streak: { current: 3, lastQualifiedDay: '2026-08-30' },
    })
    const cells = cellsFor(grid)
    for (const day of ['2026-08-30', '2026-08-29', '2026-08-28']) {
      expect(cells.get(day)?.state, day).toBe('filled')
      expect(cells.get(day)?.intensity, day).toBeGreaterThan(0)
    }
    // One day further back is still empty: the streak says three, not four.
    expect(cells.get('2026-08-27')?.state).toBe('repairable')
  })

  it('lets a real row outrank the implied one, so shading survives', () => {
    const grid = activityGrid({
      ...BASE,
      days: new Map([['2026-08-30', 40]]),
      streak: { current: 2, lastQualifiedDay: '2026-08-30' },
    })
    const cells = cellsFor(grid)
    expect(cells.get('2026-08-30')?.intensity).toBe(4)
    expect(cells.get('2026-08-29')?.intensity).toBe(1)
  })

  it('does nothing when there is no streak to imply', () => {
    const grid = activityGrid({
      ...BASE,
      days: new Map(),
      streak: { current: 0, lastQualifiedDay: null },
    })
    expect(grid.flat().every((cell) => cell.intensity === 0)).toBe(true)
  })
})

describe('activityCellSize', () => {
  const total = (cell: number, weeks: number) => weeks * cell + (weeks - 1) * ACTIVITY_CELL_GAP

  it('grows the square to fill a container the old fixed size left empty', () => {
    // 688px is the web build's content box: layout.maxWidth 720 less two 16px
    // gutters. The old fixed 13px square drew 413px into it.
    expect(total(ACTIVITY_CELL_MIN, 26)).toBe(413)
    const cell = activityCellSize(688, 26)
    expect(cell).toBeGreaterThan(ACTIVITY_CELL_MIN)
    expect(total(cell, 26)).toBeGreaterThan(500)
  })

  it('never draws wider than the container it was given', () => {
    for (const width of [320, 358, 500, 688, 720, 1200]) {
      expect(total(activityCellSize(width, 26), 26)).toBeLessThanOrEqual(
        Math.max(width, total(ACTIVITY_CELL_MIN, 26)),
      )
    }
  })

  it('keeps the old size on a narrow phone, where the grid scrolls instead', () => {
    // 390px handset less the screen's two 16px gutters.
    expect(activityCellSize(358, 26)).toBe(ACTIVITY_CELL_MIN)
  })

  it('caps the square so a wide window is a heatmap, not a chessboard', () => {
    expect(activityCellSize(4000, 26)).toBe(ACTIVITY_CELL_MAX)
  })

  it('falls back to the old size before the container has been measured', () => {
    expect(activityCellSize(0, 26)).toBe(ACTIVITY_CELL_MIN)
    expect(activityCellSize(Number.NaN, 26)).toBe(ACTIVITY_CELL_MIN)
    expect(activityCellSize(688, 0)).toBe(ACTIVITY_CELL_MIN)
  })
})
