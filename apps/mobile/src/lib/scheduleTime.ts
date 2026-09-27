import { MAX_SCHEDULE_AHEAD_DAYS } from '@langx/shared'

/**
 * How far from now the earliest offered slot must be. The server refuses
 * anything under a minute away; five leaves room for the sheet to sit open
 * while somebody decides.
 */
const MIN_LEAD_MS = 5 * 60 * 1000

/**
 * The days "Pick a time" offers: today and the six after it, as local
 * midnights. Seven, not eight — the server's ceiling is a week from *now*, and
 * the eighth day would offer slots the server then refuses.
 */
export function scheduleDays(now: Date): Date[] {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: MAX_SCHEDULE_AHEAD_DAYS }, (_, i) => {
    const day = new Date(today)
    day.setDate(day.getDate() + i)
    return day
  })
}

/**
 * The half hours of one local day that can still be picked. All forty-eight,
 * unlike a meeting's: a message can be meant for somebody's 06:30 alarm.
 * `setHours` rather than adding milliseconds, so a day the clocks change on
 * still reads 00:00, 00:30… on the device's own clock — and on the night they
 * spring forward the missing half hours land on real ones after the gap, so
 * repeats are dropped rather than drawn as two identical chips.
 */
export function scheduleSlots(day: Date, now: Date): Date[] {
  const earliest = now.getTime() + MIN_LEAD_MS
  const slots: Date[] = []
  for (let i = 0; i < 48; i++) {
    const at = new Date(day)
    at.setHours(Math.floor(i / 2), (i % 2) * 30, 0, 0)
    if (at.getTime() < earliest || slots.some((s) => s.getTime() === at.getTime())) continue
    slots.push(at)
  }
  return slots
}

/** Where the picker opens: the first slot an hour or more away. */
export function defaultScheduleTime(now: Date): Date {
  const hourAway = new Date(now.getTime() + 60 * 60 * 1000)
  for (const day of scheduleDays(now)) {
    const slot = scheduleSlots(day, now).find((at) => at.getTime() >= hourAway.getTime())
    if (slot) return slot
  }
  return hourAway
}
