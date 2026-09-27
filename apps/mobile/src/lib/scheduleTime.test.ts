import { MAX_SCHEDULE_AHEAD_DAYS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { defaultScheduleTime, scheduleDays, scheduleSlots } from './scheduleTime'

describe('scheduleDays', () => {
  it('offers today and the days after it, up to the server’s ceiling', () => {
    const now = new Date(2026, 8, 27, 15, 10)
    const days = scheduleDays(now)
    expect(days).toHaveLength(MAX_SCHEDULE_AHEAD_DAYS)
    expect(days[0]).toEqual(new Date(2026, 8, 27))
    expect(days.at(-1)).toEqual(new Date(2026, 8, 27 + MAX_SCHEDULE_AHEAD_DAYS - 1))
    // Every slot on the last day is still inside the week the server allows.
    const last = scheduleSlots(days.at(-1) as Date, now).at(-1) as Date
    expect(last.getTime() - now.getTime()).toBeLessThan(MAX_SCHEDULE_AHEAD_DAYS * 86_400_000)
  })
})

describe('scheduleSlots', () => {
  it('leaves out the half hours that have passed, and the next few minutes', () => {
    const now = new Date(2026, 8, 27, 15, 27)
    const slots = scheduleSlots(new Date(2026, 8, 27), now)
    // 15:30 is three minutes away — too soon to be worth offering.
    expect(slots[0]).toEqual(new Date(2026, 8, 27, 16, 0))
    expect(slots.at(-1)).toEqual(new Date(2026, 8, 27, 23, 30))
  })

  it('offers the whole of a later day', () => {
    const slots = scheduleSlots(new Date(2026, 8, 28), new Date(2026, 8, 27, 15, 0))
    expect(slots).toHaveLength(48)
    expect(slots[0]).toEqual(new Date(2026, 8, 28, 0, 0))
  })
})

describe('defaultScheduleTime', () => {
  it('opens on the first slot at least an hour away', () => {
    expect(defaultScheduleTime(new Date(2026, 8, 27, 15, 10))).toEqual(
      new Date(2026, 8, 27, 16, 30),
    )
  })

  it('rolls over to tomorrow late at night', () => {
    expect(defaultScheduleTime(new Date(2026, 8, 27, 23, 40))).toEqual(new Date(2026, 8, 28, 1, 0))
  })
})
